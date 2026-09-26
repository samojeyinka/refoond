import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDatabase(uri: string = env.mongodbUri): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    dbName: 'refoond',
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}