import { Faute, type FauteCategory, type Severity } from '@fluentquest/db';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { generateExercisesForFaute } from '../llm/generate-exercises.js';
import { analyzeSession } from '../llm/analyze-session.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSessionAccess } from '../middleware/recording-session.js';
import type { AppEnv } from '../types/context.js';

const analysis = new Hono<AppEnv>();

analysis.use('*', requireAuth);

// POST /v1/sessions/:id/analyze  — fire-and-forget LLM analysis
analysis.post('/sessions/:id/analyze', requireSessionAccess, async (c) => {
  const session = c.get('recordingSession');
  if (session.analysisStatus === 'processing') {
    return c.json({ error: 'already_processing' }, 409);
  }
  if (session.analysisStatus === 'done' && c.req.query('force') !== '1') {
    return c.json({ error: 'already_done', hint: 'pass ?force=1 to re-run' }, 409);
  }

  // Fire-and-forget. MVP: no job queue. Production: BullMQ / similar.
  void analyzeSession(String(session._id)).catch((err: unknown) => {
    console.error('analyzeSession failed:', err);
  });

  return c.json({ status: 'queued' }, 202);
});

// GET /v1/sessions/:id/fautes  — list fautes for a session
analysis.get('/sessions/:id/fautes', requireSessionAccess, async (c) => {
  const session = c.get('recordingSession');
  const fautes = await Faute.find({ sessionId: session._id }).sort({ severity: -1 }).exec();

  return c.json({
    fautes: fautes.map((f) => ({
      id: String(f._id),
      segmentId: String(f.segmentId),
      userId: String(f.userId),
      category: f.category as FauteCategory,
      severity: f.severity as Severity,
      language: f.language,
      originalText: f.originalText,
      correctedText: f.correctedText,
      highlightSpan: f.highlightSpan,
      ruleSummary: f.ruleSummary,
      ruleDeep: f.ruleDeep ?? null,
      examples: f.examples,
      isInteresting: f.isInteresting,
    })),
  });
});

// POST /v1/fautes/:id/exercises  — generate exercises for a faute
analysis.post('/fautes/:id/exercises', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!mongoose.isValidObjectId(id)) return c.json({ error: 'invalid_faute_id' }, 400);

  const faute = await Faute.findById(id).exec();
  if (!faute) return c.json({ error: 'faute_not_found' }, 404);
  if (String(faute.userId) !== String(user._id)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const result = await generateExercisesForFaute(id);
  return c.json(result, 201);
});

export { analysis };
