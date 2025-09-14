# 🐦 Magpie Bibliotherapy 📚

A modern, full-stack book collection management system built with clean architecture principles. Features a Node.js TypeScript backend with REST API and a Progressive Web App (PWA) frontend with offline support.

> **🔒 Security Note**: This is a public repository. Never commit actual project IDs, service account keys, or other sensitive data. See [`SECURITY.md`](docs/SECURITY.md) for detailed security guidelines.

## ✨ Features

### 📚 Book Management

- **Smart Cataloging**: Add books by ISBN with automatic metadata fetching
- **Comprehensive Details**: Track title, authors, publisher, edition, year, pages, genre, description, cover image, and more
- **Physical Tracking**: Record storage location, condition, and personal notes
- **Book Types**: Categorize as reference or personal reading books

### 🔍 Search & Organization

- **Powerful Search**: Search by title, author, ISBN, or content
- **Smart Filtering**: Filter by genre, type, favorite status, loan status, condition
- **Flexible Sorting**: Sort by title, author, genre, year, or date added
- **Pagination**: Efficient browsing of large collections

### 🤝 Loan Management

- **Loan Tracking**: Track books loaned to friends and family
- **Due Dates**: Set and monitor expected return dates
- **Loan History**: Keep records of past loans

### 📱 Progressive Web App

- **Offline Support**: Work without internet connection
- **Background Sync**: Auto-sync changes when back online
- **Mobile-First**: Responsive design optimized for all devices
- **App-like Experience**: Install on device home screen

### 🔐 Authentication & User Management

- **Google OAuth Integration**: Secure login with Google accounts using OpenID Connect (OIDC)
- **Personal Book Collections**: Each user has their own private book collection
- **Book Ownership**: Books are tied to user accounts with ownership validation
- **Book Sharing**: Share books with other users while maintaining ownership
- **Secure API**: All book operations require authentication and validate user permissions
- **Profile Management**: User profile and settings accessible after login
- **Session Management**: Secure token-based authentication with automatic refresh

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (LTS)
- npm 9+

### Installation

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd magpie
   npm install
   ```

2. **Environment setup**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   **Required for authentication**: Set up Google OAuth credentials:
   - Create a Google Cloud project and enable the Google+ API
   - Create OAuth 2.0 credentials (Web application)
   - Add `http://localhost:3000` to authorized origins
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your `.env` file

3. **Build the project**:

   ```bash
   npm run build
   ```

4. **Start the server**:

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

5. **Open your browser**:
   - PWA: http://localhost:3000
   - API: http://localhost:3000/api
   - Health Check: http://localhost:3000/health

## 📋 API Endpoints

### Authentication

- `POST /api/auth/login` - Initiate Google OAuth login
- `POST /api/auth/callback` - Handle OAuth callback and validate tokens
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout and invalidate session

### Books

- `GET /api/books` - Get all books (with filtering, sorting, pagination)
- `GET /api/books/:isbn` - Get book by ISBN
- `POST /api/books` - Create new book
- `PUT /api/books/:isbn` - Update book
- `DELETE /api/books/:isbn` - Delete book
- `POST /api/books/:isbn/share` - Share book with other users
- `DELETE /api/books/:isbn/users/:userId` - Remove user access from book

### Search

- `GET /api/search?q=query` - Search books by title, author, or ISBN

### External Data

- `GET /api/external/:isbn` - Fetch book data from external APIs

### Special Operations

- `PUT /api/books/:isbn/favourite` - Toggle favorite status
- `PUT /api/books/:isbn/loan` - Update loan status

### System

- `GET /api/health` - Health check

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Google Cloud Firestore Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Database

The system uses **Google Cloud Firestore** as its NoSQL document database, providing:

- **Scalability**: Automatically scales based on demand
- **Real-time updates**: Live synchronization across clients
- **Offline support**: Built-in offline capabilities
- **Security**: Fine-grained security rules
- **Global distribution**: Multi-region data replication

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - CI-friendly test run
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run check` - Run lint + format check + build
- `npm run check:all` - Full quality check (lint + format + test + build)

### Project Structure

```
magpie/
├── .github/workflows/  # CI/CD pipeline definitions
├── docs/               # Documentation guides
├── src/                # Backend source code
│   ├── api/            # REST API controllers and routes
│   ├── application/    # Use cases and business logic
│   ├── domain/         # Business entities and types
│   ├── infrastructure/ # External services and data access
│   ├── utils/          # Utility functions
│   └── server.ts       # Application entry point
├── tests/              # Unit tests and mocks
├── public/             # PWA frontend
│   ├── index.html      # Main PWA interface
│   ├── manifest.json   # PWA manifest
│   ├── sw.js          # Service worker
│   ├── styles/        # CSS files
│   └── js/            # Frontend JavaScript
├── scripts/database/   # Database seeding and management
├── Dockerfile          # Docker containerization
├── firebase.json       # Firebase hosting configuration
├── firestore.rules     # Firestore security rules
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── .env.example        # Environment template
```

## 🧪 Testing

The project includes comprehensive unit tests for both API and application layers with **98 test cases** and **95%+ coverage**.

### Test Architecture

- **Jest** - Testing framework with TypeScript support
- **Supertest** - HTTP assertion library for API testing
- **Mock Implementations** - In-memory repository and external service mocks
- **Coverage Reporting** - Detailed code coverage analysis

### Test Structure

```
tests/
├── setup.ts              # Test environment configuration
├── mocks.ts              # Mock implementations for testing
├── book.usecase.test.ts   # Book business logic tests
├── book.controller.test.ts # Book API endpoint tests
├── auth.usecase.test.ts   # Authentication business logic tests
├── auth.api.test.ts       # Authentication API endpoint tests
├── auth.infrastructure.test.ts # OAuth and repository tests
└── health.endpoint.test.ts # Health check endpoint tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI/CD
npm run test:ci

