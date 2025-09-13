# CI/CD Pipeline Setup Guide

This guide will help you set up the complete CI/CD pipeline for the Magpie Book Collection System.

## 🏗️ **Architecture Overview**

### **Environments**
- **Development**: `your-dev-project-id`
  - Database: `your-dev-database-name`
  - Cloud Run: `your-dev-service-name`
  - Firebase Hosting: `your-dev-project.web.app`

- **Production**: `your-prod-project-id`
  - Database: `your-prod-database-name`
  - Cloud Run: `your-prod-service-name`
  - Firebase Hosting: `your-prod-project.web.app`

### **CI/CD Flow**
```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   develop   │───▶│   CI Tests   │───▶│  Deploy to Dev  │
│   branch    │    │   & Build    │    │                 │
└─────────────┘    └──────────────┘    └─────────────────┘

┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│    main     │───▶│   CI Tests   │───▶│ Deploy to Prod │
│   branch    │    │   & Build    │    │  (Protected)    │
└─────────────┘    └──────────────┘    └─────────────────┘
```

## 🚀 **Setup Instructions**

> **Windows Users**: Before following these instructions, run `.\scripts\setup-windows.ps1` in PowerShell to validate prerequisites and get setup guidance.

### **1. GCP Project Setup**

#### **Development Environment**
```bash
# Make the script executable
chmod +x scripts/setup-gcp-dev.sh

# Run the setup script
./scripts/setup-gcp-dev.sh
```

#### **Production Environment**
```bash
# Make the script executable
chmod +x scripts/setup-gcp-prod.sh

# Run the setup script
./scripts/setup-gcp-prod.sh
```

### **2. Firebase Setup**

#### **Initialize Firebase Projects**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize development project
firebase use your-dev-project-id
firebase init hosting

# Initialize production project
firebase use your-prod-project-id
firebase init hosting
```

#### **Get Firebase Service Account Keys**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (dev or prod)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate new private key**
5. Download the JSON file

### **3. GitHub Secrets Setup**

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

#### **Required Secrets**

| Secret Name | Description | Source |
|-------------|-------------|---------|
| `GCP_SA_KEY_DEV` | Development GCP service account key | `github-actions-dev-key.json` |
| `GCP_SA_KEY_PROD` | Production GCP service account key | `github-actions-prod-key.json` |
| `FIREBASE_SERVICE_ACCOUNT_DEV` | Firebase service account for dev | Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Firebase service account for prod | Firebase Console |

#### **Adding Secrets**
```bash
# 1. Copy the entire contents of the JSON files
cat github-actions-dev-key.json

# 2. Go to GitHub → Settings → Secrets → New repository secret
# 3. Name: GCP_SA_KEY_DEV
# 4. Value: Paste the entire JSON content

# Repeat for all secrets
```

### **4. GitHub Environment Protection**

#### **Set up Production Environment Protection**
1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name: `production`
4. Add protection rules:
   - ✅ **Required reviewers**: Add yourself/team
   - ✅ **Wait timer**: 5 minutes (optional)
   - ✅ **Deployment branches**: Only `main` branch

### **5. Branch Setup**

#### **Create Development Branch**
```bash
# Create and switch to develop branch
git checkout -b develop
git push -u origin develop

# Set up branch protection for main
# Go to GitHub → Settings → Branches → Add rule
# Branch name: main
# ✅ Require pull request reviews
# ✅ Require status checks (CI tests)
```

## 🔧 **Configuration Files**

### **Environment Variables**

#### **Development (Cloud Run)**
```env
GOOGLE_CLOUD_PROJECT_ID=your-dev-project-id
FIRESTORE_DATABASE_ID=your-dev-database-name
NODE_ENV=development
PORT=3000
```

#### **Production (Cloud Run)**
```env
GOOGLE_CLOUD_PROJECT_ID=your-prod-project-id
FIRESTORE_DATABASE_ID=your-prod-database-name
NODE_ENV=production
PORT=3000
```

### **Firestore Rules**

Add these rules in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Books collection
    match /books/{isbn} {
      // Allow read/write for now (adjust based on your auth requirements)
      allow read, write: if true;
      
      // For production with authentication:
      // allow read, write: if request.auth != null;
    }
  }
}
```

## 🧪 **Testing the Pipeline**

### **1. Test Development Deployment**
```bash
# Create a feature branch
git checkout -b feature/test-pipeline

# Make a small change
echo "# Test" >> README.md

# Commit and push to develop
git add .
git commit -m "test: pipeline deployment"
git checkout develop
git merge feature/test-pipeline
git push origin develop

# Check GitHub Actions tab for deployment
```

### **2. Test Production Deployment**
```bash
# Create a pull request from develop to main
# Or push directly to main (if allowed)
git checkout main
git merge develop
git push origin main

# Check GitHub Actions tab for production deployment
```

## 📊 **Monitoring & Verification**

### **Check Deployments**

#### **Cloud Run Services**
```bash
# Development
gcloud run services list --project=your-dev-project-id

# Production
gcloud run services list --project=your-prod-project-id
```

#### **Firebase Hosting**
```bash
# Check hosting sites
firebase hosting:sites:list --project=your-dev-project-id
firebase hosting:sites:list --project=your-prod-project-id
```

#### **Test API Endpoints**
```bash
# Development
curl https://your-backend-dev-xxx-uc.a.run.app/api/health

# Production
curl https://your-backend-prod-xxx-uc.a.run.app/api/health
```

## 🔒 **Security Considerations**

### **Service Account Permissions**
- GitHub Actions service accounts have minimal required permissions
- Cloud Run service accounts only have Firestore and Secret Manager access
- Firebase service accounts are project-specific

### **Secrets Management**
- All sensitive data stored in GCP Secret Manager
- GitHub secrets are encrypted at rest
- Service account keys should be rotated regularly

### **Network Security**
- Cloud Run services allow unauthenticated access (adjust if needed)
- Firestore rules should be configured based on your authentication requirements
- CORS is configured for your specific domains

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Service Account Permission Errors**
```bash
# Check service account permissions
gcloud projects get-iam-policy your-dev-project-id

# Add missing permissions
gcloud projects add-iam-policy-binding your-dev-project-id \
  --member="serviceAccount:github-actions-dev@your-dev-project-id.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

#### **2. Firestore Database Not Found**
```bash
# List databases
gcloud firestore databases list --project=your-dev-project-id

# Create database if missing
gcloud firestore databases create \
  --database=your-dev-database-name \
  --location=us-central1 \
  --project=your-dev-project-id
```

#### **3. Cloud Run Deployment Fails**
```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" \
  --project=your-dev-project-id \
  --limit=50
```

#### **4. Firebase Deployment Fails**
```bash
# Check Firebase project access
firebase projects:list

# Re-authenticate if needed
firebase login --reauth
```

## 📈 **Next Steps**

1. **Set up monitoring**: Configure Cloud Monitoring and Alerting
2. **Add health checks**: Implement comprehensive health endpoints
3. **Configure CDN**: Set up Cloud CDN for better performance
4. **Add staging environment**: Create a staging environment for pre-production testing
5. **Implement database migrations**: Set up database migration scripts
6. **Add integration tests**: Include end-to-end testing in the pipeline

## 🎉 **Success!**

Once everything is set up, you'll have:
- ✅ Automated testing on every PR
- ✅ Automatic deployment to dev on `develop` branch pushes
- ✅ Protected production deployment on `main` branch pushes
- ✅ Scalable Cloud Run backend
- ✅ Fast Firebase Hosting for PWA
- ✅ Secure secret management
- ✅ Environment separation