import crypto from 'node:crypto';
import {
  Invitation,
  type InvitationStatus,
  Membership,
  type Role,
  ROLES,
  User,
  Workspace,
} from '@fluentquest/db';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireMember, requireOwner, requireRole } from '../middleware/workspace.js';
import type { AppEnv } from '../types/context.js';
import { randomSlug, slugify } from '../util/slug.js';

const workspaces = new Hono<AppEnv>();

workspaces.use('*', requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

const renameSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

const inviteSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  role: z.enum(['admin', 'member']).default('member'),
});

const roleSchema = z.object({
  role: z.enum(ROLES.filter((r) => r !== 'owner') as ['admin', 'member']),
});

const INVITE_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function publicWorkspace(w: {
  _id: unknown;
  name: string;
  slug: string;
  isPersonal: boolean;
  ownerUserId: unknown;
  createdAt: Date;
}) {
  return {
    id: String(w._id),
    name: w.name,
    slug: w.slug,
    isPersonal: w.isPersonal,
    ownerUserId: String(w.ownerUserId),
    createdAt: w.createdAt.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────
// Workspace CRUD
// ────────────────────────────────────────────────────────────────────────

workspaces.post('/', async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const user = c.get('user');
  const { name } = parsed.data;
  const slug = `${slugify(name) || 'team'}-${randomSlug()}`;

  const workspace = await Workspace.create({
    name,
    slug,
    ownerUserId: user._id,
    isPersonal: false,
  });

  await Membership.create({
    userId: user._id,
    workspaceId: workspace._id,
    role: 'owner',
    joinedAt: new Date(),
  });

  return c.json({ workspace: publicWorkspace(workspace) }, 201);
});

workspaces.get('/', async (c) => {
  const user = c.get('user');
  const memberships = await Membership.find({ userId: user._id }).exec();
  const ids = memberships.map((m) => m.workspaceId);
  const ws = await Workspace.find({ _id: { $in: ids } }).exec();

  const roleByWs = new Map(memberships.map((m) => [String(m.workspaceId), m.role]));
  const items = ws.map((w) => ({
    ...publicWorkspace(w),
    role: roleByWs.get(String(w._id)),
  }));

  return c.json({ workspaces: items });
});

workspaces.get('/:id', requireMember, async (c) => {
  const workspace = c.get('workspace');
  const role = c.get('membershipRole');
  const memberCount = await Membership.countDocuments({ workspaceId: workspace._id }).exec();
  return c.json({ workspace: publicWorkspace(workspace), role, memberCount });
});

workspaces.patch('/:id', requireMember, requireRole('admin'), async (c) => {
  const parsed = renameSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);

  const workspace = c.get('workspace');
  workspace.name = parsed.data.name;
  await workspace.save();

  return c.json({ workspace: publicWorkspace(workspace) });
});

workspaces.delete('/:id', requireMember, requireOwner, async (c) => {
  const workspace = c.get('workspace');
  if (workspace.isPersonal) {
    return c.json({ error: 'cannot_delete_personal_workspace' }, 400);
  }
  await Membership.deleteMany({ workspaceId: workspace._id }).exec();
  await workspace.deleteOne();
  return c.body(null, 204);
});

// ────────────────────────────────────────────────────────────────────────
// Members
// ────────────────────────────────────────────────────────────────────────

workspaces.get('/:id/members', requireMember, async (c) => {
  const workspace = c.get('workspace');
  const memberships = await Membership.find({ workspaceId: workspace._id })
    .populate<{ userId: { _id: unknown; email: string; displayName: string } }>(
      'userId',
      'email displayName',
    )
    .exec();

  const items = memberships.map((m) => {
    const u = m.userId as unknown as { _id: unknown; email: string; displayName: string };
    return {
      userId: String(u._id),
      email: u.email,
      displayName: u.displayName,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    };
  });
  return c.json({ members: items });
});

workspaces.delete('/:id/members/:userId', requireMember, requireRole('admin'), async (c) => {
  const workspace = c.get('workspace');
  const targetId = c.req.param('userId');
  if (!mongoose.isValidObjectId(targetId)) return c.json({ error: 'invalid_user_id' }, 400);

  const membership = await Membership.findOne({
    workspaceId: workspace._id,
    userId: targetId,
  }).exec();
  if (!membership) return c.json({ error: 'not_a_member' }, 404);
  if (membership.role === 'owner') return c.json({ error: 'cannot_remove_owner' }, 400);

  await membership.deleteOne();
  return c.body(null, 204);
});

workspaces.patch('/:id/members/:userId/role', requireMember, requireOwner, async (c) => {
  const parsed = roleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);

  const workspace = c.get('workspace');
  const targetId = c.req.param('userId');
  if (!mongoose.isValidObjectId(targetId)) return c.json({ error: 'invalid_user_id' }, 400);

  const membership = await Membership.findOne({
    workspaceId: workspace._id,
    userId: targetId,
  }).exec();
  if (!membership) return c.json({ error: 'not_a_member' }, 404);
  if (membership.role === 'owner') return c.json({ error: 'cannot_demote_owner' }, 400);

  membership.role = parsed.data.role;
  await membership.save();
  return c.json({ role: membership.role });
});

// ────────────────────────────────────────────────────────────────────────
// Invitations (workspace-scoped)
// ────────────────────────────────────────────────────────────────────────

workspaces.post('/:id/invitations', requireMember, requireRole('admin'), async (c) => {
  const parsed = inviteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const workspace = c.get('workspace');
  const inviter = c.get('user');
  const { email, role } = parsed.data;

  const existingUser = await User.findOne({ email }).exec();
  if (existingUser) {
    const existingMembership = await Membership.findOne({
      workspaceId: workspace._id,
      userId: existingUser._id,
    }).exec();
    if (existingMembership) return c.json({ error: 'already_member' }, 409);
  }

  const pendingExisting = await Invitation.findOne({
    workspaceId: workspace._id,
    email,
    status: 'pending',
  }).exec();
  if (pendingExisting) return c.json({ error: 'invitation_already_pending' }, 409);

  const token = crypto.randomBytes(24).toString('base64url');
  const invitation = await Invitation.create({
    workspaceId: workspace._id,
    email,
    invitedByUserId: inviter._id,
    role,
    token,
    status: 'pending' as InvitationStatus,
    expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
  });

  return c.json(
    {
      invitation: {
        id: String(invitation._id),
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    },
    201,
  );
});

workspaces.get('/:id/invitations', requireMember, requireRole('admin'), async (c) => {
  const workspace = c.get('workspace');
  const invitations = await Invitation.find({
    workspaceId: workspace._id,
    status: 'pending',
  }).exec();

  return c.json({
    invitations: invitations.map((i) => ({
      id: String(i._id),
      email: i.email,
      role: i.role as Role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
});

workspaces.delete('/:id/invitations/:invId', requireMember, requireRole('admin'), async (c) => {
  const workspace = c.get('workspace');
  const invId = c.req.param('invId');
  if (!mongoose.isValidObjectId(invId)) return c.json({ error: 'invalid_invitation_id' }, 400);

  const invitation = await Invitation.findOne({
    _id: invId,
    workspaceId: workspace._id,
  }).exec();
  if (!invitation) return c.json({ error: 'invitation_not_found' }, 404);

  invitation.status = 'revoked';
  await invitation.save();
  return c.body(null, 204);
});

export { workspaces };