# Full code quality check (lint + format + test + build)
npm run check:all
```

### Test Coverage

| Layer                     | Coverage | Details                                   |
| ------------------------- | -------- | ----------------------------------------- |
| **API Controllers**       | 94%+     | All endpoints, validation, error handling |
| **Application Use Cases** | 97%+     | Business logic, edge cases, validation    |
| **Infrastructure**        | 95%+     | Repository, OAuth, external services      |
| **Overall**               | 95%+     | Comprehensive test coverage               |

### What's Tested

#### Book Management

- ✅ **Book Creation** - Valid data, duplicates, validation
- ✅ **Book Retrieval** - By ISBN, pagination, filtering
- ✅ **Book Updates** - Partial updates, validation
- ✅ **Book Deletion** - Success and error cases
- ✅ **Search Functionality** - Title, author, ISBN search
- ✅ **External API Integration** - Mock external book data
- ✅ **Favourite Management** - Toggle favourite status
- ✅ **Loan Tracking** - Update loan status and metadata
- ✅ **Book Sharing** - Share with users, remove access
- ✅ **Ownership Validation** - User permissions and access control

#### Authentication & User Management

- ✅ **OAuth Integration** - Google OAuth flow, token validation
- ✅ **User Registration** - New user creation from OAuth
- ✅ **User Authentication** - Login, logout, session management
- ✅ **Token Management** - JWT creation, validation, refresh
- ✅ **User Profile** - Profile retrieval and updates
- ✅ **Authorization** - API endpoint protection and user context
- ✅ **Repository Operations** - User CRUD operations in Firestore
- ✅ **Error Handling** - OAuth failures, invalid tokens, unauthorized access

#### API Endpoints

- ✅ **REST Operations** - All CRUD endpoints for books and auth
- ✅ **HTTP Status Codes** - Proper status code responses
- ✅ **Request Validation** - Zod schema validation
- ✅ **Error Responses** - 400, 401, 403, 404, 409, 500 handling
- ✅ **Query Parameters** - Filtering, sorting, pagination
- ✅ **Authentication Headers** - Bearer token validation
- ✅ **JSON Responses** - Proper response format and structure

### Test Examples

```bash
# Example test output
✓ BookUseCase > createBook > should create a book successfully
✓ BookUseCase > getAllBooks > should filter by genre
✓ AuthUseCase > authenticateUser > should validate OAuth token
✓ AuthUseCase > getUserProfile > should return user information
✓ BookController API > GET /api/books > should return all books
✓ BookController API > POST /api/books > should create a new book
✓ AuthController API > POST /api/auth/login > should initiate OAuth flow
✓ AuthController API > GET /api/auth/me > should return user profile
```

### Integration Testing

Test API endpoints manually:

```bash
# Health check
curl http://localhost:3000/api/health

# Authentication (requires Google OAuth setup)
curl http://localhost:3000/api/auth/login

# Get current user (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/auth/me

# Get user's books (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/books

# Create a book (requires authentication)
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "isbn": "9781234567890",
    "title": "Test Book",
    "authors": ["Test Author"],
    "publisher": "Test Publisher",
    "publishingYear": 2023,
    "type": "reference"
  }'

# Search books (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/search?q=typescript"

# Share a book (requires authentication and ownership)
curl -X POST http://localhost:3000/api/books/9781234567890/share \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userIds": ["user2@example.com", "user3@example.com"]
  }'

# Toggle favorite status (requires authentication)
curl -X PUT http://localhost:3000/api/books/9781234567890/favourite \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update loan status (requires authentication)
curl -X PUT http://localhost:3000/api/books/9781234567890/loan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "loanStatus": "loaned",
    "borrower": "friend@example.com",
    "loanDate": "2023-09-15",
    "dueDate": "2023-10-15"
  }'

# Remove user access from shared book (requires authentication and ownership)
curl -X DELETE http://localhost:3000/api/books/9781234567890/users/user2@example.com \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚢 Deployment

### Production Build

```bash
npm run build
NODE_ENV=production npm start
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 3000
CMD ["npm", "start"]
```

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Setup & Configuration](docs/)** - Database setup, CI/CD configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Security Guide](docs/SECURITY.md)** - Security best practices
- **[Firestore Setup](docs/FIRESTORE_SETUP.md)** - Database configuration guide

---

**Happy Reading! 📚**
