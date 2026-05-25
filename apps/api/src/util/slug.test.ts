import { describe, expect, it } from 'vitest';
import { randomSlug, slugify } from './slug.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('collapses repeated separators', () => {
    expect(slugify('Hello   World!!')).toBe('hello-world');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });

  it('removes accents/diacritics', () => {
    expect(slugify('café crème')).toBe('cafe-creme');
  });

  it('caps at 48 chars', () => {
    const s = slugify('a'.repeat(100));
    expect(s.length).toBeLessThanOrEqual(48);
  });

  it('returns empty for non-alphanumeric input', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('randomSlug', () => {
  it('produces 12-char hex without prefix', () => {
    expect(randomSlug()).toMatch(/^[0-9a-f]{12}$/);
  });

  it('prefixes when given one', () => {
    expect(randomSlug('team')).toMatch(/^team-[0-9a-f]{12}$/);
  });

  it('produces unique values', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(randomSlug());
    expect(set.size).toBe(1000);
  });
});
