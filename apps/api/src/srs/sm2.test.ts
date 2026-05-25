import { describe, expect, it } from 'vitest';
import { applySm2 } from './sm2.js';

const initial = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };

describe('SM-2', () => {
  it('first successful review → interval 1 day', () => {
    const out = applySm2({ ...initial, quality: 5 });
    expect(out.repetitions).toBe(1);
    expect(out.intervalDays).toBe(1);
  });

  it('second successful review → interval 6 days', () => {
    const after1 = applySm2({ ...initial, quality: 5 });
    const after2 = applySm2({ ...after1, quality: 5 });
    expect(after2.repetitions).toBe(2);
    expect(after2.intervalDays).toBe(6);
  });

  it('third successful review → interval = round(previous_interval × ease_BEFORE_update)', () => {
    let s = applySm2({ ...initial, quality: 5 });
    s = applySm2({ ...s, quality: 5 });
    const easeBeforeThird = s.easeFactor;
    s = applySm2({ ...s, quality: 5 });
    expect(s.repetitions).toBe(3);
    // SuperMemo SM-2 : new interval uses OLD ease factor, then ease is updated
    expect(s.intervalDays).toBe(Math.round(6 * easeBeforeThird));
  });

  it('failure resets repetitions, intervalDays=1, lapses++', () => {
    let s = applySm2({ ...initial, quality: 5 });
    s = applySm2({ ...s, quality: 5 });
    const out = applySm2({ ...s, quality: 1 });
    expect(out.repetitions).toBe(0);
    expect(out.intervalDays).toBe(1);
    expect(out.lapses).toBe(1);
  });

  it('ease factor never below 1.3', () => {
    let s = { ...initial };
    for (let i = 0; i < 50; i++) s = applySm2({ ...s, quality: 0 });
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('quality 4 (good) increases interval modestly', () => {
    const out = applySm2({ ...initial, quality: 4 });
    expect(out.intervalDays).toBe(1);
    expect(out.easeFactor).toBeCloseTo(2.5, 1);
  });

  it('quality 5 perfect : ease factor goes up', () => {
    const out = applySm2({ ...initial, quality: 5 });
    expect(out.easeFactor).toBeGreaterThan(2.5);
  });

  it('nextReviewAt is intervalDays from now', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const out = applySm2({ ...initial, quality: 5 }, now);
    const expected = new Date(now.getTime() + 1 * 86_400_000);
    expect(out.nextReviewAt.getTime()).toBe(expected.getTime());
  });
});
