# Environment Variables for OIDC Authentication

## Required Environment Variables

### Google OAuth Configuration

```bash
# Google OAuth Client ID (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Optional: Custom allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-pwa-domain.com
```

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API (for user profile information)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen:
   - Application type: Web application
   - Add authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - Your production PWA domain
   - Add authorized redirect URIs:
     - `http://localhost:3000` (development)
     - Your production PWA domain
6. Copy the Client ID to your environment variables

### 2. Environment Setup

Create a `.env` file in your project root:

```bash
# Copy from .env.example and update with your values
GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
FIRESTORE_DATABASE_ID=your-firestore-database-id
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

### 3. Frontend Configuration

The frontend needs to know the Google Client ID for OIDC login.
Update your `public/config.js` file:

```javascript
window.magpieConfig = {
  apiBaseUrl: 'http://localhost:3000/api', // Your backend URL
  googleClientId: 'your-google-client-id.apps.googleusercontent.com',
};
```

### 4. Security Considerations

- Never expose your Client Secret in frontend code
- The backend validates ID tokens using Google's public keys
- Use HTTPS in production
- Configure appropriate CORS origins
- Implement proper token storage (httpOnly cookies recommended for production)

### 5. Testing

You can test authentication with these endpoints:

```bash
# Health check (should show authentication: enabled)
curl http://localhost:3000/api/health

# Login (requires Google ID token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-google-id-token"}'

# Get profile (requires Bearer token)
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer your-id-token"
```
