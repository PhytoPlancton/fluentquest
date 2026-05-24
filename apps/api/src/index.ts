import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectMongo, disconnectMongo, isMongoConnected } from './db.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  }),
);

app.get('/v1/ping', (c) => c.json({ ok: true, ts: Date.now() }));

app.get('/v1/health', (c) =>
  c.json({
    status: 'ok',
    mongo: isMongoConnected() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  }),
);

const port = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  if (process.env.MONGODB_URI) {
    await connectMongo();
  } else {
    console.warn('MONGODB_URI not set — running without Mongo connection');
  }

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`API listening on http://${info.address}:${info.port}`);
  });
}

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);
  await disconnectMongo();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((err: unknown) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
