import {
  LANGUAGES,
  Membership,
  Segment,
  Session as RecordingSession,
  type SessionDoc,
  Workspace,
} from '@fluentquest/db';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireSessionAccess } from '../middleware/recording-session.js';
import type { AppEnv } from '../types/context.js';

const sessions = new Hono<AppEnv>();

sessions.use('*', requireAuth);

const objectIdString = () =>
  z.string().refine((v) => mongoose.isValidObjectId(v), { message: 'invalid_object_id' });

const createSchema = z.object({
  workspaceId: objectIdString(),
  title: z.string().max(200).trim().optional(),
  languages: z.array(z.enum(LANGUAGES as readonly [string, ...string[]])).max(3).default([]),
  participants: z
    .array(
      z.object({
        userId: objectIdString(),
        displayName: z.string().min(1).max(64),
      }),
    )
    .default([]),
});

const patchSchema = z.object({
  title: z.string().max(200).trim().optional(),
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().min(0).optional(),
  transcriptionStatus: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
});

const segmentsSchema = z.object({
  segments: z
    .array(
      z.object({
        speakerLabel: z.string().min(1).max(16),
        assignedUserId: objectIdString().optional(),
        startMs: z.number().min(0),
        endMs: z.number().min(0),
        text: z.string().min(1).max(10000),
        language: z.enum(LANGUAGES as readonly [string, ...string[]]),
        markedAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(500),
});

function publicSession(s: SessionDoc) {
  return {
    id: String(s._id),
    workspaceId: String(s.workspaceId),
    recordedByUserId: String(s.recordedByUserId),
    title: s.title ?? null,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    durationSec: s.durationSec,
    languages: s.languages,
    participants: s.participants.map((p) => ({
      userId: String(p.userId),
      displayName: p.displayName,
    })),
    audioStorage: s.audioStorage,
    audioUrl: s.audioUrl ?? null,
    transcriptionStatus: s.transcriptionStatus,
    analysisStatus: s.analysisStatus,
    createdAt: s.createdAt.toISOString(),
  };
}

sessions.post('/', async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const user = c.get('user');
  const { workspaceId, title, languages, participants } = parsed.data;

  const workspace = await Workspace.findById(workspaceId).exec();
  if (!workspace) return c.json({ error: 'workspace_not_found' }, 404);

  const membership = await Membership.findOne({
    workspaceId: workspace._id,
    userId: user._id,
  }).exec();
  if (!membership) return c.json({ error: 'forbidden' }, 403);

  const recording = await RecordingSession.create({
    workspaceId: workspace._id,
    recordedByUserId: user._id,
    title: title ?? null,
    startedAt: new Date(),
    languages,
    participants,
    audioStorage: 'local',
    transcriptionStatus: 'pending',
    analysisStatus: 'pending',
  });

  return c.json({ session: publicSession(recording) }, 201);
});

sessions.get('/', async (c) => {
  const user = c.get('user');
  const workspaceId = c.req.query('workspaceId');
  if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
    return c.json({ error: 'workspaceId_required' }, 400);
  }

  const membership = await Membership.findOne({
    workspaceId,
    userId: user._id,
  }).exec();
  if (!membership) return c.json({ error: 'forbidden' }, 403);

  const limit = Math.min(50, Number(c.req.query('limit') ?? 20));
  const items = await RecordingSession.find({ workspaceId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .exec();

  return c.json({ sessions: items.map(publicSession) });
});

sessions.get('/:id', requireSessionAccess, async (c) => {
  const recording = c.get('recordingSession');
  const segments = await Segment.find({ sessionId: recording._id })
    .sort({ startMs: 1 })
    .limit(500)
    .exec();

  return c.json({
    session: publicSession(recording),
    segments: segments.map((s) => ({
      id: String(s._id),
      speakerLabel: s.speakerLabel,
      assignedUserId: s.assignedUserId ? String(s.assignedUserId) : null,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      language: s.language,
      markedAt: s.markedAt ? s.markedAt.toISOString() : null,
    })),
  });
});

sessions.patch('/:id', requireSessionAccess, async (c) => {
  const parsed = patchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const recording = c.get('recordingSession');
  if (parsed.data.title !== undefined) recording.title = parsed.data.title;
  if (parsed.data.endedAt) recording.endedAt = new Date(parsed.data.endedAt);
  if (parsed.data.durationSec !== undefined) recording.durationSec = parsed.data.durationSec;
  if (parsed.data.transcriptionStatus) {
    recording.transcriptionStatus = parsed.data.transcriptionStatus;
  }

  await recording.save();
  return c.json({ session: publicSession(recording) });
});

sessions.post('/:id/segments', requireSessionAccess, async (c) => {
  const parsed = segmentsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const recording = c.get('recordingSession');
  const docs = parsed.data.segments.map((s) => ({
    sessionId: recording._id,
    workspaceId: recording.workspaceId,
    speakerLabel: s.speakerLabel,
    assignedUserId: s.assignedUserId ?? null,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
    language: s.language,
    markedAt: s.markedAt ? new Date(s.markedAt) : null,
  }));

  const inserted = await Segment.insertMany(docs);
  return c.json({ inserted: inserted.length }, 201);
});

sessions.post('/:id/end', requireSessionAccess, async (c) => {
  const recording = c.get('recordingSession');
  if (recording.endedAt) return c.json({ error: 'already_ended' }, 409);
  recording.endedAt = new Date();
  recording.transcriptionStatus = 'done';
  await recording.save();
  // M6 : trigger pipeline d'analyse LLM ici
  return c.json({ session: publicSession(recording) });
});

export { sessions };
