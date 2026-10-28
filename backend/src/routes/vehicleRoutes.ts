import { Router } from 'express';
import type { VehicleController } from '../controllers/vehicleController.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Every vehicle route requires a signed-in user; writes additionally require
 * an admin. Declaring it here keeps the whole permission model readable at a
 * glance, which is exactly what you want to be able to audit.
 */
export function createVehicleRouter(controller: VehicleController): Router {
  const router = Router();

  router.use(authenticate);

  // Literal paths must be declared before "/:id", or "search" would be
  // interpreted as a vehicle id.
  router.get('/search', asyncHandler(controller.search));
  router.get('/filters', asyncHandler(controller.filters));

  router.get('/', asyncHandler(controller.search));
  router.get('/:id', asyncHandler(controller.findOne));

  router.post('/', requireAdmin, asyncHandler(controller.create));
  router.put('/:id', requireAdmin, asyncHandler(controller.update));
  router.delete('/:id', requireAdmin, asyncHandler(controller.remove));

  // Anyone signed in may buy; only an admin may put stock back on the lot.
  router.post('/:id/purchase', asyncHandler(controller.purchase));
  router.post('/:id/restock', requireAdmin, asyncHandler(controller.restock));

  return router;
}

/** GET /api/purchases/me - the signed-in user's own purchase history. */
export function createPurchaseRouter(controller: VehicleController): Router {
  const router = Router();

  router.use(authenticate);
  router.get('/me', asyncHandler(controller.myPurchases));

  return router;
}
