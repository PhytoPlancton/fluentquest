import { decryptField, encryptField } from '@fluentquest/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ORIGINAL_KEY = process.env.FIELD_ENCRYPTION_KEY;
const TEST_KEY = 'a'.repeat(64); // deterministic 32-byte key for tests

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY !== undefined) process.env.FIELD_ENCRYPTION_KEY = ORIGINAL_KEY;
  else delete process.env.FIELD_ENCRYPTION_KEY;
});

describe('field encryption', () => {
  it('round-trips plaintext', () => {
    const enc = encryptField('he act yesterday');
    expect(enc).toMatch(/^enc:/);
    expect(decryptField(enc)).toBe('he act yesterday');
  });

  it('is idempotent : re-encrypting an already encrypted value is a no-op', () => {
    const enc = encryptField('once');
    expect(encryptField(enc)).toBe(enc);
  });

  it('passes through plain values on decrypt (not prefixed)', () => {
    expect(decryptField('plain')).toBe('plain');
  });

  it('preserves null/undefined/empty strings', () => {
    expect(encryptField(null)).toBe(null);
    expect(encryptField(undefined)).toBe(undefined);
    expect(encryptField('')).toBe('');
    expect(decryptField(null)).toBe(null);
    expect(decryptField('')).toBe('');
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const a = encryptField('same text');
    const b = encryptField('same text');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('same text');
    expect(decryptField(b)).toBe('same text');
  });
});
