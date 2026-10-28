import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/testDb.js';

/**
 * Single-service mode is how this deploys, so it is tested here rather than
 * only inside the Docker job: the risk is not that the container fails to
 * build, it is that the SPA fallback quietly swallows API routes.
 */
describe('single-service mode', () => {
  let app: Express;
  let cleanupDb: () => void;
  let distDir: string;

  beforeEach(() => {
    distDir = mkdtempSync(join(tmpdir(), 'dealership-spa-'));
    mkdirSync(join(distDir, 'assets'));
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><div id="root">SPA</div>');
    writeFileSync(join(distDir, 'assets', 'index-abc123.js'), 'console.log("bundle");');

    const db = createTestDatabase();
    cleanupDb = db.cleanup;
    app = createApp(db.db, { spa: { enabled: true, distPath: distDir } });
  });

  afterEach(() => {
    cleanupDb();
    rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the SPA at the root', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="root">');
  });

  it('serves the SPA for a client-side route, so a refresh works', async () => {
    const response = await request(app).get('/purchases');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="root">');
  });

  it('serves hashed assets with a long cache lifetime', async () => {
    const response = await request(app).get('/assets/index-abc123.js');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('immutable');
  });

  it('never caches index.html, or a deploy would not be picked up', async () => {
    const response = await request(app).get('/');

    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('still answers API routes as an API', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('returns a JSON 404 for an unknown API route, not the HTML page', async () => {
    // The dangerous failure: a client would try to parse a web page as JSON.
    const response = await request(app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.text).not.toContain('<div id="root">');
  });

  it('does not treat a path merely starting with "api" as an API route', async () => {
    const response = await request(app).get('/apiary');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="root">');
  });

  it('stays an API-only server when the mode is off', async () => {
    const db = createTestDatabase();
    const apiOnly = createApp(db.db, { spa: { enabled: false, distPath: distDir } });

    const response = await request(apiOnly).get('/');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');

    db.cleanup();
  });
});
