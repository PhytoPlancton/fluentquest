/**
 * Anki SM-2 algorithm.
 *
 * Input quality q ∈ {0..5} :
 *   0..2 → fail (reset interval, count lapse)
 *   3..5 → pass (advance interval)
 *
 * State per item :
 *   easeFactor    (default 2.5, never below 1.3)
 *   intervalDays  (days until next review)
 *   repetitions   (consecutive successful reviews)
 *   lapses        (total failures)
 */

export interface SRSUpdateInput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  quality: number; // 0..5
}

export interface SRSUpdateOutput {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  nextReviewAt: Date;
}

const MIN_EASE = 1.3;

export function applySm2(input: SRSUpdateInput, now: Date = new Date()): SRSUpdateOutput {
  const q = clampInt(input.quality, 0, 5);
  let { easeFactor, intervalDays, repetitions, lapses } = input;

  if (q < 3) {
    // Failure : reset repetitions, lapse++
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }

  // Ease factor update — formula from SuperMemo SM-2
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    easeFactor: round2(easeFactor),
    intervalDays,
    repetitions,
    lapses,
    nextReviewAt,
  };
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
