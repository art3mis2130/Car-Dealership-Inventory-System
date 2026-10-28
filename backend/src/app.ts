import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Database } from 'better-sqlite3';
import { getEnv } from './config/env.js';
import { buildContainer } from './container.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import type { RateLimitOptions } from './middleware/rateLimit.js';
import { serveSpa, type SpaOptions } from './middleware/serveSpa.js';

export interface AppOptions {
  /** Overrides the env-configured throttle. Tests use a deliberately tiny one. */
  authRateLimit?: RateLimitOptions;
  /** Overrides single-service mode, so it can be tested without a container. */
  spa?: SpaOptions;
}

/**
 * Builds the Express application around a database handle.
 *
 * Taking the database as an argument (rather than opening one inside) is what
 * lets the integration suite run the real app against a throwaway file, and
 * would let a future worker process share the same wiring.
 */
export function createApp(db: Database, options: AppOptions = {}): Express {
  const env = getEnv();
  const app = express();

  // Behind a reverse proxy (Render, Fly, nginx) the client IP arrives in
  // X-Forwarded-For. Opt in explicitly: trusting it unconditionally would let
  // anyone spoof their IP and walk straight past the rate limiter.
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  // Order matters. The id comes first so every later log line and error can
  // quote it; security headers go on before anything can respond.
  app.use(requestId);
  app.use(
    helmet({
      // The API serves JSON, and in single-service mode the built SPA. The
      // default CSP would block the bundle's own styles, so it is tuned
      // rather than disabled.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", ...env.CORS_ORIGIN.split(',').map((origin) => origin.trim())],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'sameorigin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(compression());
  app.use(requestLogger);

  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  const rateLimitOptions: RateLimitOptions = options.authRateLimit ?? {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  };

  app.use('/api', createApiRouter(buildContainer(db), rateLimitOptions));

  // Optional single-service mode: serve the built frontend from this process
  // too, so a deploy can be one container instead of two.
  serveSpa(app, options.spa ?? { enabled: env.SERVE_SPA, distPath: env.SPA_DIST_PATH });

  // Order matters: unmatched routes first, then the error translator last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
