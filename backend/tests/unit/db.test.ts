import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDatabase } from '../helpers/testDb.js';

describe('database schema', () => {
  let db: Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());
  });

  afterEach(() => cleanup());

  it('creates the users, vehicles and purchases tables', () => {
    const tables = db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => row.name);

    expect(tables).toContain('users');
    expect(tables).toContain('vehicles');
    expect(tables).toContain('purchases');
  });

  it('enforces foreign keys', () => {
    const rows = db.pragma('foreign_keys', { simple: false }) as { foreign_keys: number }[];

    expect(rows[0]?.foreign_keys).toBe(1);
  });

  it('rejects two users with the same email', () => {
    const insert = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    );
    insert.run('u1', 'Ada', 'ada@example.com', 'hash', 'CUSTOMER');

    expect(() => insert.run('u2', 'Grace', 'ada@example.com', 'hash', 'CUSTOMER')).toThrow(
      /UNIQUE/i,
    );
  });

  it('rejects an unknown user role', () => {
    const insert = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    );
    expect(() => insert.run('u3', 'Eve', 'eve@example.com', 'hash', 'SUPERUSER')).toThrow(/CHECK/i);
  });

  it('rejects a negative vehicle quantity', () => {
    const insert = db.prepare(
      'INSERT INTO vehicles (id, make, model, category, year, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    expect(() => insert.run('v1', 'Toyota', 'Corolla', 'SEDAN', 2022, 21000, -1)).toThrow(/CHECK/i);
  });

  it('rejects a negative vehicle price', () => {
    const insert = db.prepare(
      'INSERT INTO vehicles (id, make, model, category, year, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    expect(() => insert.run('v2', 'Toyota', 'Corolla', 'SEDAN', 2022, -5, 1)).toThrow(/CHECK/i);
  });

  it('rejects two listings with the same make, model and year', () => {
    const insert = db.prepare(
      'INSERT INTO vehicles (id, make, model, category, year, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    insert.run('v10', 'Toyota', 'Corolla', 'SEDAN', 2022, 21000, 1);

    // Case differences must not slip past the constraint either.
    expect(() => insert.run('v11', 'toyota', 'COROLLA', 'SEDAN', 2022, 21000, 1)).toThrow(
      /UNIQUE/i,
    );
  });

  it('is idempotent when opened twice against the same file', () => {
    // openDatabase runs migrations; re-running them must not fail.
    const second = createTestDatabase();
    expect(() => second.db.prepare('SELECT COUNT(*) FROM vehicles').get()).not.toThrow();
    second.cleanup();
  });
});
