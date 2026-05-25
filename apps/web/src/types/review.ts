// Local types for review UI — backed by placeholder data until M6/M7 land.

import type { FauteCategory, Severity } from '@fluentquest/types';

export interface UiFaute {
  id: string;
  originalText: string;
  correctedText: string;
  category: FauteCategory;
  severity: Severity;
  ruleSummary: string;
  ruleDeep?: string;
  speakerLabel?: string;
  startMs?: number;
}

export interface UiMcq {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface UiRewriteExercise {
  id: string;
  prompt: string;
  hint?: string;
  correctAnswer: string;
}
