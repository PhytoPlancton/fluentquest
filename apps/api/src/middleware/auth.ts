import { User } from '@fluentquest/db';
import { createMiddleware } from 'hono/factory';
import { readBearerToken, readSessionCookie } from '../auth/cookies.js';
import { lookupAuthSession, touchAuthSession } from '../auth/sessions.js';
import type { AppEnv } from '../types/context.js';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = (await readSessionCookie(c)) ?? readBearerToken(c);
  if (!token) return c.json({ error: 'unauthorized' }, 401);

  const session = await lookupAuthSession(token);
  if (!session) return c.json({ error: 'unauthorized' }, 401);

  const user = await User.findById(session.userId).exec();
  if (!user) return c.json({ error: 'unauthorized' }, 401);

  c.set('user', user);
  c.set('authSession', session);

  // Fire-and-forget heartbeat update
  void touchAuthSession(session);

  await next();
});
