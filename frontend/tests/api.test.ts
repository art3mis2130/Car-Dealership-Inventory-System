import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, buildQueryString } from '../src/lib/api.js';

/** Builds a fetch stub that always answers with the given status and body. */
function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildQueryString', () => {
  it('returns an empty string when there is nothing to send', () => {
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('serialises the values that are set', () => {
    expect(buildQueryString({ make: 'Toyota', minPrice: 1000 })).toBe('?make=Toyota&minPrice=1000');
  });

  it('drops cleared filters instead of sending empty values', () => {
    // An empty select must disappear from the URL, not arrive as make="".
    expect(
      buildQueryString({
        make: '',
        model: undefined,
        category: null,
        availableOnly: false,
        q: 'suv',
      }),
    ).toBe('?q=suv');
  });

  it('encodes characters that are unsafe in a URL', () => {
    expect(buildQueryString({ q: 'F-150 & more' })).toBe('?q=F-150+%26+more');
  });
});

describe('ApiClient', () => {
  it('unwraps the success envelope', async () => {
    stubFetch(200, { success: true, data: { user: { id: 'u1' } } });

    const client = new ApiClient(() => null, 'http://api.test');

    await expect(client.me()).resolves.toEqual({ user: { id: 'u1' } });
  });

  it('attaches the bearer token when there is one', async () => {
    const fetchMock = stubFetch(200, { success: true, data: { vehicles: [] }, meta: {} });

    await new ApiClient(() => 'tok-123', 'http://api.test').searchVehicles();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('sends no Authorization header when signed out', async () => {
    const fetchMock = stubFetch(200, { success: true, data: { user: null } });

    await new ApiClient(() => null, 'http://api.test').me();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('reads the current token each call, so a fresh login is picked up', async () => {
    let token: string | null = null;
    const fetchMock = stubFetch(200, { success: true, data: { user: null } });
    const client = new ApiClient(() => token, 'http://api.test');

    await client.me();
    token = 'after-login';
    await client.me();

    const [, second] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((second.headers as Record<string, string>).Authorization).toBe('Bearer after-login');
  });

  it('turns an error envelope into an ApiError carrying the code and details', async () => {
    stubFetch(422, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'price', message: 'Price cannot be negative' }],
      },
    });

    const client = new ApiClient(() => null, 'http://api.test');

    await expect(client.createVehicle({} as never)).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'price', message: 'Price cannot be negative' }],
    });
  });

  it('flags a 401 so the UI knows to sign out', async () => {
    stubFetch(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } });

    const client = new ApiClient(() => 'stale-token', 'http://api.test');
    const error = await client.me().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isAuthFailure).toBe(true);
  });

  it('survives a response that is not JSON at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 502,
        ok: false,
        json: () => Promise.reject(new Error('not json')),
      }),
    );

    await expect(new ApiClient(() => null, 'http://api.test').me()).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('handles a 204 with no body (delete)', async () => {
    stubFetch(204, null);

    await expect(
      new ApiClient(() => 'tok', 'http://api.test').deleteVehicle('v1'),
    ).resolves.toBeUndefined();
  });

  it('puts search filters in the query string, not the body', async () => {
    const fetchMock = stubFetch(200, { success: true, data: { vehicles: [] }, meta: {} });

    await new ApiClient(() => 'tok', 'http://api.test').searchVehicles({
      make: 'Tesla',
      maxPrice: 50000,
      availableOnly: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://api.test/vehicles/search?make=Tesla&maxPrice=50000&availableOnly=true',
    );
    expect(init.body).toBeUndefined();
  });
});
