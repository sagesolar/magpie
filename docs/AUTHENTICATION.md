# Magpie Authentication & Ownership System Implementation Guide

## 🎯 Overview

This guide provides a complete implementation of modular authentication and ownership system for Magpie—a full-stack bibliotherapy PWA built with Node.js, TypeScript, Firestore, and clean architecture principles.

## 🏗️ Architecture Summary

### SOLID Principles Implementation

- **Single Responsibility**: Each module (auth, user, book) has a clear, isolated purpose
- **Open/Closed**: Components are extensible (e.g., support for other identity providers) without modifying core logic
- **Liskov Substitution**: Abstractions (token validator, user repository) can be swapped without breaking behavior
- **Interface Segregation**: Lean interfaces avoid bloated contracts between layers
- **Dependency Inversion**: Dependency injection for all services

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                            │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ AuthController  │    │ BookController  │                │
│  │ - login         │    │ - CRUD + auth   │                │
│  │ - profile       │    │ - sharing       │                │
│  │ - validate      │    │ - user context  │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ AuthUseCase     │    │ BookUseCase     │                │
│  │ - token login   │    │ - ownership     │                │
│  │ - user mgmt     │    │ - sharing       │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                           │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ User Types      │    │ Book Types      │                │
│  │ - UserContext   │    │ - Ownership     │                │
│  │ - TokenPayload  │    │ - Permissions   │                │
│  │ - Preferences   │    │ - Sharing       │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                      │
│  ┌───────────────┐ ┌─────────────────┐ ┌──────────────────┐ │
│  │ Google OIDC   │ │ Firestore Repos │ │ Auth Middleware  │ │
│  │ - Token Val   │ │ - User/Book     │ │ - Context Inject │ │
│  │ - PKCE Flow   │ │ - Ownership     │ │ - Route Guard    │ │
│  └───────────────┘ └─────────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Authentication Implementation

### 1. Google OIDC Integration

**Backend Token Validation:**

- Uses Google's public keys for ID token verification
- Validates issuer, audience, and expiration claims
- Extracts user information (sub, email, name, picture)

**Frontend Integration:**

- Google Identity Services for OIDC login
- Supports One Tap and popup login flows
- Maintains offline functionality

### 2. User Management

**Poetic Naming Conventions:**

- `nesters` → Users with access to books
- `owners` → Users who added books
- `sharedWith` → Array of user IDs with access
- `permissions` → Granular access rights
- `notifications` → User preferences

**User Domain Model:**

```typescript
interface User {
  id: string; // Google OAuth sub
  email: string;
  name: string;
  profilePictureUrl?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
```

## 📚 Book Ownership System

### 1. Ownership Fields

```typescript
interface Book {
  // ... existing fields
  ownerId: string; // User who added the book
  sharedWith: string[]; // Users with access
  permissions: BookPermissions; // Access rights
}

interface BookPermissions {
  canView: boolean;
  canEdit: boolean;
  canLoan: boolean;
  canShare: boolean;
  canRemove: boolean;
}
```

### 2. Firestore Queries

**User-Specific Filtering:**

- `array-contains` for single user access
- `array-contains-any` for multiple user filtering
- Owner-only filtering with `ownerId` field
- Shared collection filtering with sharedWith size

**Query Examples:**

```typescript
// Books accessible to user
query.where('sharedWith', 'array-contains', userId);

// Books curated by user
query.where('addedBy', '==', userId);

// Books shared with multiple users
query.where('sharedWith', 'array-contains-any', [user1, user2]);
```

## 🛡️ Security Implementation

### 1. Firestore Security Rules

```javascript
// Books collection access control
match /books/{isbn} {
  // Read if user in sharedWith and has view rights
  allow read: if request.auth != null
    && request.auth.uid in resource.data.sharedWith
    && resource.data.permissions.canView == true;  // Create if authenticated
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.addedBy;

  // Update with permission checks
  allow update: if request.auth != null
    && request.auth.uid in resource.data.sharedWith
    && hasPermission();
}
```

### 2. API Security

**Middleware Protection:**

- Public routes: Extract context (optional auth)
- Protected routes: Require authentication
- Permission validation: Check access rights

**Route Security:**

```typescript
// Public (with optional context)
router.get('/books', authMiddleware.extractContext(), controller.getAllBooks);

// Protected (require auth)
router.post('/books', authMiddleware.requireAuth(), controller.createBook);
```

## 🌐 Frontend Integration

### 1. Authentication Flow

