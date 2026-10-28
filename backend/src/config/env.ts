import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Environment variables are always strings, so booleans need explicit
 * coercion: `Boolean('false')` is `true`, which is exactly the sort of bug
 * that only shows up in the environment you cannot debug.
 */
const booleanish = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes');

/**
 * Environment contract. Parsing it once at start-up means a missing or
 * nonsensical variable fails loudly here instead of surfacing as a confusing
 * runtime error deep inside a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  DATABASE_PATH: z.string().default('./data/dealership.db'),
  CORS_ORIGIN: z.string().default('*'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@dealership.test'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin123!'),

  // Credential-endpoint throttle: 10 failed attempts per 15 minutes per IP.
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Only switch this on when there really is a reverse proxy in front, or
  // X-Forwarded-For becomes a way to spoof an IP past the rate limiter.
  TRUST_PROXY: booleanish.default('false'),

  // Seed demo data on first boot. Intended for a demo deployment whose
  // volume starts empty; it is idempotent, so a restart adds nothing.
  SEED_ON_START: booleanish.default('false'),

  // Single-service mode: serve the built SPA from this API.
  SERVE_SPA: booleanish.default('false'),
  SPA_DIST_PATH: z.string().default('../frontend/dist'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Reads configuration lazily so that test files can set `process.env` in a
 * setup hook before the first access.
 */
let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
    }

    cached = parsed.data;
  }

  return cached;
}

/** Test-only escape hatch: forget the parsed environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
