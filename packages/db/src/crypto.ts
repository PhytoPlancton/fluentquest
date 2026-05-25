import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const PREFIX = 'enc:';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is required (64 hex chars / 32 bytes). Generate: openssl rand -hex 32',
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be exactly ${KEY_BYTES * 2} hex chars (got ${buf.length * 2})`,
    );
  }
  cachedKey = buf;
  return buf;
}

// `any` signatures are required to match Mongoose's set/get hooks.
// At runtime we still gate on string-ness — non-strings pass through unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encryptField(plaintext: any): any {
  if (plaintext == null || plaintext === '') return plaintext;
  if (typeof plaintext !== 'string') return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptField(value: any): any {
  if (value == null || value === '') return value;
  if (typeof value !== 'string') return value;
  if (!value.startsWith(PREFIX)) return value;

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted field');
  const [ivB, tagB, ctB] = parts as [string, string, string];

  const iv = Buffer.from(ivB, 'base64');
  const tag = Buffer.from(tagB, 'base64');
  const ct = Buffer.from(ctB, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

export function assertEncryptionConfigured(): void {
  getKey();
}
