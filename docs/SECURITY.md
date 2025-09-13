# 🔒 Secure GitHub Repository Setup Guide

## 🚨 **Security Best Practices for Public Repositories**

### **⚠️ Never Commit These to Public Repos:**

- GCP Project IDs
- Database names
- Service account keys
- API keys or tokens
- Internal URLs or endpoints
- Resource names that reveal infrastructure

## 🛡️ **Secure Configuration Strategy**

### **1. Use GitHub Secrets for All Sensitive Data**

Add these secrets to GitHub → Settings → Secrets and variables → Actions:

#### **📋 Required GitHub Secrets**

| Secret Name                     | Description                      | Example Value          |
| ------------------------------- | -------------------------------- | ---------------------- |
| `GCP_PROJECT_ID_DEV`            | Development GCP Project ID       | `your-dev-project-id`  |
| `GCP_PROJECT_ID_PROD`           | Production GCP Project ID        | `your-prod-project-id` |
| `CLOUD_RUN_SERVICE_DEV`         | Dev Cloud Run service name       | `your-backend-dev`     |
| `CLOUD_RUN_SERVICE_PROD`        | Prod Cloud Run service name      | `your-backend-prod`    |
| `CLOUD_RUN_REGION`              | Cloud Run region                 | `us-central1`          |
| `FIREBASE_PROJECT_ID_DEV`       | Firebase dev project ID          | `your-dev-project-id`  |
| `FIREBASE_PROJECT_ID_PROD`      | Firebase prod project ID         | `your-prod-project-id` |
| `FIRESTORE_DATABASE_ID_DEV`     | Firestore dev database name      | `your-dev-db-name`     |
| `FIRESTORE_DATABASE_ID_PROD`    | Firestore prod database name     | `your-prod-db-name`    |
| `GCP_SA_KEY_DEV`                | Development service account JSON | `{...}`                |
| `GCP_SA_KEY_PROD`               | Production service account JSON  | `{...}`                |
| `FIREBASE_SERVICE_ACCOUNT_DEV`  | Firebase dev service account     | `{...}`                |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Firebase prod service account    | `{...}`                |

### **2. Local Development Configuration**

Create a `.env.local` file (already in `.gitignore`):

```env
# Local development configuration (NEVER commit)
GOOGLE_CLOUD_PROJECT_ID=your-actual-dev-project-id
FIRESTORE_DATABASE_ID=your-actual-dev-db-name
GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/local-service-account.json
```

### **3. Repository Security Checklist**

#### **✅ Files Safe for Public Repository:**

- Source code without hardcoded secrets
- Generic configuration templates
- Documentation with placeholder values
- GitHub Actions workflows using secrets
- Docker configurations

#### **❌ Files to Keep Private/Secured:**

- `.env` files with real values
- Service account JSON files
- Any file with actual project IDs
- Database connection strings
- API keys

## 🔧 **Implementation Steps**

### **Step 1: Update Local Firebase Configuration**

```bash
# Update .firebaserc with your actual project IDs
firebase use --add your-actual-dev-project-id
firebase use --add your-actual-prod-project-id
```

### **Step 2: Add GitHub Secrets**

Go to your GitHub repository:

1. Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret from the table above

### **Step 3: Update Setup Scripts**

The setup scripts should prompt for project IDs instead of hardcoding them:

```bash
# Example: Interactive setup
read -p "Enter your development GCP project ID: " DEV_PROJECT_ID
read -p "Enter your production GCP project ID: " PROD_PROJECT_ID
```

### **Step 4: Create Environment-Specific Config**

Create a configuration management system:

```typescript
// config/environments.ts
export const config = {
  development: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    databaseId: process.env.FIRESTORE_DATABASE_ID!,
    // ... other dev config
  },
  production: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
    databaseId: process.env.FIRESTORE_DATABASE_ID!,
    // ... other prod config
  },
};
```

## 🛡️ **Additional Security Measures**

### **1. Repository Settings**

- Consider making the repository private if it contains business logic
- Enable branch protection rules
- Require pull request reviews
- Enable secret scanning alerts

### **2. Access Control**

- Limit collaborator access
- Use teams for permission management
- Regularly audit repository access

### **3. Monitoring**

- Enable GitHub security advisories
- Set up Dependabot for dependency updates
- Monitor for leaked secrets

### **4. Documentation Security**

- Use placeholder values in all documentation
- Create separate private documentation for actual deployment values
- Include security warnings in README

## 📋 **Migration Steps for Existing Repository**

If you've already committed sensitive data:

### **1. Clean Git History**

```bash
# Remove sensitive files from Git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/sensitive/file' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: This rewrites history)
git push origin --force --all
```

### **2. Rotate All Secrets**

- Generate new service account keys
- Update all API keys
- Change database names if necessary
- Update any exposed resource names

### **3. Update Team**

- Notify team members about the security update
- Ensure everyone updates their local configurations
- Review and update deployment procedures

## 🌟 **Best Practices Summary**

### **✅ DO:**

- Use GitHub secrets for all sensitive data
- Use placeholder values in committed files
- Keep a separate private document with actual values
- Regularly rotate credentials
- Monitor for accidental commits of secrets

### **❌ DON'T:**

- Hardcode project IDs in public repositories
- Commit service account files
- Expose internal infrastructure details
- Use predictable naming patterns for production resources

## 🚨 **Emergency Response**

If you accidentally commit sensitive data:

1. **Immediately rotate affected credentials**
2. **Remove the sensitive data from Git history**
3. **Force push to overwrite history**
4. **Update all team members**
5. **Review logs for any unauthorized access**

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security practices!
