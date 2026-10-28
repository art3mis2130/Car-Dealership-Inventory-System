import { VEHICLE_CATEGORIES } from '../types/index.js';

/**
 * The OpenAPI description of this API.
 *
 * Written by hand rather than generated, so the prose can explain *why* an
 * endpoint behaves as it does. The risk with a hand-written spec is drift, so
 * there is a test that walks every path and method documented here and asserts
 * the route actually exists - a documented endpoint that 404s fails the build.
 */

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, message: { type: 'string' } },
          },
        },
        requestId: { type: 'string', description: 'Matches the X-Request-Id response header' },
      },
      required: ['code', 'message'],
    },
  },
} as const;

/** Wraps a payload schema in the standard success envelope. */
function success(dataSchema: unknown, meta?: unknown) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: dataSchema,
      ...(meta ? { meta } : {}),
    },
  };
}

function errors(...codes: number[]) {
  const map: Record<string, { description: string; content: unknown }> = {};
  const descriptions: Record<number, string> = {
    400: 'Malformed JSON body',
    401: 'Missing, malformed or expired token',
    403: 'Authenticated, but the role is not permitted',
    404: 'No such resource',
    409: 'Conflicts with existing state (duplicate listing, or insufficient stock)',
    413: 'Request body too large',
    422: 'Validation failed; see error.details for the offending fields',
    429: 'Too many attempts on a credential endpoint',
    503: 'The database could not be reached',
  };

  for (const code of codes) {
    map[String(code)] = {
      description: descriptions[code] ?? 'Error',
      content: { 'application/json': { schema: errorResponse } },
    };
  }

  return map;
}

const User = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Ada Lovelace' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['ADMIN', 'CUSTOMER'] },
    createdAt: { type: 'string' },
  },
} as const;

const Vehicle = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    make: { type: 'string', example: 'Toyota' },
    model: { type: 'string', example: 'Corolla' },
    category: { type: 'string', enum: [...VEHICLE_CATEGORIES] },
    year: { type: 'integer', example: 2023 },
    price: { type: 'number', example: 21500 },
    quantity: { type: 'integer', minimum: 0, example: 4 },
    description: { type: 'string', nullable: true },
    imageUrl: { type: 'string', nullable: true, format: 'uri' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const Purchase = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    vehicleId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    quantity: { type: 'integer', minimum: 1 },
    unitPrice: { type: 'number', description: 'The price at the moment of purchase' },
    totalPrice: { type: 'number' },
    purchasedAt: { type: 'string' },
  },
} as const;

