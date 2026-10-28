import type {
  Purchase,
  SearchMeta,
  User,
  Vehicle,
  VehicleFilters,
  VehicleInput,
} from '../types/index.js';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

/** An error carrying the status and machine-readable code the API returned. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the server rejected our credentials, so the UI should sign out. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

type TokenReader = () => string | null;

/** The two response shapes the API can return, mirroring `utils/http.ts`. */
type Envelope<T, M> =
  | { success: true; data: T; meta?: M }
  | {
      success: false;
      error: { code?: string; message?: string; details?: { field: string; message: string }[] };
    };

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * The single place the frontend talks to the network.
 *
 * Every component goes through these methods, so the auth header, the
 * response envelope and error translation are each written exactly once. The
 * token is read through a callback rather than captured, so the client picks
 * up a fresh login without being rebuilt.
 */
export class ApiClient {
  constructor(
    private readonly getToken: TokenReader,
    private readonly baseUrl: string = API_URL,
  ) {}

  // Auth ---------------------------------------------------------------

  register(input: { name: string; email: string; password: string }) {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: input,
    });
  }

  login(input: { email: string; password: string }) {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: input,
    });
  }

  me() {
    return this.request<{ user: User }>('/auth/me');
  }

  // Vehicles -----------------------------------------------------------

  async searchVehicles(
    filters: VehicleFilters = {},
    signal?: AbortSignal,
  ): Promise<{ vehicles: Vehicle[]; meta: SearchMeta }> {
    const { data, meta } = await this.requestWithMeta<{ vehicles: Vehicle[] }, SearchMeta>(
      '/vehicles/search',
      { query: filters as Record<string, unknown>, signal },
    );

    return { vehicles: data.vehicles, meta };
  }

  getVehicle(id: string) {
    return this.request<{ vehicle: Vehicle }>(`/vehicles/${id}`);
  }

  filterOptions() {
    return this.request<{ makes: string[]; categories: string[] }>('/vehicles/filters');
  }

  createVehicle(input: VehicleInput) {
    return this.request<{ vehicle: Vehicle }>('/vehicles', { method: 'POST', body: input });
  }

  updateVehicle(id: string, patch: Partial<VehicleInput>) {
    return this.request<{ vehicle: Vehicle }>(`/vehicles/${id}`, { method: 'PUT', body: patch });
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.request<null>(`/vehicles/${id}`, { method: 'DELETE' });
  }

  // Inventory ----------------------------------------------------------

  purchaseVehicle(id: string, quantity = 1) {
    return this.request<{ vehicle: Vehicle; purchase: Purchase }>(`/vehicles/${id}/purchase`, {
      method: 'POST',
      body: { quantity },
    });
  }

  restockVehicle(id: string, quantity: number) {
    return this.request<{ vehicle: Vehicle }>(`/vehicles/${id}/restock`, {
      method: 'POST',
      body: { quantity },
    });
  }

  myPurchases() {
    return this.request<{ purchases: Purchase[] }>('/purchases/me');
  }

  // Transport ----------------------------------------------------------

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { data } = await this.requestWithMeta<T, unknown>(path, options);
    return data;
  }

  private async requestWithMeta<T, M>(
    path: string,
    { method = 'GET', body, query, signal }: RequestOptions = {},
  ): Promise<{ data: T; meta: M }> {
    const token = this.getToken();

    const response = await fetch(`${this.baseUrl}${path}${buildQueryString(query)}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // 204 No Content: nothing to parse.
    if (response.status === 204) {
      return { data: null as T, meta: undefined as M };
    }

    // `response.json()` is typed `any`, so it is narrowed to the envelope
    // shape here and nowhere else. Everything past this point is typed.
    const payload = (await response.json().catch(() => null)) as Envelope<T, M> | null;

    if (!response.ok || payload?.success !== true) {
      const error = payload?.success === false ? payload.error : undefined;

      /*
       * No JSON envelope at all on a 404/405 means the request never reached
       * an API: it was answered by whatever static host is serving the page.
       * Saying "Request failed with status 405" there is useless - it reads
       * like a bug in the app rather than a missing backend.
       */
      if (!payload && (response.status === 404 || response.status === 405)) {
        throw new ApiError(
          'No API is running at this address. If you are viewing the hosted preview, the backend is not deployed yet - see the repository README to run it locally.',
          response.status,
          'API_UNREACHABLE',
        );
      }

      throw new ApiError(
        error?.message ?? `Request failed with status ${response.status}`,
        response.status,
        error?.code ?? 'NETWORK_ERROR',
        error?.details,
      );
    }

    return { data: payload.data, meta: payload.meta as M };
  }
}

/**
 * Serialises a filter object into a query string, dropping empty values so
 * that cleared filters disappear from the URL instead of sending "".
 */
export function buildQueryString(query?: Record<string, unknown>): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;

    // Only primitives belong in a query string; anything else would arrive as
    // the literal "[object Object]".
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }

    params.set(key, String(value));
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}
