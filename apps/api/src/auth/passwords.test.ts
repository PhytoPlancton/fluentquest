import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('passwords', () => {
  it('hashes and verifies the same password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('password123');
    expect(await verifyPassword('password124', hash)).toBe(false);
  });

  it('rejects empty input', async () => {
    await expect(hashPassword('')).rejects.toThrow();
    expect(await verifyPassword('', 'whatever')).toBe(false);
    expect(await verifyPassword('whatever', '')).toBe(false);
  });

  it('rejects malformed hash gracefully (returns false, no throw)', async () => {
    expect(await verifyPassword('pw', 'not-a-real-hash')).toBe(false);
  });

  it('refuses passwords > 1024 chars', async () => {
    const long = 'x'.repeat(1025);
    await expect(hashPassword(long)).rejects.toThrow();
  });
});
