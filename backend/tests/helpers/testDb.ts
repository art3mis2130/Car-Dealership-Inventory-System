import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { openDatabase } from '../../src/db/index.js';

/**
 * Creates a fresh, migrated, file-backed SQLite database in a throwaway
 * directory. Every test file gets its own database file so suites stay
 * isolated from each other and from the development data.
 */
export function createTestDatabase(): { db: Database; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'dealership-test-'));
  const db = openDatabase(join(dir, 'test.db'));

  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
