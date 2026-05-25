import { Membership, Session as RecordingSession } from '@fluentquest/db';
import { createMiddleware } from 'hono/factory';
import mongoose from 'mongoose';
import type { AppEnv } from '../types/context.js';

/**
 * Resolves the recording session from `:id` (or `:sessionId`), then ensures
 * the authenticated user is a member of its workspace.
 * Must run AFTER requireAuth.
 */
export const requireSessionAccess = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);

  const id = c.req.param('sessionId') ?? c.req.param('id');
  if (!id || !mongoose.isValidObjectId(id)) {
    return c.json({ error: 'invalid_session_id' }, 400);
  }

  const recordingSession = await RecordingSession.findById(id).exec();
  if (!recordingSession) return c.json({ error: 'session_not_found' }, 404);

  const membership = await Membership.findOne({
    userId: user._id,
    workspaceId: recordingSession.workspaceId,
  }).exec();
  if (!membership) return c.json({ error: 'forbidden' }, 403);

  c.set('recordingSession', recordingSession);
  c.set('membershipRole', membership.role);

  await next();
});
