// Authentication Infrastructure Tests
import { GoogleOIDCTokenValidator } from '../src/infrastructure/google-oidc-validator';
import { FirestoreUserRepository } from '../src/infrastructure/firestore-user.repository';
import { AuthenticationMiddleware } from '../src/infrastructure/auth.middleware';
import { UserContextResolverImpl } from '../src/infrastructure/user-context-resolver';
import { GoogleOIDCConfig, TokenPayload } from '../src/domain/auth.types';
import { User, CreateUserDto } from '../src/domain/user.types';
import express from 'express';

// Mock JWT and Google Auth
jest.mock('jsonwebtoken');
jest.mock('google-auth-library');

const mockJwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

describe('GoogleOIDCTokenValidator', () => {
  let validator: GoogleOIDCTokenValidator;
  let config: GoogleOIDCConfig;
  let mockOAuth2Client: jest.Mocked<any>;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      issuer: 'https://accounts.google.com',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      allowedAudiences: ['test-client-id'],
    };

    // Mock OAuth2Client
    mockOAuth2Client = {
      verifyIdToken: jest.fn(),
    };
    OAuth2Client.mockImplementation(() => mockOAuth2Client);

    validator = new GoogleOIDCTokenValidator(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should validate a valid Google ID token', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const mockPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/picture.jpg',
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result).toEqual({
        isValid: true,
        payload: {
          sub: 'google-user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/picture.jpg',
          aud: 'test-client-id',
          iss: 'https://accounts.google.com',
          iat: expect.any(Number),
          exp: expect.any(Number),
        },
      });

      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: token,
        audience: ['test-client-id'],
      });
    });

    it('should return invalid result for expired token', async () => {
      // Arrange
      const token = 'expired.jwt.token';
      mockOAuth2Client.verifyIdToken.mockRejectedValue(new Error('Token expired'));

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toEqual({
        type: 'VALIDATION_ERROR',
        message: 'Token validation failed',
        details: 'Token expired',
      });
    });

    it('should return invalid result for token with wrong audience', async () => {
      // Arrange
      const token = 'wrong.audience.token';
      const mockPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        aud: 'wrong-client-id',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toEqual({
        type: 'INVALID_TOKEN',
        message: 'Invalid audience: wrong-client-id',
      });
    });

    it('should return invalid result for token with wrong issuer', async () => {
      // Arrange
      const token = 'wrong.issuer.token';
      const mockPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        aud: 'test-client-id',
        iss: 'https://malicious.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toEqual({
        type: 'INVALID_TOKEN',
        message: 'Invalid issuer: expected https://accounts.google.com, got https://malicious.com',
      });
    });

    it('should handle malformed tokens gracefully', async () => {
      // Arrange
      const token = 'malformed.token';
      mockOAuth2Client.verifyIdToken.mockRejectedValue(new Error('Invalid token format'));

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toEqual({
        type: 'VALIDATION_ERROR',
        message: 'Token validation failed',
        details: 'Invalid token format',
      });
    });

    it('should handle missing required claims', async () => {
      // Arrange
      const token = 'incomplete.token';
      const mockPayload = {
        // Missing sub, email, name
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload,
      });

      // Act
      const result = await validator.validateToken(token);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toEqual({
        type: 'INVALID_TOKEN',
        message: 'Required claims (sub, email) missing from token',
      });
    });
  });
});

