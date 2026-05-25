import { Exercise, Faute } from '@fluentquest/db';
import { llmJson } from './client.js';
import { EXERCISE_GEN_SYSTEM, buildExerciseGenUser } from './prompts.js';
import { ExerciseGenSchema, parseJsonStrict } from './schemas.js';

export async function generateExercisesForFaute(fauteId: string): Promise<{ inserted: number }> {
  const faute = await Faute.findById(fauteId).exec();
  if (!faute) throw new Error('Faute not found');

  const existing = await Exercise.countDocuments({ fauteId: faute._id }).exec();
  if (existing > 0) return { inserted: 0 };

  const gen = await llmJson(
    [
      { role: 'system', content: EXERCISE_GEN_SYSTEM },
      {
        role: 'user',
        content: buildExerciseGenUser({
          language: faute.language,
          originalText: faute.originalText,
          correctedText: faute.correctedText,
          ruleSummary: faute.ruleSummary,
          category: faute.category,
        }),
      },
    ],
    (raw) => parseJsonStrict(raw, ExerciseGenSchema),
    { temperature: 0.3, maxTokens: 1500 },
  );

  const model = process.env.EDJ_DEFAULT_MODEL ?? 'pplx-claude-sonnet-4.6';
  const docs: Array<Record<string, unknown>> = [];

  for (const mcq of gen.mcqs) {
    docs.push({
      userId: faute.userId,
      fauteId: faute._id,
      workspaceId: faute.workspaceId,
      type: 'mcq',
      prompt: mcq.prompt,
      options: mcq.options,
      correctAnswer: mcq.options[mcq.correctIndex],
      generatedByModel: model,
    });
  }

  docs.push({
    userId: faute.userId,
    fauteId: faute._id,
    workspaceId: faute.workspaceId,
    type: 'rewrite',
    prompt: gen.rewrite.prompt,
    correctAnswer: gen.rewrite.correctAnswer,
    generatedByModel: model,
  });

  await Exercise.insertMany(docs);
  return { inserted: docs.length };
}
