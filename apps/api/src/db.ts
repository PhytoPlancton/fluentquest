import mongoose from 'mongoose';
import { assertEncryptionConfigured } from '@fluentquest/db';

let connected = false;

export function isMongoConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  // Fail fast if field encryption isn't configured — schemas use it.
  assertEncryptionConfigured();

  mongoose.set('strictQuery', true);

  const maxPoolSize = Number(process.env.MONGO_MAX_POOL ?? 10);
  if (maxPoolSize > 20) {
    throw new Error(
      `MONGO_MAX_POOL=${maxPoolSize} dépasse la limite recommandée (20). Cluster partagé, max 500 conns total.`,
    );
  }

  await mongoose.connect(uri, {
    maxPoolSize,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });

  connected = true;
  console.log(`Mongo connected (maxPoolSize=${maxPoolSize})`);
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log('Mongo disconnected');
}
