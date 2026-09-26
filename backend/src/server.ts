import http from 'http';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/mongo';
import { createApp } from './app';
import { createSocketServer } from './realtime/socket';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const httpServer = http.createServer(app);
  createSocketServer(httpServer); 

  httpServer.listen(env.port, () => {
    console.log(`Refoond API listening on ${env.serverUrl} (env: ${env.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down.`);
    httpServer.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
