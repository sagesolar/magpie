# 🐦 Magpie Book Collection System

A modern, full-stack book collection management system built with clean architecture principles. Features a Node.js TypeScript backend with REST API and a Progressive Web App (PWA) frontend with offline support.

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

## 🏗️ Architecture

Built following **SOLID principles** and **Clean Architecture**:

```
src/
├── domain/           # Business entities and rules
│   └── book.types.ts
├── application/      # Use cases and business logic
│   └── book.usecase.ts
├── infrastructure/   # External services and data access
│   ├── interfaces.ts
│   ├── sqlite-book.repository.ts
│   └── external-book.service.ts
├── api/             # REST API controllers and routes
│   ├── book.controller.ts
│   ├── book.routes.ts
│   └── validation.schemas.ts
└── server.ts        # Application entry point
```

### Key Architectural Benefits

- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Single Responsibility**: Each class has one reason to change
- **Open/Closed Principle**: Open for extension, closed for modification
- **Interface Segregation**: Clients depend only on interfaces they use
- **Liskov Substitution**: Derived classes must be substitutable for base classes

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

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

### Books

- `GET /api/books` - Get all books (with filtering, sorting, pagination)
- `GET /api/books/:isbn` - Get book by ISBN
- `POST /api/books` - Create new book
- `PUT /api/books/:isbn` - Update book
- `DELETE /api/books/:isbn` - Delete book

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

# Database Configuration
DB_PATH=./magpie.db

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### Database

The system uses SQLite for simplicity and portability. The database file will be created automatically on first run.

## 🛠️ Development

### Available Scripts

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
├── src/                 # Source code
│   ├── api/            # REST API controllers and routes
│   ├── application/    # Use cases and business logic
│   ├── domain/         # Business entities and types
│   ├── infrastructure/ # External services and data access
│   └── server.ts       # Application entry point
├── tests/              # Unit tests
│   ├── setup.ts        # Test configuration
│   ├── mocks.ts        # Mock implementations
│   ├── book.usecase.test.ts    # Application layer tests
│   └── book.controller.test.ts # API layer tests
├── public/             # PWA static files
├── coverage/           # Test coverage reports (generated)
├── dist/               # Compiled JavaScript (generated)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── jest.config.js      # Jest test configuration
├── .prettierrc         # Prettier formatting rules
├── .eslintrc.json      # ESLint linting rules
├── .env.example        # Environment template
└── README.md          # This file
```

## 🧪 Testing

The project includes comprehensive unit tests for both API and application layers with **50 test cases** and **95%+ coverage**.

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
├── book.usecase.test.ts   # Application layer tests (28 tests)
└── book.controller.test.ts # API layer tests (22 tests)
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

| Layer | Coverage | Details |
|-------|----------|---------|
| **API Controller** | 94.84% | All endpoints, validation, error handling |
| **Application Use Cases** | 97.36% | Business logic, edge cases, validation |
| **Overall** | 95%+ | Comprehensive test coverage |

### What's Tested

#### Application Layer (`book.usecase.test.ts`)
- ✅ **Book Creation** - Valid data, duplicates, validation
- ✅ **Book Retrieval** - By ISBN, pagination, filtering
- ✅ **Book Updates** - Partial updates, validation
- ✅ **Book Deletion** - Success and error cases
- ✅ **Search Functionality** - Title, author, ISBN search
- ✅ **External API Integration** - Mock external book data
- ✅ **Favourite Management** - Toggle favourite status
- ✅ **Loan Tracking** - Update loan status and metadata

#### API Layer (`book.controller.test.ts`)
- ✅ **REST Endpoints** - All CRUD operations
- ✅ **HTTP Status Codes** - Proper status code responses
- ✅ **Request Validation** - Zod schema validation
- ✅ **Error Handling** - 400, 404, 409, 500 responses
- ✅ **Query Parameters** - Filtering, sorting, pagination
- ✅ **JSON Responses** - Proper response format
- ✅ **Search API** - Query parameter validation
- ✅ **External API** - Third-party book data fetching

### Test Examples

```bash
# Example test output
✓ BookUseCase > createBook > should create a book successfully
✓ BookUseCase > getAllBooks > should filter by genre
✓ BookController API > GET /api/books > should return all books
✓ BookController API > POST /api/books > should create a new book
```

### Integration Testing

Test API endpoints manually:

```bash
# Health check
curl http://localhost:3000/api/health

# Get all books
curl http://localhost:3000/api/books

# Create a book
curl -X POST http://localhost:3000/api/books \
  -H "Content-Type: application/json" \
  -d '{
    "isbn": "9781234567890",
    "title": "Test Book",
    "authors": ["Test Author"],
    "publisher": "Test Publisher",
    "publishingYear": 2023,
    "type": "reference"
  }'

# Search books
curl "http://localhost:3000/api/search?q=typescript"
```

## 🚢 Deployment

### Production Build

```bash
npm run build
NODE_ENV=production npm start
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern TypeScript and Node.js
- Uses SQLite for simple, file-based storage
- Progressive Web App capabilities
- Clean Architecture principles
- SOLID design patterns

---

**Happy Reading! 📚**
