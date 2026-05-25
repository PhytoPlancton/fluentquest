import { z } from 'zod';

export const HighlightSpanSchema = z.object({
  startChar: z.number().int().min(0),
  endChar: z.number().int().min(0),
});

export const FauteAnalysisSchema = z.object({
  segmentIndex: z.number().int().min(0),
  category: z.enum(['grammar', 'vocab', 'idiom', 'collocation', 'pronunciation', 'style']),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  originalText: z.string().min(1),
  correctedText: z.string().min(1),
  highlightSpan: HighlightSpanSchema,
  ruleSummary: z.string().min(1).max(500),
  ruleDeep: z.string().nullable().optional(),
  examples: z.array(z.string()).max(5).default([]),
  isInteresting: z.boolean().default(false),
});

export const RecommendationSchema = z.object({
  type: z.enum(['rule', 'idiom', 'vocab']),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
});

export const SessionAnalysisSchema = z.object({
  fautes: z.array(FauteAnalysisSchema).default([]),
  languageDetected: z.enum(['en', 'es', 'fr']).optional(),
  levelEstimate: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  recommendations: z.array(RecommendationSchema).max(5).default([]),
});

export type SessionAnalysis = z.infer<typeof SessionAnalysisSchema>;
export type FauteAnalysis = z.infer<typeof FauteAnalysisSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ExerciseGenSchema = z.object({
  mcqs: z
    .array(
      z.object({
        prompt: z.string().min(1).max(500),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
      }),
    )
    .min(1)
    .max(5),
  rewrite: z.object({
    prompt: z.string().min(1).max(500),
    correctAnswer: z.string().min(1).max(500),
  }),
});

export type ExerciseGen = z.infer<typeof ExerciseGenSchema>;

export function parseJsonStrict<T>(raw: string, schema: z.ZodType<T>): T {
  // The LLM sometimes wraps JSON in markdown code fences despite response_format.
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  const parsed = JSON.parse(cleaned);
  return schema.parse(parsed);
}
