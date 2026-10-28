import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS } from './schema.js';

/**
 * Opens (creating if necessary) a file-backed SQLite database, applies any
 * outstanding migrations and returns the connection.
 *
 * The caller owns the connection: tests open throwaway files, the server opens
 * the configured one. Nothing in the app reaches for a global singleton, which
 * is what keeps the test suite isolated.
 */
export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ':memory:') {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = new Database(filePath);

  // WAL keeps readers from blocking the writer; foreign keys are off by
  // default in SQLite and must be enabled per connection.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);

  return db;
}

/** Applies every migration the database has not seen yet. */
export function migrate(db: Database.Database): number {
  const [{ user_version: current }] = db.pragma('user_version') as [{ user_version: number }];
  let applied = 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const statement = MIGRATIONS[version];
    if (!statement) continue;

    db.exec('BEGIN');
    try {
      db.exec(statement);
      db.pragma(`user_version = ${version + 1}`);
      db.exec('COMMIT');
      applied += 1;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return applied;
}
