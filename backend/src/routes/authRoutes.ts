import { Router } from 'express';
import type { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** POST /register, POST /login (public) and GET /me (protected). */
export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post('/register', asyncHandler(controller.register));
  router.post('/login', asyncHandler(controller.login));
  router.get('/me', authenticate, asyncHandler(controller.me));

  return router;
}
