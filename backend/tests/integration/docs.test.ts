import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, type TestContext } from '../helpers/testApp.js';
import { listRoutes } from '../helpers/routeTable.js';
import { openApiDocument } from '../../src/docs/openapi.js';

/**
 * Endpoints that exist but are intentionally absent from the spec: the
 * documentation endpoints themselves. Listing them here means adding any
 * *other* undocumented route still fails the build.
 */
const UNDOCUMENTED_BY_DESIGN = ['GET /api/openapi.json'];

/** Every "METHOD /api/path" the OpenAPI document claims to describe. */
function documentedRoutes(): string[] {
  return Object.entries(openApiDocument.paths)
    .flatMap(([path, operations]) =>
      Object.keys(operations).map((method) => `${method.toUpperCase()} /api${path}`),
    )
    .sort();
}

describe('API documentation', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => ctx.cleanup());

  it('serves the OpenAPI document as JSON', async () => {
    const response = await request(ctx.app).get('/api/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info.title).toContain('Dealership');
    expect(Object.keys(response.body.paths).length).toBeGreaterThan(5);
  });

  it('serves a browsable UI', async () => {
    const response = await request(ctx.app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/swagger/i);
  });

  it('declares bearer authentication', () => {
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('marks the admin-only endpoints as such', () => {
    const adminOnly = [
      openApiDocument.paths['/vehicles'].post.summary,
      openApiDocument.paths['/vehicles/{id}'].put.summary,
      openApiDocument.paths['/vehicles/{id}'].delete.summary,
      openApiDocument.paths['/vehicles/{id}/restock'].post.summary,
    ];

    for (const summary of adminOnly) {
      expect(summary.toLowerCase()).toContain('admin');
    }
  });

  /*
   * The anti-drift pair.
   *
   * A hand-written spec is worth having - it can explain *why* an endpoint
   * behaves as it does - but it rots the moment a route is renamed. These two
   * tests compare it against the routes Express actually registered, in both
   * directions, so neither a lying document nor an undocumented endpoint can
   * survive a test run.
   */
  it('documents nothing that does not exist', () => {
    const registered = new Set(listRoutes(ctx.app));
    const lies = documentedRoutes().filter((route) => !registered.has(route));

    expect(lies, 'documented but not registered').toEqual([]);
  });

  it('leaves nothing that exists undocumented', () => {
    const documented = new Set([...documentedRoutes(), ...UNDOCUMENTED_BY_DESIGN]);

    const undocumented = listRoutes(ctx.app)
      .filter((route) => route.startsWith('GET /api') || route.includes(' /api/'))
      .filter((route) => !documented.has(route));

    expect(undocumented, 'registered but not documented').toEqual([]);
  });

  it('finds the routes it claims to check, so the check cannot silently pass', () => {
    // A guard on the guard: if listRoutes ever returned [], both tests above
    // would pass vacuously.
    const registered = listRoutes(ctx.app);

    expect(registered.length).toBeGreaterThanOrEqual(11);
    expect(registered).toContain('GET /api/health');
    expect(registered).toContain('POST /api/vehicles/{id}/purchase');
  });
});
