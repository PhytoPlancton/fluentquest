import { hash, verify } from '@node-rs/argon2';

// argon2id (default of @node-rs/argon2) with OWASP-recommended params (2024).
const ARGON_OPTIONS = {
  memoryCost: 19_456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  if (plain.length > 1024) {
    throw new Error('Password too long (DoS guard)');
  }
  return hash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  if (plain.length > 1024) return false;
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
