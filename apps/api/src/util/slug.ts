import crypto from 'node:crypto';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function randomSlug(prefix = ''): string {
  const random = crypto.randomBytes(6).toString('hex');
  return prefix ? `${prefix}-${random}` : random;
}
