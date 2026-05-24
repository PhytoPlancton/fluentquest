import type { ApiHealth, ApiPing } from '@fluentquest/types';

export interface SdkConfig {
  baseUrl: string;
  token?: string;
}

export interface FluentClient {
  ping(): Promise<ApiPing>;
  health(): Promise<ApiHealth>;
}

export function createClient(config: SdkConfig): FluentClient {
  const headers = (): Record<string, string> =>
    config.token ? { Authorization: `Bearer ${config.token}` } : {};

  const request = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${config.baseUrl}${path}`, { headers: headers() });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return (await res.json()) as T;
  };

  return {
    ping: () => request<ApiPing>('/v1/ping'),
    health: () => request<ApiHealth>('/v1/health'),
  };
}
