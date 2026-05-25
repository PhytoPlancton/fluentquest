import { Membership, type Role, Workspace } from '@fluentquest/db';
import { createMiddleware } from 'hono/factory';
import mongoose from 'mongoose';
import type { AppEnv } from '../types/context.js';

function isObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

/**
 * Resolves `:workspaceId` from the route params, ensures the authenticated user
 * is a member, and exposes `workspace` + `membershipRole` on the context.
 * Must run AFTER requireAuth.
 */
export const requireMember = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);

  const id = c.req.param('workspaceId') ?? c.req.param('id');
  if (!id || !isObjectId(id)) return c.json({ error: 'invalid_workspace_id' }, 400);

  const workspace = await Workspace.findById(id).exec();
  if (!workspace) return c.json({ error: 'workspace_not_found' }, 404);

  const membership = await Membership.findOne({
    workspaceId: workspace._id,
    userId: user._id,
  }).exec();
  if (!membership) return c.json({ error: 'forbidden' }, 403);

  c.set('workspace', workspace);
  c.set('membershipRole', membership.role);

  await next();
});

const HIERARCHY: Record<Role, number> = { owner: 3, admin: 2, member: 1 };

export function requireRole(minRole: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get('membershipRole');
    if (!role || HIERARCHY[role] < HIERARCHY[minRole]) {
      return c.json({ error: 'forbidden', required: minRole }, 403);
    }
    await next();
  });
}

export const requireAdmin = requireRole('admin');
export const requireOwner = requireRole('owner');
