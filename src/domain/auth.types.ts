// Authentication domain types following SOLID principles
import type { UserContext, TokenPayload, AuthError } from './user.types';

// Token validation interface (Interface Segregation - only token validation concerns)
export interface TokenValidator {
  validateToken(token: string): Promise<TokenValidationResult>;
}

// User context resolver interface (Single Responsibility - only context resolution)
export interface UserContextResolver {
  resolveContext(token?: string): Promise<UserContext>;
}

// Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: AuthError;
}

// Google OIDC specific configuration
export interface GoogleOIDCConfig {
  clientId: string;
  issuer: string;
  jwksUri: string;
  allowedAudiences: string[];
}

// Authentication configuration (Open/Closed - extensible for other providers)
export interface AuthConfig {
  google: GoogleOIDCConfig;
  tokenTtl: number; // Token time-to-live in seconds
  refreshTokenTtl: number;
}

// OIDC Authorization Code flow with PKCE types
export interface OIDCAuthRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  state?: string;
}

export interface OIDCTokenResponse {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
}

// Re-export common types for convenience
export type {
  User,
  UserContext,
  AuthenticatedUser,
  AnonymousUser,
  TokenPayload,
  AuthenticationResult,
  AuthError,
} from './user.types';
