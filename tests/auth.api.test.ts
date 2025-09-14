// Authentication API Tests
import request from 'supertest';
import express from 'express';
import { AuthController } from '../src/api/auth.controller';
import { createAuthRoutes } from '../src/api/auth.routes';
import { AuthenticationUseCase } from '../src/application/auth.usecase';
import { AuthenticationMiddleware } from '../src/infrastructure/auth.middleware';
import { User, DEFAULT_USER_PREFERENCES } from '../src/domain/user.types';

describe('AuthController API', () => {
  let app: express.Application;
  let authUseCase: jest.Mocked<AuthenticationUseCase>;
  let authMiddleware: jest.Mocked<AuthenticationMiddleware>;

  beforeEach(() => {
    // Setup mocks
    authUseCase = {
      loginWithGoogleToken: jest.fn(),
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      deleteUserAccount: jest.fn(),
      userExists: jest.fn(),
      validateTokenAndGetUser: jest.fn(),
    } as any;

    authMiddleware = {
      extractContext: jest.fn(),
      requireAuth: jest.fn(),
    } as any;

    // Mock middleware functions
    authMiddleware.extractContext.mockReturnValue(async (req: any, res: any, next: any) => {
      if (req.headers.authorization === 'Bearer valid-token') {
        const userContext = {
          isAuthenticated: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        };
        req.userContext = userContext;
        req.user = userContext.user; // Also set req.user for getAuthenticatedUser helper
      } else {
        req.userContext = { isAuthenticated: false };
      }
      next();
    });

    authMiddleware.requireAuth.mockReturnValue(async (req: any, res: any, next: any) => {
      if (req.headers.authorization === 'Bearer valid-token') {
        const userContext = {
          isAuthenticated: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        };
        req.userContext = userContext;
        req.user = userContext.user; // Also set req.user for getAuthenticatedUser helper
        next();
      } else {
        res.status(401).json({ error: 'Authentication required' });
      }
    });

    const authController = new AuthController(authUseCase);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api', createAuthRoutes(authController, authMiddleware));

    // Error handler
    app.use(
      (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (error.name === 'ZodError') {
          return res.status(400).json({
            error: 'Validation error',
            details: error.errors,
          });
        }

        if (error.message) {
          const statusCode = error.message.includes('not found')
            ? 404
            : error.message.includes('already exists')
              ? 409
              : 400;
          return res.status(statusCode).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid Google token', async () => {
      // Arrange
      const loginData = {
        idToken: 'valid.google.token',
      };

      const mockUser: User = {
        id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        lastLoginAt: new Date('2023-01-03'),
      };

      authUseCase.loginWithGoogleToken.mockResolvedValue({
        success: true,
        user: mockUser,
        token: 'valid.google.token',
      });

      // Act
      const response = await request(app).post('/api/auth/login').send(loginData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'google-user-123',
          email: 'test@example.com',
          name: 'Test User',
          profilePictureUrl: 'https://example.com/picture.jpg',
          preferences: DEFAULT_USER_PREFERENCES,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z',
          lastLoginAt: '2023-01-03T00:00:00.000Z',
        },
        token: 'valid.google.token',
      });

      expect(authUseCase.loginWithGoogleToken).toHaveBeenCalledWith('valid.google.token');
    });

    it('should return 401 for invalid token', async () => {
      // Arrange
      const loginData = {
        idToken: 'invalid.google.token',
      };

      authUseCase.loginWithGoogleToken.mockResolvedValue({
        success: false,
        error: {
          type: 'INVALID_TOKEN',
          message: 'Token validation failed',
        },
      });

      // Act
      const response = await request(app).post('/api/auth/login').send(loginData);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Authentication failed',
        message: 'Token validation failed',
        type: 'INVALID_TOKEN',
      });
    });

    it('should return 400 for missing token', async () => {
      // Act
      const response = await request(app).post('/api/auth/login').send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      // Arrange
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        lastLoginAt: new Date('2023-01-03'),
      };

      authUseCase.getUserProfile.mockResolvedValue(mockUser);

      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        lastLoginAt: '2023-01-03T00:00:00.000Z',
      });

      expect(authUseCase.getUserProfile).toHaveBeenCalledWith('user-123');
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(app).get('/api/auth/profile');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 404 when user not found', async () => {
      // Arrange
      authUseCase.getUserProfile.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Profile not found' });
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Name',
        preferences: {
          theme: 'dark',
          sortingStyle: 'genre',
        },
      };

      const updatedUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          theme: 'dark',
          sortingStyle: 'genre',
        },
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date('2023-01-03'),
      };

      authUseCase.updateUserProfile.mockResolvedValue(updatedUser);

      // Act
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.preferences.theme).toBe('dark');
      expect(response.body.preferences.sortingStyle).toBe('genre');

      expect(authUseCase.updateUserProfile).toHaveBeenCalledWith('user-123', updateData);
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(app).put('/api/auth/profile').send({ name: 'Updated Name' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should handle update failures', async () => {
      // Arrange
      const updateData = { name: 'Updated Name' };
      authUseCase.updateUserProfile.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Profile not found' });
    });
  });

  describe('POST /api/auth/validate', () => {
    it('should validate token successfully', async () => {
      // Arrange
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      authUseCase.getUserProfile.mockResolvedValue(mockUser);

      // Act
      const response = await request(app)
        .post('/api/auth/validate')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          preferences: DEFAULT_USER_PREFERENCES,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      expect(authUseCase.getUserProfile).toHaveBeenCalledWith('user-123');
    });

    it('should return invalid for bad token', async () => {
      // Act
      const response = await request(app).post('/api/auth/validate');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'No valid authentication found',
      });
    });
  });

  describe('DELETE /api/auth/profile', () => {
    it('should delete user account successfully', async () => {
      // Arrange
      authUseCase.deleteUserAccount.mockResolvedValue(true);

      // Act
      const response = await request(app)
        .delete('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(204);

      expect(authUseCase.deleteUserAccount).toHaveBeenCalledWith('user-123');
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(app).delete('/api/auth/profile');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should handle delete failures', async () => {
      // Arrange
      authUseCase.deleteUserAccount.mockResolvedValue(false);

      // Act
      const response = await request(app)
        .delete('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Account not found' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully. Please remove the token from client storage.',
      });
    });

    it('should allow logout without authentication', async () => {
      // Act
      const response = await request(app).post('/api/auth/logout');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully. Please remove the token from client storage.',
      });
    });
  });
});
