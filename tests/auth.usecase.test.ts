// Authentication Use Case Tests
import { AuthenticationUseCase } from '../src/application/auth.usecase';
import { TokenValidator } from '../src/domain/auth.types';
import { UserRepository } from '../src/infrastructure/firestore-user.repository';
import { User, CreateUserDto, AuthError, DEFAULT_USER_PREFERENCES } from '../src/domain/user.types';

describe('AuthenticationUseCase', () => {
  let authUseCase: AuthenticationUseCase;
  let mockTokenValidator: jest.Mocked<TokenValidator>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Create mocks
    mockTokenValidator = {
      validateToken: jest.fn(),
    };

    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateLastLogin: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    authUseCase = new AuthenticationUseCase(mockTokenValidator, mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginWithGoogleToken', () => {
    it('should login existing user successfully', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const tokenPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/picture.jpg',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
      };

      const existingUser: User = {
        id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        lastLoginAt: new Date('2023-01-03'),
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: true,
        payload: tokenPayload,
      });
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      // Act
      const result = await authUseCase.loginWithGoogleToken(token);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual(existingUser);
      expect(result.token).toBe(token);

      expect(mockTokenValidator.validateToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('google-user-123');
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('google-user-123');
    });

    it('should create new user when not exists', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const tokenPayload = {
        sub: 'google-user-456',
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/new-picture.jpg',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
      };

      const newUser: User = {
        id: 'google-user-456',
        email: 'newuser@example.com',
        name: 'New User',
        profilePictureUrl: 'https://example.com/new-picture.jpg',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: true,
        payload: tokenPayload,
      });
      mockUserRepository.findById.mockResolvedValue(null); // User doesn't exist
      mockUserRepository.create.mockResolvedValue(newUser);

      // Act
      const result = await authUseCase.loginWithGoogleToken(token);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(result.token).toBe(token);

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        id: 'google-user-456',
        email: 'newuser@example.com',
        name: 'New User',
        profilePictureUrl: 'https://example.com/new-picture.jpg',
      });
    });

    it('should fail with invalid token', async () => {
      // Arrange
      const token = 'invalid.jwt.token';
      const authError: AuthError = {
        type: 'INVALID_TOKEN',
        message: 'Token expired',
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: false,
        error: authError,
      });

      // Act
      const result = await authUseCase.loginWithGoogleToken(token);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toEqual(authError);
      expect(result.user).toBeUndefined();

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should handle user repository errors', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const tokenPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: true,
        payload: tokenPayload,
      });
      mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const result = await authUseCase.loginWithGoogleToken(token);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toBe('Database connection failed');
      expect(result.user).toBeUndefined();
    });
  });

  describe('validateTokenAndGetUser', () => {
    it('should validate token and return user', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const tokenPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
      };

      const user: User = {
        id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        preferences: DEFAULT_USER_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: true,
        payload: tokenPayload,
      });
      mockUserRepository.findById.mockResolvedValue(user);

      // Act
      const result = await authUseCase.validateTokenAndGetUser(token);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual(user);
      expect(result.token).toBe(token);
      expect(mockTokenValidator.validateToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('google-user-123');
    });

    it('should fail when user not found in database', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const tokenPayload = {
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'test-client-id',
        iss: 'https://accounts.google.com',
      };

      mockTokenValidator.validateToken.mockResolvedValue({
        isValid: true,
        payload: tokenPayload,
      });
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authUseCase.validateTokenAndGetUser(token);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('USER_NOT_FOUND');
      expect(result.error?.message).toBe('User not found in database');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile when user exists', async () => {
      // Arrange
      const userId = 'google-user-123';
      const user: User = {
        id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        profilePictureUrl: 'https://example.com/picture.jpg',
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          theme: 'dark',
        },
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        lastLoginAt: new Date('2023-01-03'),
      };

      mockUserRepository.findById.mockResolvedValue(user);

      // Act
      const result = await authUseCase.getUserProfile(userId);

      // Assert
      expect(result).toEqual(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authUseCase.getUserProfile(userId);

      // Assert
      expect(result).toBeNull();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const userId = 'google-user-123';
      const updateData = {
        name: 'Updated Name',
        preferences: {
          theme: 'dark' as const,
          sortingStyle: 'genre' as const,
        },
      };

      const updatedUser: User = {
        id: 'google-user-123',
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

      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await authUseCase.updateUserProfile(userId, updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updateData);
    });

    it('should handle update errors', async () => {
      // Arrange
      const userId = 'google-user-123';
      const updateData = { name: 'Updated Name' };

      mockUserRepository.update.mockRejectedValue(new Error('Update failed'));

      // Act
      const result = await authUseCase.updateUserProfile(userId, updateData);

      // Assert
      expect(result).toBeNull();
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updateData);
    });
  });

  describe('deleteUserAccount', () => {
    it('should delete user successfully', async () => {
      // Arrange
      const userId = 'google-user-123';
      mockUserRepository.delete.mockResolvedValue(true);

      // Act
      const result = await authUseCase.deleteUserAccount(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    });

    it('should handle delete errors', async () => {
      // Arrange
      const userId = 'google-user-123';
      mockUserRepository.delete.mockRejectedValue(new Error('Delete failed'));

      // Act
      const result = await authUseCase.deleteUserAccount(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      // Arrange
      const userId = 'google-user-123';
      mockUserRepository.exists.mockResolvedValue(true);

      // Act
      const result = await authUseCase.userExists(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.exists).toHaveBeenCalledWith(userId);
    });

    it('should return false when user does not exist', async () => {
      // Arrange
      const userId = 'nonexistent-user';
      mockUserRepository.exists.mockResolvedValue(false);

      // Act
      const result = await authUseCase.userExists(userId);

      // Assert
      expect(result).toBe(false);
      expect(mockUserRepository.exists).toHaveBeenCalledWith(userId);
    });
  });
});
