import type { Database } from 'better-sqlite3';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from './testDb.js';

export interface TestContext {
  app: Express;
  db: Database;
  cleanup: () => void;
}

/** Boots a full Express app wired to a throwaway database. */
export function createTestContext(): TestContext {
  const { db, cleanup } = createTestDatabase();
  return { app: createApp(db), db, cleanup };
}

/** Registers a customer and returns their bearer token. */
export async function registerCustomer(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ token: string; id: string; email: string }> {
  const payload = {
    name: overrides.name ?? 'Casey Customer',
    email: overrides.email ?? `casey-${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: overrides.password ?? 'customer-pass-1',
  };

  const response = await request(app).post('/api/auth/register').send(payload).expect(201);

  return {
    token: response.body.data.token,
    id: response.body.data.user.id,
    email: response.body.data.user.email,
  };
}

/**
 * Creates an ADMIN and returns their bearer token.
 *
 * Admins are never created through the public API, so this promotes the row
 * directly, exactly as the seed script does.
 */
export async function registerAdmin(
  app: Express,
  db: Database,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<{ token: string; id: string; email: string }> {
  const email = overrides.email ?? `avery-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const password = overrides.password ?? 'admin-pass-1';

  await request(app)
    .post('/api/auth/register')
    .send({ name: overrides.name ?? 'Avery Admin', email, password })
    .expect(201);

  db.prepare('UPDATE users SET role = ? WHERE email = ?').run('ADMIN', email);

  // Log in again so the token carries the ADMIN claim.
  const response = await request(app).post('/api/auth/login').send({ email, password }).expect(200);

  return {
    token: response.body.data.token,
    id: response.body.data.user.id,
    email: response.body.data.user.email,
  };
}
