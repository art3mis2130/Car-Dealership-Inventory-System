import { Router, type RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { Container } from '../container.js';
import { createAuthRouter } from './authRoutes.js';
import { createPurchaseRouter, createVehicleRouter } from './vehicleRoutes.js';
import { createAuthRateLimiter, type RateLimitOptions } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { openApiDocument } from '../docs/openapi.js';

/**
 * Swagger UI ships an inline bootstrap script, which the global
 * Content-Security-Policy would block. Relaxed for this route only, rather
 * than weakening the policy for the whole API.
 */
const relaxCspForSwaggerUi: RequestHandler = (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
};

/** Mounts every feature router under /api. */
export function createApiRouter(container: Container, rateLimit: RateLimitOptions): Router {
  const router = Router();

  // Unthrottled and unauthenticated on purpose: a load balancer polls this.
  router.get('/health', asyncHandler(container.healthController.check));

  // The machine-readable contract, and a browsable UI over it. Public: an API
  // description is not a secret, and being able to point someone at /api/docs
  // is most of the value.
  router.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  router.use(
    '/docs',
    // Swagger UI serves its own inline bootstrap script, which the global CSP
    // would otherwise block; relaxed for this route only.
    relaxCspForSwaggerUi,
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Apex Motors API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  // The throttle is applied here rather than inside the auth router, so that
  // "which routes are rate limited" is answered in the same place as "which
  // routes exist".
  router.use('/auth', createAuthRateLimiter(rateLimit), createAuthRouter(container.authController));
  router.use('/vehicles', createVehicleRouter(container.vehicleController));
  router.use('/purchases', createPurchaseRouter(container.vehicleController));

  return router;
}
