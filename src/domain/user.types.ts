// Domain Entity - User (following Single Responsibility Principle)
export interface User {
  id: string; // Google OAuth sub claim
  email: string;
  name: string;
  profilePictureUrl?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// User preferences with standard terminology
export interface UserPreferences {
  // Collection organization preferences
  sortingStyle: 'chronological' | 'alphabetical' | 'genre' | 'personal';

  // Sharing preferences
  sharingVisibility: 'private' | 'friends' | 'public';

  // Notification preferences
  notifications: {
    newBooks: boolean;
    loanReminders: boolean;
    sharedCollections: boolean;
  };

  // Display preferences
  theme: 'light' | 'dark' | 'auto';
  booksPerPage: number;
  defaultView: 'grid' | 'list' | 'compact';
}

// Create User DTO for registration/profile updates
export interface CreateUserDto {
  id: string; // Google OAuth sub claim
  email: string;
  name: string;
  profilePictureUrl?: string;
  preferences?: Partial<UserPreferences>;
}

// Update User DTO
export interface UpdateUserDto {
  name?: string;
  profilePictureUrl?: string;
  preferences?: Partial<UserPreferences>;
}

// User context for request authentication (Dependency Inversion)
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isAuthenticated: true;
}

// Anonymous user context
export interface AnonymousUser {
  isAuthenticated: false;
}

// Union type for request context
export type UserContext = AuthenticatedUser | AnonymousUser;

// Token payload interface (Interface Segregation)
export interface TokenPayload {
  sub: string; // User ID
  email: string;
  name: string;
  picture?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

// Authentication result for use cases
export interface AuthenticationResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: AuthError;
}

// Authentication errors with specific types
export interface AuthError {
  type: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'USER_NOT_FOUND' | 'VALIDATION_ERROR';
  message: string;
  details?: unknown;
}

// Default preferences for new users
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
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
};
