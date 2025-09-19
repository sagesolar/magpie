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
- **Cross-Platform**: Works on desktop, tablet, and mobile

### 🔐 Authentication & User Management

- **Google OAuth Integration**: Secure login with Google accounts using OpenID Connect
- **Personal Collections**: Each user has their own private book collection
- **Data Privacy**: Books are private to users with optional controlled sharing
- **Session Management**: Secure authentication with automatic session handling
- **Profile Integration**: User profile and avatar from Google account

### 🔄 Advanced Offline Mode

Magpie features a robust offline-first architecture that ensures seamless functionality even in areas with poor connectivity:

#### 📱 Persistent Authentication

- **Offline User Identity**: User authentication persists across connectivity loss and browser sessions
- **Smart Token Management**: Gracefully handles expired tokens while maintaining offline functionality
- **Session Resilience**: Continue using the app after initial login, even if authentication servers are unavailable

#### 💾 Intelligent Data Sync

- **Local-First Storage**: All book operations work immediately using IndexedDB for local storage
- **Change Tracking**: Automatically tracks all Create, Update, and Delete operations performed offline
- **Conflict Resolution**: Smart handling of data conflicts when reconnecting to the server

#### 🔍 User-Controlled Synchronization

- **No Auto-Sync**: Changes are never automatically pushed to the server without user confirmation
- **Sync Notifications**: Visual badge on sync button shows count of pending offline changes
- **Change Review**: Comprehensive review interface shows exactly what will be synchronized:
  - 📚 **Books to Create**: New books added while offline
  - ✏️ **Books to Update**: Modified book details, favorites, read status
  - 🗑️ **Books to Delete**: Books removed from collection
- **Detailed Change History**: View timestamps, affected books, and change summaries
- **Book Details Preview**: Inspect individual book changes before confirming sync
- **One-Click Confirmation**: Review all changes and sync with single user confirmation

#### 🎯 Offline Capabilities

- **Full CRUD Operations**: Add, edit, delete, and organize books completely offline
- **Search & Filter**: Search your book collection and apply filters without connectivity
- **Favorites & Reading Status**: Mark books as favorites or read/unread offline
- **Book Details**: Access and modify all book metadata and personal notes
- **Visual Feedback**: Clear offline mode indicators and sync status throughout the UI

#### 🔄 Smart Reconnection

- **Automatic Detection**: Detects when connectivity is restored
- **Pending Changes Badge**: Prominent notification when changes are ready to sync
- **Error Handling**: Graceful failure handling with retry options for sync operations
- **Data Integrity**: Ensures no data loss during the offline-to-online transition

This offline-first approach ensures that users can fully manage their book collections regardless of connectivity, making Magpie perfect for use in bookshops, libraries, basements, or anywhere with intermittent internet access.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (LTS)
- npm 9+
- Google OAuth credentials (see setup guide in docs/)

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

3. **Build and start**:

   ```bash
   npm run build
   npm start
   ```

   For development:

   ```bash
   npm run dev
   ```

4. **Access the application**:
   - PWA: http://localhost:3000
   - API Health: http://localhost:3000/api/health

> For detailed setup instructions including Google OAuth configuration, see the [documentation](docs/).

## 📋 API Overview

### Main Endpoints

- **Authentication**: OAuth login, user profile, session management
- **Books**: CRUD operations, search, filtering, pagination
- **Sharing**: Book sharing and access control
- **External Data**: Fetch book metadata from external sources

> For complete API documentation and examples, see the [API documentation](docs/).

## 🔧 Configuration

### Environment Variables

See `.env.example` for required configuration variables. 

**Security Note**: Never commit actual credentials or sensitive configuration to version control.

> For detailed configuration instructions, see the [setup documentation](docs/).

### Database

The system uses Google Cloud Firestore as its NoSQL document database.

> For database setup and configuration details, see [Firestore Setup Guide](docs/FIRESTORE_SETUP.md).

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
│       ├── api.js     # API service layer
│       ├── app.js     # Main application logic
│       ├── auth.js    # Authentication service
│       ├── db.js      # IndexedDB offline storage
│       └── camera-ocr.js # Camera/OCR functionality
├── scripts/database/   # Database seeding and management
├── Dockerfile          # Docker containerization
├── firebase.json       # Firebase hosting configuration
├── firestore.rules     # Firestore security rules
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── .env.example        # Environment template
```

### 🔧 Offline Architecture

Magpie uses an offline-first architecture with:

- **IndexedDB Storage**: Local database for offline book management
- **Service Worker**: Caches resources and enables offline functionality  
- **Change Tracking**: Queues offline operations for later synchronization
- **User-Controlled Sync**: Review and confirm changes before syncing to server

> For technical implementation details, see [Technical Documentation](docs/).

## 🧪 Testing

The project includes comprehensive unit tests with 95%+ coverage.

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Development watch mode
npm run test:coverage    # Generate coverage report
npm run test:ci          # CI-friendly test run
```

> For detailed testing information and examples, see [Testing Documentation](docs/).

## 🚢 Deployment

### Production Build

```bash
npm run build
NODE_ENV=production npm start
```

> For complete deployment instructions including Docker and cloud deployment, see [Deployment Guide](docs/DEPLOYMENT.md).

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) folder:

- **[Setup & Configuration](docs/)** - Database setup, CI/CD configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Security Guide](docs/SECURITY.md)** - Security best practices
- **[Firestore Setup](docs/FIRESTORE_SETUP.md)** - Database configuration guide

---

**Happy Reading! 📚**