const searchMeta = {
  type: 'object',
  properties: {
    total: { type: 'integer', description: 'Matches before pagination' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
} as const;

const vehicleBody = {
  type: 'object',
  required: ['make', 'model', 'category', 'year', 'price', 'quantity'],
  properties: {
    make: { type: 'string', maxLength: 60 },
    model: { type: 'string', maxLength: 60 },
    category: { type: 'string', enum: [...VEHICLE_CATEGORIES] },
    year: { type: 'integer', minimum: 1900 },
    price: { type: 'number', minimum: 0 },
    quantity: { type: 'integer', minimum: 0 },
    description: { type: 'string', nullable: true, maxLength: 500 },
    imageUrl: {
      type: 'string',
      nullable: true,
      format: 'uri',
      description: 'http(s) only; other schemes are rejected',
    },
  },
} as const;

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
} as const;

const searchParams = [
  {
    name: 'q',
    in: 'query',
    schema: { type: 'string' },
    description: 'Free text across make, model, category and description',
  },
  {
    name: 'make',
    in: 'query',
    schema: { type: 'string' },
    description: 'Partial, case-insensitive',
  },
  {
    name: 'model',
    in: 'query',
    schema: { type: 'string' },
    description: 'Partial, case-insensitive',
  },
  {
    name: 'category',
    in: 'query',
    schema: { type: 'string' },
    description: 'Exact, case-insensitive',
  },
  { name: 'minPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
  { name: 'maxPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
  { name: 'minYear', in: 'query', schema: { type: 'integer' } },
  { name: 'maxYear', in: 'query', schema: { type: 'integer' } },
  {
    name: 'availableOnly',
    in: 'query',
    schema: { type: 'boolean' },
    description: 'Hide sold-out listings',
  },
  {
    name: 'sort',
    in: 'query',
    schema: {
      type: 'string',
      enum: ['newest', 'oldest', 'price_asc', 'price_desc', 'year_desc', 'year_asc'],
      default: 'newest',
    },
  },
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 12 },
  },
] as const;

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Apex Motors - Dealership Inventory API',
    version: '1.0.0',
    description: [
      'REST API for a car dealership inventory system.',
      '',
      '**Response envelope.** Every success is `{ "success": true, "data": ..., "meta"?: ... }`',
      'and every failure is `{ "success": false, "error": { "code", "message", "details"?, "requestId" } }`.',
      'One shape means a client needs exactly one response handler.',
      '',
      '**Authentication.** `POST /auth/login` returns a JWT; send it as `Authorization: Bearer <token>`.',
      'Registration always creates a CUSTOMER - the role is assigned server-side and a `role` field in',
      'the request body is stripped, so an account cannot promote itself. Admins are created by the',
      'seed script.',
      '',
      '**Permissions.** Any signed-in user may browse, search and purchase. Creating, updating,',
      'deleting and restocking require the ADMIN role.',
      '',
      '**Stock safety.** A purchase decrements stock inside a transaction, guarded in the UPDATE',
      'itself (`WHERE quantity >= ?`), so concurrent buyers cannot oversell the last car; the loser',
      'receives a 409.',
    ].join('\n'),
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/api', description: 'This server' },
    { url: 'http://localhost:4000/api', description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'Liveness and readiness' },
    { name: 'Auth', description: 'Registration, login and the current session' },
    { name: 'Vehicles', description: 'The catalogue' },
    { name: 'Inventory', description: 'Stock movements and purchase history' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: { User, Vehicle, Purchase },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness and database readiness',
        description:
          'Actually queries the database rather than returning a constant, and answers 503 when that fails.',
        security: [],
        responses: {
          200: {
            description: 'Healthy',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    database: { type: 'string', enum: ['connected', 'unavailable'] },
                    databaseLatencyMs: { type: 'number' },
                    uptime: { type: 'integer' },
                    timestamp: { type: 'string' },
                  },
                }),
              },
            },
          },
          ...errors(503),
        },
      },
    },

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a customer account',
        description: 'Always creates a CUSTOMER. A `role` field in the body is ignored.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 80 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: { user: User, token: { type: 'string' } },
                }),
              },
            },
          },
          ...errors(400, 409, 422, 429),
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange credentials for a token',
        description:
          'A wrong password and an unknown email fail identically, so the endpoint cannot be used to enumerate registered emails.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@dealership.test' },
                  password: { type: 'string', example: 'Admin123!' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Signed in',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: { user: User, token: { type: 'string' } },
                }),
              },
            },
          },
          ...errors(401, 422, 429),
        },
      },
    },

    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The current user',
        description: 'Used by the SPA to decide whether a stored token is still good.',
        responses: {
          200: {
            description: 'The authenticated user',
            content: {
              'application/json': {
                schema: success({ type: 'object', properties: { user: User } }),
              },
            },
          },
          ...errors(401),
        },
      },
    },

    '/vehicles': {
      get: {
        tags: ['Vehicles'],
        summary: 'List vehicles',
        description: 'Identical to /vehicles/search with no filters.',
        parameters: [...searchParams],
        responses: {
          200: {
            description: 'A page of vehicles',
            content: {
              'application/json': {
                schema: success(
                  { type: 'object', properties: { vehicles: { type: 'array', items: Vehicle } } },
                  searchMeta,
                ),
              },
            },
          },
          ...errors(401, 422),
        },
      },
      post: {
        tags: ['Vehicles'],
        summary: 'Add a vehicle (admin)',
        description:
          'The same make, model and year twice is a conflict: that is a restock, not a second listing.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: vehicleBody } },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: success({ type: 'object', properties: { vehicle: Vehicle } }),
              },
            },
          },
          ...errors(401, 403, 409, 422),
        },
      },
    },

    '/vehicles/search': {
      get: {
        tags: ['Vehicles'],
        summary: 'Search the catalogue',
        description:
          'Filters combine with AND. Search terms are matched literally: a term containing % or _ does not behave as a wildcard.',
        parameters: [...searchParams],
        responses: {
          200: {
            description: 'Matching vehicles',
            content: {
              'application/json': {
                schema: success(
                  { type: 'object', properties: { vehicles: { type: 'array', items: Vehicle } } },
                  searchMeta,
                ),
              },
            },
          },
          ...errors(401, 422),
        },
      },
    },

    '/vehicles/filters': {
      get: {
        tags: ['Vehicles'],
        summary: 'Distinct makes and categories',
        description: 'Drives the filter dropdowns without the client fetching every vehicle.',
        responses: {
          200: {
            description: 'Available filter values',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: {
                    makes: { type: 'array', items: { type: 'string' } },
                    categories: { type: 'array', items: { type: 'string' } },
                  },
                }),
              },
            },
          },
          ...errors(401),
        },
      },
    },

    '/vehicles/{id}': {
      get: {
        tags: ['Vehicles'],
        summary: 'One vehicle',
        parameters: [idParam],
        responses: {
          200: {
            description: 'The vehicle',
            content: {
              'application/json': {
                schema: success({ type: 'object', properties: { vehicle: Vehicle } }),
              },
            },
          },
          ...errors(401, 404),
        },
      },
      put: {
        tags: ['Vehicles'],
        summary: 'Update a vehicle (admin)',
        description: 'Partial: send only the fields that change. An empty body is a 422.',
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { ...vehicleBody, required: [] } },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': {
                schema: success({ type: 'object', properties: { vehicle: Vehicle } }),
              },
            },
          },
          ...errors(401, 403, 404, 409, 422),
        },
      },
      delete: {
        tags: ['Vehicles'],
        summary: 'Delete a vehicle (admin)',
        description: 'Past purchases keep their records; the history shows a delisted vehicle.',
        parameters: [idParam],
        responses: {
          204: { description: 'Deleted' },
          ...errors(401, 403, 404),
        },
      },
    },

    '/vehicles/{id}/purchase': {
      post: {
        tags: ['Inventory'],
        summary: 'Buy a vehicle',
        description:
          'Decrements stock and writes a ledger entry in one transaction. 409 if stock is insufficient, including when another buyer wins the race for the last one.',
        parameters: [idParam],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantity: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Purchased',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: { purchase: Purchase, vehicle: Vehicle },
                }),
              },
            },
          },
          ...errors(401, 404, 409, 422),
        },
      },
    },

    '/vehicles/{id}/restock': {
      post: {
        tags: ['Inventory'],
        summary: 'Add stock (admin)',
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity'],
                properties: { quantity: { type: 'integer', minimum: 1, maximum: 10000 } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Restocked',
            content: {
              'application/json': {
                schema: success({ type: 'object', properties: { vehicle: Vehicle } }),
              },
            },
          },
          ...errors(401, 403, 404, 422),
        },
      },
    },

    '/purchases/me': {
      get: {
        tags: ['Inventory'],
        summary: "The caller's own purchase history",
        description:
          'Newest first, with the vehicle attached. A purchase of a since-deleted listing still appears, with vehicle: null.',
        responses: {
          200: {
            description: 'Purchase history',
            content: {
              'application/json': {
                schema: success({
                  type: 'object',
                  properties: { purchases: { type: 'array', items: Purchase } },
                }),
              },
            },
          },
          ...errors(401),
        },
      },
    },
  },
} as const;