```typescript
// Initialize and show login
await magpieAuth.initialize();
await magpieAuth.showLoginPrompt();

// Handle login events
window.addEventListener('magpie:login', event => {
  const { user, error } = event.detail;
  if (user) {
    updateUI(user);
    syncOfflineData();
  }
});
```

### 2. API Integration

```typescript
// Authenticated requests
const headers = {
  'Content-Type': 'application/json',
  ...magpieAuth.getAuthHeader(), // Adds Bearer token
};

// Create book with ownership
const response = await fetch('/api/books', {
  method: 'POST',
  headers,
  body: JSON.stringify(bookData),
});
```

### 3. Offline Support

- Token validation on app start
- Graceful degradation for anonymous users
- Offline data sync when coming online
- IndexedDB integration for local storage

## 🚀 API Endpoints

### Authentication Endpoints

```bash
POST /api/auth/login          # Google OIDC login
GET  /api/auth/profile        # Get user profile
PUT  /api/auth/profile        # Update profile
POST /api/auth/validate       # Validate token
POST /api/auth/logout         # Logout
DELETE /api/auth/profile      # Delete account
```

### Book Endpoints (Enhanced)

```bash
# Public (with optional user context)
GET  /api/books               # Get books (filtered by user access)
GET  /api/books/:isbn         # Get book (if user has access)
GET  /api/search?q=query      # Search (user's accessible books)

# Protected (require authentication)
POST /api/books               # Create book (auto-assign ownership)
PUT  /api/books/:isbn         # Update book (check permissions)
DELETE /api/books/:isbn       # Delete book (check permissions)

# User-specific
GET  /api/user/books          # Get user's collection
POST /api/books/:isbn/share   # Share book with others
DELETE /api/books/:isbn/share/:userId # Remove user access

# Special operations
PUT  /api/books/:isbn/favourite  # Toggle favorite (requires auth)
PUT  /api/books/:isbn/loan       # Update loan status (requires auth)
```

## 🔧 Configuration

### Environment Variables

```bash
# Required for authentication
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Optional
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
FIRESTORE_DATABASE_ID=your-database-id
```

### Frontend Configuration

```javascript
// public/config.js
window.magpieConfig = {
  apiBaseUrl: 'http://localhost:3000/api',
  googleClientId: 'your-client-id.apps.googleusercontent.com',
};
```

## 🧪 Testing Strategy

### Unit Tests (Planned)

```typescript
// Authentication
describe('GoogleOIDCTokenValidator', () => {
  it('should validate valid Google ID tokens');
  it('should reject invalid tokens');
  it('should handle token expiration');
});

// Ownership
describe('BookUseCase with Ownership', () => {
  it('should create book with correct ownership');
  it('should filter books by user access');
  it('should enforce sharing permissions');
});
```

### Integration Tests (Planned)

```typescript
// API endpoints
describe('Authentication API', () => {
  it('should login with valid Google token');
  it('should protect book creation routes');
  it('should share books between users');
});
```

## 📋 Implementation Checklist

- ✅ **Architecture Analysis** - Understood existing patterns
- ✅ **Dependencies** - Installed Google Auth Library and JWT tools
- ✅ **Domain Models** - Created user and authentication types
- ✅ **Book Ownership** - Added poetic ownership fields to book domain
- ✅ **Infrastructure** - Built token validator, user repository, middleware
- ✅ **Use Cases** - Implemented authentication and user management logic
- ✅ **Repository Enhancement** - Added ownership filtering and queries
- ✅ **Security Rules** - Implemented Firestore access control
- ✅ **API Security** - Applied middleware and user context injection
- ✅ **Frontend Integration** - Created OIDC login with offline support
- ⏳ **Testing** - Unit and integration tests (next phase)

## 🎨 Expressive Naming Guide

### Poetic Terms Used

- **Owner** - User who adds books to the collection
- **Shared Users** - Community of users sharing book access
- **Permissions** - User rights for book management
- **Notification Settings** - User preference settings
- **Theme** - UI appearance preferences
- **Collection Space** - User's personal collection area

### Future Enhancements

- **Reading Groups** - Shared reading communities
- **Advanced Customization** - Extended UI customization options
- **Data Migration** - Data export/import features
- **Time-based Collections** - Temporal book organization

## 🚀 Deployment Notes

1. **Environment Setup** - Configure Google OAuth and Firestore
2. **Security Rules** - Deploy updated Firestore rules
3. **Frontend Config** - Update config.js with production values
4. **SSL/HTTPS** - Required for Google OIDC in production
5. **CORS Configuration** - Set appropriate allowed origins

This implementation provides a robust, scalable, and maintainable authentication and ownership system that follows SOLID principles while maintaining clear, industry-standard terminology and preserving offline functionality.
