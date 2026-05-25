import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { SESSION_LIFETIME_MS } from './sessions.js';

export const SESSION_COOKIE = 'fq_session';

function cookieSecret(): string {
  const s = process.env.COOKIE_SECRET;
  if (!s || s.length < 32) {
    throw new Error('COOKIE_SECRET must be set to at least 32 chars');
  }
  return s;
}

export async function setSessionCookie(c: Context, token: string): Promise<void> {
  await setSignedCookie(c, SESSION_COOKIE, token, cookieSecret(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
  });
}

export async function readSessionCookie(c: Context): Promise<string | null> {
  const value = await getSignedCookie(c, cookieSecret(), SESSION_COOKIE);
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function readBearerToken(c: Context): string | null {
  const auth = c.req.header('authorization');
  if (!auth) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  return m?.[1] ?? null;
}
