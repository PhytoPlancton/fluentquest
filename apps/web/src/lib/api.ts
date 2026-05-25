import { createClient, type FluentClient } from '@fluentquest/sdk';

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') as string;

export const api: FluentClient = createClient({ baseUrl });
