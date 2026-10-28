import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';

describe('POST /api/auth/register', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'sup3r-secret' };

  it('creates the account and returns 201 with a token', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send(valid);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTypeOf('string');
    expect(response.body.data.user).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'CUSTOMER',
    });
  });

  it('never returns the password or its hash', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send(valid);

    expect(JSON.stringify(response.body)).not.toContain('sup3r-secret');
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it('returns 409 for an email that is already registered', async () => {
    await request(ctx.app).post('/api/auth/register').send(valid).expect(201);

    const response = await request(ctx.app).post('/api/auth/register').send(valid);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['a missing name', { email: 'a@b.com', password: 'sup3r-secret' }],
    ['a one-character name', { name: 'A', email: 'a@b.com', password: 'sup3r-secret' }],
    ['a malformed email', { name: 'Ada', email: 'not-an-email', password: 'sup3r-secret' }],
    ['a short password', { name: 'Ada', email: 'a@b.com', password: 'short' }],
    ['no body at all', {}],
  ])('returns 422 for %s', async (_label, body) => {
    const response = await request(ctx.app).post('/api/auth/register').send(body);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it('ignores a role field supplied by the client', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...valid, role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('CUSTOMER');
  });
});

describe('POST /api/auth/login', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = createTestContext();
    await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'sup3r-secret' })
      .expect(201);
  });

  afterEach(() => ctx.cleanup());

  it('returns 200 and a token for valid credentials', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'sup3r-secret' });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeTypeOf('string');
    expect(response.body.data.user.email).toBe('ada@example.com');
  });

  it('returns 401 for a wrong password', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'nope-nope-nope' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 rather than 404 for an unknown email', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'sup3r-secret' });

    expect(response.status).toBe(401);
  });

  it('returns 422 when the email is missing', async () => {
    const response = await request(ctx.app).post('/api/auth/login').send({ password: 'x' });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('returns the authenticated user', async () => {
    const registered = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'sup3r-secret' })
      .expect(201);

    const response = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('ada@example.com');
  });

  it('returns 401 without a token', async () => {
    const response = await request(ctx.app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns 401 for a garbage token', async () => {
    const response = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.token');

    expect(response.status).toBe(401);
  });

  it('returns 401 when the scheme is not Bearer', async () => {
    const response = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(401);
  });
});

describe('infrastructure endpoints', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('reports health', async () => {
    const response = await request(ctx.app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('returns a JSON 404 for an unknown route', async () => {
    const response = await request(ctx.app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
  });
});
