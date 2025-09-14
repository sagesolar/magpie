// Main server application with dependency injection
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { BookController } from './api/book.controller';
import { AuthController } from './api/auth.controller';
import { createBookRoutes } from './api/book.routes';
import { createAuthRoutes } from './api/auth.routes';
import { BookUseCase } from './application/book.usecase';
import { AuthenticationUseCase } from './application/auth.usecase';
import { FirestoreBookRepository } from './infrastructure/firestore-book.repository';
import { FirestoreUserRepository } from './infrastructure/firestore-user.repository';
import { ExternalBookServiceImpl } from './infrastructure/external-book.service';
import { GoogleOIDCTokenValidator } from './infrastructure/google-oidc-validator';
import { UserContextResolverImpl } from './infrastructure/user-context-resolver';
import { AuthenticationMiddleware } from './infrastructure/auth.middleware';
import { GoogleOIDCConfig } from './domain/auth.types';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Define error interface
interface AppError extends Error {
  name: string;
  message: string;
  status?: number;
  issues?: unknown[];
}

interface ZodError extends Error {
  name: 'ZodError';
  errors?: unknown[];
  issues?: unknown[];
}

class MagpieServer {
  private app: express.Application;
  private port: number;
  private bookRepository: FirestoreBookRepository;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.bookRepository = new FirestoreBookRepository(
      process.env.GOOGLE_CLOUD_PROJECT_ID,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      process.env.FIRESTORE_DATABASE_ID
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:8080',
          'https://magpie-pwa-dev.web.app',
          'https://magpie-pwa-prod.web.app',
        ],
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });

    // Static files for PWA
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    // Create Google OIDC configuration
    const googleConfig: GoogleOIDCConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      issuer: 'https://accounts.google.com',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
      allowedAudiences: [process.env.GOOGLE_CLIENT_ID || ''],
    };

    // Validate configuration
    if (!googleConfig.clientId) {
      logger.error('GOOGLE_CLIENT_ID environment variable is required');
      throw new Error('Missing required Google OAuth configuration');
    }

    // Dependency injection - create instances
    const externalBookService = new ExternalBookServiceImpl();
    const userRepository = new FirestoreUserRepository(
      this.bookRepository.firestoreInstance, // Use same Firestore instance
      process.env.FIRESTORE_DATABASE_ID
    );

    // Authentication infrastructure
    const tokenValidator = new GoogleOIDCTokenValidator(googleConfig);
    const userContextResolver = new UserContextResolverImpl(tokenValidator, userRepository);
    const authMiddleware = new AuthenticationMiddleware(userContextResolver);

    // Use cases
    const bookUseCase = new BookUseCase(this.bookRepository, externalBookService);
    const authUseCase = new AuthenticationUseCase(tokenValidator, userRepository);

    // Controllers
    const bookController = new BookController(bookUseCase);
    const authController = new AuthController(authUseCase);

    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      const version = process.env.APP_VERSION || '1.0.0';
      const environment = process.env.ENVIRONMENT || 'development';
      const displayVersion = environment === 'development' ? `${version} (dev)` : version;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: displayVersion,
        environment,
        buildNumber: process.env.BUILD_NUMBER,
        buildDate: process.env.BUILD_DATE,
        authentication: 'enabled',
      });
    });

    // API routes
    this.app.use('/api', createBookRoutes(bookController, authMiddleware));
    this.app.use('/api', createAuthRoutes(authController, authMiddleware));

    // Serve PWA for all other routes
    this.app.get('*', (req: Request, res: Response) => {
      res.sendFile('index.html', { root: 'public' });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: AppError, req: Request, res: Response, _next: NextFunction) => {
      logger.error('Error occurred', error);

      // Zod validation errors
      if (error.name === 'ZodError') {
        const zodError = error as ZodError;
        return res.status(400).json({
          error: 'Validation error',
          details: zodError.errors || zodError.issues,
        });
      }

      // Custom application errors
      if (error.message) {
        const statusCode = error.message.includes('not found')
          ? 404
          : error.message.includes('already exists')
            ? 409
            : 400;
        return res.status(statusCode).json({ error: error.message });
      }

      // Generic server error
      res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  public async start(): Promise<void> {
    try {
      this.app.listen(this.port, '0.0.0.0', () => {
        logger.info(`🐦 Magpie Book Collection Server running on port ${this.port}`);
        logger.info(`📚 API available at http://localhost:${this.port}/api`);
        logger.info(`🌐 PWA available at http://localhost:${this.port}`);
        logger.info(`🌐 Also accessible at http://127.0.0.1:${this.port}`);
      });
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down server...');
    await this.bookRepository.close();
    process.exit(0);
  }
}

// Create and start server
const server = new MagpieServer();

// Graceful shutdown
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start the server
server.start().catch(error => logger.error('Failed to start server', error));
