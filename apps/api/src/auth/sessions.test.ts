import { describe, expect, it } from 'vitest';
import { generateToken } from './sessions.js';

describe('generateToken', () => {
  it('returns a base64url string', () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it('produces unique tokens (1000 rounds, no collision)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateToken());
    expect(set.size).toBe(1000);
  });
});
