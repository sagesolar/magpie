// Authentication Middleware - Infrastructure Layer
// Follows Single Responsibility and Open/Closed principles

import { Request, Response, NextFunction } from 'express';
import { UserContextResolver, UserContext, AuthenticatedUser } from '../domain/auth.types';
import { logger } from '../utils/logger';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
      user?: AuthenticatedUser; // Convenience property for authenticated users
    }
  }
}

export interface AuthMiddlewareConfig {
  requireAuth?: boolean; // Whether authentication is required for this endpoint
  allowAnonymous?: boolean; // Whether anonymous users can access this endpoint
}

export class AuthenticationMiddleware {
  private userContextResolver: UserContextResolver;

  constructor(userContextResolver: UserContextResolver) {
    this.userContextResolver = userContextResolver;
  }

  // Main authentication middleware
  authenticate(config: AuthMiddlewareConfig = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader : undefined;

        // Resolve user context
        const userContext = await this.userContextResolver.resolveContext(token);

        // Attach context to request
        req.userContext = userContext;

        // If user is authenticated, also set convenience property
        if (userContext.isAuthenticated) {
          req.user = userContext as AuthenticatedUser;
        }

        // Check authentication requirements
        if (config.requireAuth && !userContext.isAuthenticated) {
          logger.info(
            `Authentication required but user not authenticated for ${req.method} ${req.path}`
          );
          res.status(401).json({
            error: 'Authentication required',
            message: 'You must be logged in to access this resource',
          });
          return;
        }

        // Check if anonymous access is explicitly allowed
        if (
          !config.allowAnonymous &&
          config.requireAuth === undefined &&
          !userContext.isAuthenticated
        ) {
          logger.info(`Anonymous access not allowed for ${req.method} ${req.path}`);
          res.status(401).json({
            error: 'Authentication required',
            message: 'You must be logged in to access this resource',
          });
          return;
        }

        // Log successful authentication
        if (userContext.isAuthenticated) {
          logger.info(
            `Authenticated user ${userContext.email} accessing ${req.method} ${req.path}`
          );
        } else {
          logger.info(`Anonymous user accessing ${req.method} ${req.path}`);
        }

        next();
      } catch (error) {
        logger.error(
          `Authentication middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        res.status(500).json({
          error: 'Authentication error',
          message: 'An error occurred during authentication',
        });
      }
    };
  }

  // Middleware that requires authentication
  requireAuth() {
    return this.authenticate({ requireAuth: true });
  }

  // Middleware that allows anonymous access
  allowAnonymous() {
    return this.authenticate({ allowAnonymous: true });
  }

  // Middleware that extracts user context but doesn't require authentication
  extractContext() {
    return this.authenticate({ allowAnonymous: true, requireAuth: false });
  }
}

// Helper function to check if user is authenticated (for use in route handlers)
export function isAuthenticated(req: Request): req is Request & { user: AuthenticatedUser } {
  return req.userContext?.isAuthenticated === true;
}

// Helper function to get authenticated user (throws if not authenticated)
export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!isAuthenticated(req)) {
    throw new Error('User is not authenticated');
  }
  return req.user;
}

// Helper function to get user ID safely
export function getUserId(req: Request): string | null {
  return isAuthenticated(req) ? req.user.id : null;
}
