// Shared TS types — no Mongoose, safe to import from web/desktop bundles.

export type Language = 'en' | 'es' | 'fr';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native';

export type Role = 'owner' | 'admin' | 'member';

export type Severity = 1 | 2 | 3 | 4 | 5;

export type FauteCategory =
  | 'grammar'
  | 'vocab'
  | 'idiom'
  | 'collocation'
  | 'pronunciation'
  | 'style';

export type ExerciseType = 'mcq' | 'rewrite' | 'fill_blank';

export type SessionStatus = 'pending' | 'processing' | 'done' | 'failed';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type AudioStorage = 'local' | 's3';

export const LANGUAGES: readonly Language[] = ['en', 'es', 'fr'] as const;
export const CEFR_LEVELS: readonly CEFRLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'native',
] as const;
export const ROLES: readonly Role[] = ['owner', 'admin', 'member'] as const;

// API contracts (matches apps/api endpoints)

export interface ApiPing {
  ok: boolean;
  ts: number;
}

export interface ApiHealth {
  status: 'ok' | 'degraded';
  mongo: 'connected' | 'disconnected';
  uptime: number;
}
