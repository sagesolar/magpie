// Express routes for Authentication API
import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthenticationMiddleware } from '../infrastructure/auth.middleware';

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: AuthenticationMiddleware
): Router {
  const router = Router();

  // Public authentication routes
  router.post('/auth/login', authController.login);
  router.post('/auth/logout', authController.logout);
  router.post('/auth/validate', authMiddleware.extractContext(), authController.validateToken);

  // Protected profile routes
  router.get('/auth/profile', authMiddleware.requireAuth(), authController.getProfile);
  router.put('/auth/profile', authMiddleware.requireAuth(), authController.updateProfile);
  router.delete('/auth/profile', authMiddleware.requireAuth(), authController.deleteAccount);

  return router;
}
