// Authentication Use Cases - Application Layer
// Follows Single Responsibility and Dependency Inversion principles

import {
  User,
  CreateUserDto,
  UpdateUserDto,
  AuthenticationResult,
  TokenPayload,
} from '../domain/user.types';
import { TokenValidator } from '../domain/auth.types';
import { UserRepository } from '../infrastructure/firestore-user.repository';
import { logger } from '../utils/logger';

export class AuthenticationUseCase {
  private tokenValidator: TokenValidator;
  private userRepository: UserRepository;

  constructor(tokenValidator: TokenValidator, userRepository: UserRepository) {
    this.tokenValidator = tokenValidator;
    this.userRepository = userRepository;
  }

  // Login or register user with Google OIDC token
  async loginWithGoogleToken(idToken: string): Promise<AuthenticationResult> {
    try {
      // Validate the token
      const validationResult = await this.tokenValidator.validateToken(idToken);

      if (!validationResult.isValid || !validationResult.payload) {
        return {
          success: false,
          error: validationResult.error || {
            type: 'INVALID_TOKEN',
            message: 'Token validation failed',
          },
        };
      }

      const tokenPayload = validationResult.payload;

      // Check if user already exists
      let user = await this.userRepository.findById(tokenPayload.sub);

      if (user) {
        // User exists, update last login
        await this.userRepository.updateLastLogin(user.id);
        logger.info(`User logged in: ${user.email} (${user.id})`);
      } else {
        // User doesn't exist, create new user
        user = await this.createUserFromToken(tokenPayload);
        logger.info(`New user created and logged in: ${user.email} (${user.id})`);
      }

      return {
        success: true,
        user,
        token: idToken,
      };
    } catch (error) {
      logger.error('Login failed:', error);
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Login failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Get user profile by ID
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      return await this.userRepository.findById(userId);
    } catch (error) {
      logger.error(`Failed to get user profile for ${userId}:`, error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: UpdateUserDto): Promise<User | null> {
    try {
      const updatedUser = await this.userRepository.update(userId, updates);
      if (updatedUser) {
        logger.info(`User profile updated: ${userId}`);
      }
      return updatedUser;
    } catch (error) {
      logger.error(`Failed to update user profile for ${userId}:`, error);
      return null;
    }
  }

  // Delete user account
  async deleteUserAccount(userId: string): Promise<boolean> {
    try {
      const success = await this.userRepository.delete(userId);
      if (success) {
        logger.info(`User account deleted: ${userId}`);
      }
      return success;
    } catch (error) {
      logger.error(`Failed to delete user account for ${userId}:`, error);
      return false;
    }
  }

  // Check if user exists
  async userExists(userId: string): Promise<boolean> {
    try {
      return await this.userRepository.exists(userId);
    } catch (error) {
      logger.error(`Failed to check user existence for ${userId}:`, error);
      return false;
    }
  }

  // Validate token and return user context
  async validateTokenAndGetUser(token: string): Promise<AuthenticationResult> {
    try {
      // Validate the token
      const validationResult = await this.tokenValidator.validateToken(token);

      if (!validationResult.isValid || !validationResult.payload) {
        return {
          success: false,
          error: validationResult.error || {
            type: 'INVALID_TOKEN',
            message: 'Token validation failed',
          },
        };
      }

      // Get user from database
      const user = await this.userRepository.findById(validationResult.payload.sub);

      if (!user) {
        return {
          success: false,
          error: {
            type: 'USER_NOT_FOUND',
            message: 'User not found in database',
          },
        };
      }

      return {
        success: true,
        user,
        token,
      };
    } catch (error) {
      logger.error('Token validation failed:', error);
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Token validation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Private helper to create user from token payload
  private async createUserFromToken(tokenPayload: TokenPayload): Promise<User> {
    const createUserDto: CreateUserDto = {
      id: tokenPayload.sub,
      email: tokenPayload.email,
      name: tokenPayload.name,
      profilePictureUrl: tokenPayload.picture,
    };

    return await this.userRepository.create(createUserDto);
  }
}
