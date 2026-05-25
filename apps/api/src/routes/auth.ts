import { Membership, User, Workspace } from '@fluentquest/db';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  clearSessionCookie,
  readBearerToken,
  readSessionCookie,
  setSessionCookie,
} from '../auth/cookies.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import {
  createAuthSession,
  revokeAuthSession,
} from '../auth/sessions.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../types/context.js';
import { randomSlug, slugify } from '../util/slug.js';

const auth = new Hono<AppEnv>();

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(1024),
  displayName: z.string().min(1).max(64).trim(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(1024),
});

function publicUser(u: { _id: unknown; email: string; displayName: string; level: unknown }) {
  return {
    id: String(u._id),
    email: u.email,
    displayName: u.displayName,
    level: u.level,
  };
}

auth.post('/signup', async (c) => {
  const parsed = signupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail }).exec();
  if (existing) return c.json({ error: 'email_taken' }, 409);

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    displayName,
    level: {},
  });

  const personalSlug = `${slugify(displayName) || 'me'}-${randomSlug()}`;
  const workspace = await Workspace.create({
    name: `${displayName}'s workspace`,
    slug: personalSlug,
    ownerUserId: user._id,
    isPersonal: true,
  });

  await Membership.create({
    userId: user._id,
    workspaceId: workspace._id,
    role: 'owner',
    joinedAt: new Date(),
  });

  const session = await createAuthSession({
    userId: user._id,
    userAgent: c.req.header('user-agent') ?? null,
    ipAddress: c.req.header('x-forwarded-for') ?? null,
  });
  await setSessionCookie(c, session.token);

  return c.json(
    {
      user: publicUser(user),
      workspace: { id: String(workspace._id), name: workspace.name, slug: workspace.slug },
      token: session.token,
    },
    201,
  );
});

auth.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);

  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+passwordHash')
    .exec();

  // Constant-time-ish: always verify against either real hash or a dummy
  const stored = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy';
  const valid = await verifyPassword(password, stored);

  if (!user || !valid) return c.json({ error: 'invalid_credentials' }, 401);

  user.lastLoginAt = new Date();
  await user.save();

  const session = await createAuthSession({
    userId: user._id,
    userAgent: c.req.header('user-agent') ?? null,
    ipAddress: c.req.header('x-forwarded-for') ?? null,
  });
  await setSessionCookie(c, session.token);

  return c.json({ user: publicUser(user), token: session.token });
});

auth.post('/logout', async (c) => {
  const token = (await readSessionCookie(c)) ?? readBearerToken(c);
  if (token) await revokeAuthSession(token);
  clearSessionCookie(c);
  return c.body(null, 204);
});

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const memberships = await Membership.find({ userId: user._id })
    .populate<{ workspaceId: { _id: unknown; name: string; slug: string; isPersonal: boolean } }>(
      'workspaceId',
      'name slug isPersonal',
    )
    .exec();

  const workspaces = memberships.map((m) => {
    const w = m.workspaceId as unknown as {
      _id: unknown;
      name: string;
      slug: string;
      isPersonal: boolean;
    };
    return {
      id: String(w._id),
      name: w.name,
      slug: w.slug,
      isPersonal: w.isPersonal,
      role: m.role,
    };
  });

  return c.json({ user: publicUser(user), workspaces });
});

export { auth };