describe('FirestoreUserRepository', () => {
  let userRepository: FirestoreUserRepository;
  let mockFirestore: any;
  let mockCollection: any;
  let mockDoc: any;

  beforeEach(() => {
    // Mock Firestore
    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: false,
      data: jest.fn(),
    };

    mockCollection = {
      doc: jest.fn(() => mockDoc),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
    };

    mockFirestore = {
      collection: jest.fn(() => mockCollection),
    };

    userRepository = new FirestoreUserRepository(mockFirestore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = 'user-123';
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: {
          sortingStyle: 'alphabetical',
          sharingVisibility: 'private',
          notifications: {
            newBooks: true,
            loanReminders: true,
            sharedCollections: false,
          },
          theme: 'auto',
          booksPerPage: 20,
          defaultView: 'grid',
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        lastLoginAt: '2023-01-03T00:00:00.000Z',
      };

      mockDoc.exists = true;
      mockDoc.data.mockReturnValue(userData);
      mockDoc.get.mockResolvedValue(mockDoc);

      // Act
      const result = await userRepository.findById(userId);

      // Assert
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: {
          sortingStyle: 'alphabetical',
          sharingVisibility: 'private',
          notifications: {
            newBooks: true,
            loanReminders: true,
            sharedCollections: false,
          },
          theme: 'auto',
          booksPerPage: 20,
          defaultView: 'grid',
        },
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-02T00:00:00.000Z'),
        lastLoginAt: new Date('2023-01-03T00:00:00.000Z'),
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.doc).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockDoc.exists = false;
      mockDoc.get.mockResolvedValue(mockDoc);

      // Act
      const result = await userRepository.findById(userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
      };

      mockDoc.set.mockResolvedValue(undefined);

      // Act
      const result = await userRepository.create(createDto);

      // Assert
      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.preferences).toEqual({
        sortingStyle: 'alphabetical',
        sharingVisibility: 'private',
        notifications: {
          newBooks: true,
          loanReminders: true,
          sharedCollections: false,
        },
        theme: 'auto',
        booksPerPage: 20,
        defaultView: 'grid',
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          profilePictureUrl: 'https://example.com/picture.jpg',
        })
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login timestamp', async () => {
      // Arrange
      const userId = 'user-123';
      mockDoc.update.mockResolvedValue(undefined);

      // Act
      await userRepository.updateLastLogin(userId);

      // Assert
      expect(mockDoc.update).toHaveBeenCalledWith({
        lastLoginAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });
});

describe('AuthenticationMiddleware', () => {
  let middleware: AuthenticationMiddleware;
  let mockUserContextResolver: any;
  let mockReq: Partial<express.Request>;
  let mockRes: Partial<express.Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockUserContextResolver = {
      resolveContext: jest.fn(),
    };

    middleware = new AuthenticationMiddleware(mockUserContextResolver);

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractContext', () => {
    it('should extract user context when valid token provided', async () => {
      // Arrange
      mockReq.headers = { authorization: 'Bearer valid.token' };
      const mockContext = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        isAuthenticated: true,
      };

      mockUserContextResolver.resolveContext.mockResolvedValue(mockContext);

      const middlewareFn = middleware.extractContext();

      // Act
      await middlewareFn(mockReq as express.Request, mockRes as express.Response, mockNext);

      // Assert
      expect(mockReq.userContext).toEqual(mockContext);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockUserContextResolver.resolveContext).toHaveBeenCalledWith('Bearer valid.token');
    });

    it('should provide anonymous context when no token provided', async () => {
      // Arrange
      const mockContext = {
        user: null,
        isAuthenticated: false,
      };

      mockUserContextResolver.resolveContext.mockResolvedValue(mockContext);

      const middlewareFn = middleware.extractContext();

      // Act
      await middlewareFn(mockReq as express.Request, mockRes as express.Response, mockNext);

      // Assert
      expect(mockReq.userContext).toEqual(mockContext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAuth', () => {
    it('should allow access when user is authenticated', async () => {
      // Arrange
      mockReq.headers = { authorization: 'Bearer valid.token' };
      const mockContext = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        isAuthenticated: true,
      };

      mockUserContextResolver.resolveContext.mockResolvedValue(mockContext);

      const middlewareFn = middleware.requireAuth();

      // Act
      await middlewareFn(mockReq as express.Request, mockRes as express.Response, mockNext);

      // Assert
      expect(mockReq.userContext).toEqual(mockContext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      const mockContext = {
        user: null,
        isAuthenticated: false,
      };

      mockUserContextResolver.resolveContext.mockResolvedValue(mockContext);

      const middlewareFn = middleware.requireAuth();

      // Act
      await middlewareFn(mockReq as express.Request, mockRes as express.Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token validation fails', async () => {
      // Arrange
      mockReq.headers = { authorization: 'Bearer invalid.token' };
      mockUserContextResolver.resolveContext.mockRejectedValue(new Error('Invalid token'));

      const middlewareFn = middleware.requireAuth();

      // Act
      await middlewareFn(mockReq as express.Request, mockRes as express.Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
