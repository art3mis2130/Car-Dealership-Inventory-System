import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { openDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';

/** Process entry point: open the database, start listening, shut down cleanly. */
async function main(): Promise<void> {
  const env = getEnv();
  const db = openDatabase(env.DATABASE_PATH);

  if (env.SEED_ON_START) {
    // Idempotent, so this is safe on every restart - it only fills an empty
    // database.
    await seedDatabase(db);
  }

  const app = createApp(db);

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`Database: ${env.DATABASE_PATH}`);
  });

  const shutdown = (signal: string) => () => {
    console.log(`\n${signal} received, shutting down`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
