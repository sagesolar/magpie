// User Context Resolver - Infrastructure Layer
// Follows Single Responsibility and Dependency Inversion principles

import {
  UserContextResolver,
  TokenValidator,
  UserContext,
  AuthenticatedUser,
  AnonymousUser,
} from '../domain/auth.types';
import { UserRepository } from './firestore-user.repository';
import { logger } from '../utils/logger';

export class UserContextResolverImpl implements UserContextResolver {
  private tokenValidator: TokenValidator;
  private userRepository: UserRepository;

  constructor(tokenValidator: TokenValidator, userRepository: UserRepository) {
    this.tokenValidator = tokenValidator;
    this.userRepository = userRepository;
  }

  async resolveContext(token?: string): Promise<UserContext> {
    // If no token provided, return anonymous user
    if (!token) {
      return this.createAnonymousContext();
    }

    try {
      // Validate the token
      const validationResult = await this.tokenValidator.validateToken(token);

      if (!validationResult.isValid || !validationResult.payload) {
        logger.info('Token validation failed, returning anonymous context');
        return this.createAnonymousContext();
      }

      // Check if user exists in our database
      const user = await this.userRepository.findById(validationResult.payload.sub);

      if (!user) {
        logger.info(
          `User not found in database: ${validationResult.payload.sub}, returning anonymous context`
        );
        return this.createAnonymousContext();
      }

      // Update last login time (non-blocking)
      this.userRepository.updateLastLogin(user.id).catch(error => {
        logger.warn(
          `Failed to update last login for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      });

      // Return authenticated user context
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        isAuthenticated: true,
      };

      logger.info(`User context resolved for: ${user.email} (${user.id})`);
      return authenticatedUser;
    } catch (error) {
      logger.error('Error resolving user context:', error);
      return this.createAnonymousContext();
    }
  }

  private createAnonymousContext(): AnonymousUser {
    return {
      isAuthenticated: false,
    };
  }
}
