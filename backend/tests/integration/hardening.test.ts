import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/testDb.js';
import { createTestContext, type TestContext } from '../helpers/testApp.js';

describe('security headers', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('does not advertise the server technology', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('tells browsers not to sniff content types', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses to be framed, so the UI cannot be clickjacked', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.headers['x-frame-options']?.toUpperCase()).toBe('SAMEORIGIN');
  });

  it('sets a referrer policy', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.headers['referrer-policy']).toBeDefined();
  });
});

describe('request ids', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('stamps every response with an id', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.headers['x-request-id']).toMatch(/[0-9a-f-]{8,}/i);
  });

  it('gives different requests different ids', async () => {
    const [first, second] = await Promise.all([
      request(ctx.app).get('/api/health'),
      request(ctx.app).get('/api/health'),
    ]);

    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('honours an id supplied by the caller, so a trace can span services', async () => {
    const response = await request(ctx.app).get('/api/health').set('X-Request-Id', 'trace-abc-123');

    expect(response.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('ignores an absurdly long client id rather than echoing it back', async () => {
    const response = await request(ctx.app).get('/api/health').set('X-Request-Id', 'x'.repeat(500));

    expect(response.headers['x-request-id']).not.toBe('x'.repeat(500));
  });

  it('includes the id in an error body, so a user can quote it in a report', async () => {
    const response = await request(ctx.app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('rate limiting on the auth endpoints', () => {
  let ctx: TestContext;

  beforeEach(() => {
    const { db, cleanup } = createTestDatabase();
    // A deliberately tiny limit; the production default comes from the env.
    ctx = { db, cleanup, app: createApp(db, { authRateLimit: { windowMs: 60_000, max: 3 } }) };
  });

  afterEach(() => ctx.cleanup());

  const attempt = () =>
    request(ctx.app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong-pass' });

  it('allows attempts up to the limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
  });

  it('answers 429 once the limit is exceeded', async () => {
    for (let i = 0; i < 3; i += 1) await attempt();

    const response = await attempt();

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  it('advertises the limit in the response headers', async () => {
    const response = await attempt();

    expect(response.headers['ratelimit-limit'] ?? response.headers.ratelimit).toBeDefined();
  });

  it('does not rate limit ordinary browsing', async () => {
    // Shared with the auth routes, a limit this low would make the app
    // unusable; only the credential endpoints are throttled.
    for (let i = 0; i < 6; i += 1) {
      expect((await request(ctx.app).get('/api/health')).status).toBe(200);
    }
  });
});

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('reports the database as reachable', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'ok', database: 'connected' });
    expect(response.body.data.uptime).toBeTypeOf('number');
  });

  it('reports 503 when the database cannot be queried', async () => {
    // A health check that cannot fail is not a health check.
    ctx.db.close();

    const response = await request(ctx.app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.data?.database ?? response.body.error.code).toBeTruthy();
  });
});

describe('payload limits', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('refuses an oversized JSON body instead of buffering it', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'x'.repeat(200_000), email: 'a@b.com', password: 'sup3r-secret' });

    expect([413, 422]).toContain(response.status);
  });
});
