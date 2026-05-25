import { Exercise, Faute, SRSState } from '@fluentquest/db';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { applySm2 } from '../srs/sm2.js';
import type { AppEnv } from '../types/context.js';

const srs = new Hono<AppEnv>();

srs.use('*', requireAuth);

const submitSchema = z.object({
  exerciseId: z.string().refine((v) => mongoose.isValidObjectId(v), 'invalid_id'),
  userAnswer: z.string().min(1).max(1000),
  quality: z.number().int().min(0).max(5).optional(),
});

// GET /v1/srs/queue  — fautes due for review today for the auth user
srs.get('/queue', async (c) => {
  const user = c.get('user');
  const limit = Math.min(50, Number(c.req.query('limit') ?? 20));

  // Due now : nextReviewAt <= now, or no SRSState yet (first time)
  const due = await SRSState.find({
    userId: user._id,
    nextReviewAt: { $lte: new Date() },
  })
    .sort({ nextReviewAt: 1 })
    .limit(limit)
    .exec();

  const fautes = await Faute.find({
    _id: { $in: due.map((s) => s.fauteId) },
  }).exec();
  const fauteById = new Map(fautes.map((f) => [String(f._id), f]));

  // Find fautes with NO SRS state yet (newly created, never reviewed)
  const seenFauteIds = new Set(due.map((s) => String(s.fauteId)));
  const pending = await Faute.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
  const fresh = pending.filter((f) => !seenFauteIds.has(String(f._id)));

  const items = [
    ...due
      .map((s) => {
        const f = fauteById.get(String(s.fauteId));
        if (!f) return null;
        return {
          fauteId: String(f._id),
          originalText: f.originalText,
          correctedText: f.correctedText,
          ruleSummary: f.ruleSummary,
          language: f.language,
          severity: f.severity,
          srs: {
            easeFactor: s.easeFactor,
            intervalDays: s.intervalDays,
            repetitions: s.repetitions,
            nextReviewAt: s.nextReviewAt.toISOString(),
          },
        };
      })
      .filter((x) => x !== null),
    ...fresh.map((f) => ({
      fauteId: String(f._id),
      originalText: f.originalText,
      correctedText: f.correctedText,
      ruleSummary: f.ruleSummary,
      language: f.language,
      severity: f.severity,
      srs: null,
    })),
  ];

  return c.json({ items, count: items.length });
});

// POST /v1/srs/review  — submit an answer, update SRS state
srs.post('/review', async (c) => {
  const parsed = submitSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);

  const user = c.get('user');
  const { exerciseId, userAnswer, quality } = parsed.data;

  const exercise = await Exercise.findById(exerciseId).exec();
  if (!exercise) return c.json({ error: 'exercise_not_found' }, 404);
  if (String(exercise.userId) !== String(user._id)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const isCorrect = normalize(userAnswer) === normalize(exercise.correctAnswer);
  exercise.userAnswer = userAnswer;
  exercise.isCorrect = isCorrect;
  exercise.answeredAt = new Date();
  await exercise.save();

  // Update SRS state for the underlying faute
  const inferredQuality = quality ?? (isCorrect ? 5 : 1);
  let state = await SRSState.findOne({
    userId: user._id,
    fauteId: exercise.fauteId,
  }).exec();

  if (!state) {
    state = await SRSState.create({
      userId: user._id,
      fauteId: exercise.fauteId,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      nextReviewAt: new Date(),
    });
  }

  const updated = applySm2(
    {
      easeFactor: state.easeFactor,
      intervalDays: state.intervalDays,
      repetitions: state.repetitions,
      lapses: state.lapses,
      quality: inferredQuality,
    },
    new Date(),
  );

  state.easeFactor = updated.easeFactor;
  state.intervalDays = updated.intervalDays;
  state.repetitions = updated.repetitions;
  state.lapses = updated.lapses;
  state.nextReviewAt = updated.nextReviewAt;
  state.lastReviewedAt = new Date();
  await state.save();

  return c.json({
    isCorrect,
    correctAnswer: exercise.correctAnswer,
    srs: {
      easeFactor: state.easeFactor,
      intervalDays: state.intervalDays,
      repetitions: state.repetitions,
      lapses: state.lapses,
      nextReviewAt: state.nextReviewAt.toISOString(),
    },
  });
});

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]+$/g, '');
}

export { srs };
