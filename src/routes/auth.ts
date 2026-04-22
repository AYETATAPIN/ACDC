import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthController } from '../controllers/authController.js';

export const createAuthRouter = (controller: AuthController) => {
  const router = Router();

  router.post('/register', asyncHandler(controller.register));
  router.post('/login', asyncHandler(controller.login));
  router.get('/me', requireAuth, asyncHandler(controller.me));
  router.post('/logout', requireAuth, asyncHandler(controller.logout));

  return router;
};
