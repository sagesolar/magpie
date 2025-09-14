// Google OIDC Token Validator - Infrastructure Layer
// Follows Dependency Inversion and Interface Segregation principles

import { OAuth2Client } from 'google-auth-library';
import {
  TokenValidator,
  TokenValidationResult,
  GoogleOIDCConfig,
  TokenPayload,
} from '../domain/auth.types';
import { logger } from '../utils/logger';

export class GoogleOIDCTokenValidator implements TokenValidator {
  private oAuth2Client: OAuth2Client;
  private config: GoogleOIDCConfig;

  constructor(config: GoogleOIDCConfig) {
    this.config = config;
    this.oAuth2Client = new OAuth2Client(config.clientId);
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Remove Bearer prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');

      // Verify the ID token using Google's public keys
      const ticket = await this.oAuth2Client.verifyIdToken({
        idToken: cleanToken,
        audience: this.config.allowedAudiences,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        return {
          isValid: false,
          error: {
            type: 'INVALID_TOKEN',
            message: 'Token payload is empty',
          },
        };
      }

      // Validate required claims
      if (!payload.sub || !payload.email) {
        return {
          isValid: false,
          error: {
            type: 'INVALID_TOKEN',
            message: 'Required claims (sub, email) missing from token',
          },
        };
      }

      // Validate issuer
      if (payload.iss !== this.config.issuer) {
        return {
          isValid: false,
          error: {
            type: 'INVALID_TOKEN',
            message: `Invalid issuer: expected ${this.config.issuer}, got ${payload.iss}`,
          },
        };
      }

      // Validate audience
      if (!this.config.allowedAudiences.includes(payload.aud || '')) {
        return {
          isValid: false,
          error: {
            type: 'INVALID_TOKEN',
            message: `Invalid audience: ${payload.aud}`,
          },
        };
      }

      // Check token expiration (Google client already validates this, but double-check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return {
          isValid: false,
          error: {
            type: 'TOKEN_EXPIRED',
            message: 'Token has expired',
          },
        };
      }

      // Extract token payload
      const tokenPayload: TokenPayload = {
        sub: payload.sub,
        email: payload.email || '',
        name: payload.name || payload.email || '',
        picture: payload.picture,
        iat: payload.iat || now,
        exp: payload.exp || now + 3600,
        aud: payload.aud || '',
        iss: payload.iss || '',
      };

      logger.info(`Token validated successfully for user: ${tokenPayload.email}`);

      return {
        isValid: true,
        payload: tokenPayload,
      };
    } catch (error) {
      logger.error('Token validation failed:', error);

      // Handle specific Google Auth Library errors
      if (error instanceof Error) {
        if (error.message.includes('Token used too early')) {
          return {
            isValid: false,
            error: {
              type: 'INVALID_TOKEN',
              message: 'Token used too early (nbf claim)',
              details: error.message,
            },
          };
        }

        if (error.message.includes('Token used too late')) {
          return {
            isValid: false,
            error: {
              type: 'TOKEN_EXPIRED',
              message: 'Token has expired',
              details: error.message,
            },
          };
        }

        if (error.message.includes('Invalid token signature')) {
          return {
            isValid: false,
            error: {
              type: 'INVALID_TOKEN',
              message: 'Invalid token signature',
              details: error.message,
            },
          };
        }
      }

      return {
        isValid: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Token validation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Helper method to get configuration (useful for testing)
  getConfig(): GoogleOIDCConfig {
    return { ...this.config };
  }

  // Helper method to update client configuration
  updateConfig(config: Partial<GoogleOIDCConfig>): void {
    this.config = { ...this.config, ...config };
    this.oAuth2Client = new OAuth2Client(this.config.clientId);
  }
}
