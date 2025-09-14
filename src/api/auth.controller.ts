// Authentication Controller - API Layer
import { Request, Response, NextFunction } from 'express';
import { AuthenticationUseCase } from '../application/auth.usecase';
import { getAuthenticatedUser, isAuthenticated } from '../infrastructure/auth.middleware';
import { z } from 'zod';

// Validation schemas for authentication endpoints
const GoogleTokenSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  profilePictureUrl: z.string().url().optional(),
  preferences: z
    .object({
      sortingStyle: z.enum(['chronological', 'alphabetical', 'genre', 'personal']).optional(),
      sharingVisibility: z.enum(['private', 'friends', 'public']).optional(),
      notifications: z
        .object({
          newBooks: z.boolean(),
          loanReminders: z.boolean(),
          sharedCollections: z.boolean(),
        })
        .optional(),
      theme: z.enum(['light', 'dark', 'auto']).optional(),
      booksPerPage: z.number().int().min(1).max(100).optional(),
      defaultView: z.enum(['grid', 'list', 'compact']).optional(),
    })
    .optional(),
});

export class AuthController {
  constructor(private authUseCase: AuthenticationUseCase) {}

  // POST /auth/login - Login with Google OIDC
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idToken } = GoogleTokenSchema.parse(req.body);

      const result = await this.authUseCase.loginWithGoogleToken(idToken);

      if (!result.success) {
        res.status(401).json({
          error: 'Authentication failed',
          message: result.error?.message || 'Invalid token',
          type: result.error?.type,
        });
        return;
      }

      res.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };

  // GET /auth/profile - Get current user profile
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);

      const profile = await this.authUseCase.getUserProfile(user.id);

      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  // PUT /auth/profile - Update user profile
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const updates = UpdateProfileSchema.parse(req.body);

      const updatedProfile = await this.authUseCase.updateUserProfile(user.id, updates);

      if (!updatedProfile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json(updatedProfile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };

  // DELETE /auth/profile - Delete user account
  deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);

      const success = await this.authUseCase.deleteUserAccount(user.id);

      if (!success) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/validate - Validate current token
  validateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!isAuthenticated(req)) {
        res.status(401).json({ error: 'No valid authentication found' });
        return;
      }

      const user = getAuthenticatedUser(req);

      // Get full profile
      const profile = await this.authUseCase.getUserProfile(user.id);

      res.json({
        valid: true,
        user: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /auth/logout - Logout (client-side token removal)
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Since we're using stateless JWT tokens, logout is primarily client-side
      // The client should remove the token from storage
      res.json({
        success: true,
        message: 'Logged out successfully. Please remove the token from client storage.',
      });
    } catch (error) {
      next(error);
    }
  };
}
