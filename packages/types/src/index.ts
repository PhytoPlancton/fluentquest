export type Language = 'en' | 'es' | 'fr';

export type Severity = 1 | 2 | 3 | 4 | 5;

export interface ApiPing {
  ok: boolean;
  ts: number;
}

export interface ApiHealth {
  status: 'ok' | 'degraded';
  mongo: 'connected' | 'disconnected';
  uptime: number;
}
