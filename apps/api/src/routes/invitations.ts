import { Invitation, Membership, User, Workspace } from '@fluentquest/db';
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../types/context.js';

const invitations = new Hono<AppEnv>();

invitations.get('/:token', async (c) => {
  const token = c.req.param('token');
  const invitation = await Invitation.findOne({ token, status: 'pending' }).exec();
  if (!invitation) return c.json({ error: 'invitation_not_found' }, 404);
  if (invitation.expiresAt.getTime() <= Date.now()) {
    invitation.status = 'expired';
    await invitation.save();
    return c.json({ error: 'invitation_expired' }, 410);
  }

  const workspace = await Workspace.findById(invitation.workspaceId).exec();
  const inviter = await User.findById(invitation.invitedByUserId)
    .select('displayName email')
    .exec();

  return c.json({
    invitation: {
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    },
    workspace: workspace
      ? { id: String(workspace._id), name: workspace.name, slug: workspace.slug }
      : null,
    invitedBy: inviter ? { displayName: inviter.displayName, email: inviter.email } : null,
  });
});

invitations.post('/:token/accept', requireAuth, async (c) => {
  const user = c.get('user');
  const token = c.req.param('token');

  const invitation = await Invitation.findOne({ token, status: 'pending' }).exec();
  if (!invitation) return c.json({ error: 'invitation_not_found' }, 404);

  if (invitation.expiresAt.getTime() <= Date.now()) {
    invitation.status = 'expired';
    await invitation.save();
    return c.json({ error: 'invitation_expired' }, 410);
  }

  if (invitation.email !== user.email) {
    return c.json({ error: 'email_mismatch' }, 403);
  }

  const existing = await Membership.findOne({
    userId: user._id,
    workspaceId: invitation.workspaceId,
  }).exec();
  if (existing) {
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();
    return c.json({ workspaceId: String(invitation.workspaceId), alreadyMember: true });
  }

  await Membership.create({
    userId: user._id,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
    joinedAt: new Date(),
  });

  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  await invitation.save();

  return c.json({ workspaceId: String(invitation.workspaceId), alreadyMember: false });
});

export { invitations };
