import crypto from 'node:crypto';
import { AuthSession, type AuthSessionHydrated } from '@fluentquest/db';
import type mongoose from 'mongoose';

const TOKEN_BYTES = 32;
export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

export interface CreateSessionInput {
  userId: mongoose.Types.ObjectId;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export async function createAuthSession(input: CreateSessionInput): Promise<AuthSessionHydrated> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

  return AuthSession.create({
    token,
    userId: input.userId,
    expiresAt,
    lastSeenAt: now,
    userAgent: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}

export async function lookupAuthSession(token: string): Promise<AuthSessionHydrated | null> {
  if (!token || typeof token !== 'string') return null;
  const session = await AuthSession.findOne({ token }).exec();
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await session.deleteOne();
    return null;
  }
  return session;
}

export async function touchAuthSession(session: AuthSessionHydrated): Promise<void> {
  // Avoid hot-path writes : only update if last touch > 1 min ago
  const ONE_MINUTE = 60_000;
  if (Date.now() - session.lastSeenAt.getTime() < ONE_MINUTE) return;
  session.lastSeenAt = new Date();
  await session.save();
}

export async function revokeAuthSession(token: string): Promise<void> {
  if (!token) return;
  await AuthSession.deleteOne({ token }).exec();
}

export async function revokeAllUserSessions(userId: mongoose.Types.ObjectId): Promise<void> {
  await AuthSession.deleteMany({ userId }).exec();
}
