# Firestore Setup Guide for Magpie Book Collection

This guide will help you configure Google Cloud Firestore for the Magpie Book Collection System.

## Prerequisites

- Google Cloud Account
- Google Cloud Project (or create a new one)

## Setup Steps

### 1. Create/Select Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID (you'll need this later)

### 2. Enable Firestore API

1. In the Google Cloud Console, navigate to **Firestore**
2. Click **Create Database**
3. Choose **Start in test mode** (for development) or **Start in production mode**
4. Select your preferred region (choose one close to your users)
5. Click **Create**

### 3. Authentication Setup

#### Option A: Service Account (Recommended for Production)

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter a name and description for your service account
4. Click **Create and Continue**
5. Grant the following roles:
   - **Cloud Datastore User** (for read/write access)
   - **Firebase Admin SDK Administrator Service Agent** (if using Firebase Admin SDK)
6. Click **Continue** and then **Done**
7. Click on your newly created service account
8. Go to the **Keys** tab
9. Click **Add Key** > **Create new key**
10. Choose **JSON** format and click **Create**
11. Download and save the JSON file securely
12. Set the environment variable:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
    ```

#### Option B: Application Default Credentials (Development)

1. Install Google Cloud CLI:
   ```bash
   npm install -g @google-cloud/cli
   ```

2. Authenticate with your Google account:
   ```bash
   gcloud auth application-default login
   ```

3. Set your project:
   ```bash
   gcloud config set project YOUR-PROJECT-ID
   ```

### 4. Environment Configuration

Create a `.env` file in your project root:

```env
# Google Cloud Firestore Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id-here
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

### 5. Firestore Security Rules (Optional)

For production, configure Firestore security rules:

1. Go to **Firestore** > **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to books collection
    match /books/{bookId} {
      allow read, write: if true; // Adjust based on your authentication needs
    }
  }
}
```

### 6. Test the Connection

1. Start your Magpie server:
   ```bash
   npm run dev
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. Try creating a book:
   ```bash
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
   ```

## Firestore Collection Structure

The system uses a single collection called `books` with documents structured as:

```json
{
  "title": "Book Title",
  "authors": ["Author 1", "Author 2"],
  "publisher": "Publisher Name",
  "edition": "1st Edition",
  "publishingYear": 2023,
  "pages": 300,
  "genre": "Technology",
  "description": "Book description...",
  "coverImageUrl": "https://...",
  "goodreadsLink": "https://...",
  "physicalLocation": "Shelf A-1",
  "condition": "excellent",
  "notes": "Personal notes...",
  "isFavourite": false,
  "type": "reference",
  "loanStatus": {
    "isLoaned": false,
    "loanedTo": "",
    "loanedDate": null,
    "expectedReturnDate": null
  },
  "createdAt": "2023-09-13T10:00:00Z",
  "updatedAt": "2023-09-13T10:00:00Z"
}
```

## Troubleshooting

### Common Issues

1. **Authentication Error**: Ensure your service account key is valid and the path is correct
2. **Permission Denied**: Check that your service account has the correct IAM roles
3. **Project Not Found**: Verify your `GOOGLE_CLOUD_PROJECT_ID` is correct
4. **Firestore Not Enabled**: Make sure Firestore is enabled in your Google Cloud project

### Environment Variables Checklist

- [ ] `GOOGLE_CLOUD_PROJECT_ID` is set to your project ID
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` points to your service account JSON file
- [ ] Service account has Cloud Datastore User role
- [ ] Firestore is enabled in your Google Cloud project

## Migration from SQLite

If you're migrating from SQLite, your existing data structure should be compatible. However, you'll need to manually export/import your data or create a migration script.

For large datasets, consider using Firestore's bulk import/export features or the Firebase CLI tools.

## Next Steps

- Configure Firestore security rules for production
- Set up monitoring and alerting
- Consider implementing Firestore indexes for better query performance
- Explore Firestore's real-time features for live updates