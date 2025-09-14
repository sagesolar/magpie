<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements - Magpie Book Collection System: Node.js + TypeScript backend API with REST endpoints, Progressive Web App (PWA) frontend with offline support, clean SOLID architecture

- [x] Scaffold the Project - Created clean architecture backend with domain, application, infrastructure, and API layers

- [x] Customize the Project - Implemented clean architecture with SOLID principles, REST API, PWA frontend, Firestore database, external book API integration

- [x] Install Required Extensions - No specific extensions required

- [x] Compile the Project - Successfully built TypeScript to JavaScript, all dependencies installed and working

- [x] Create and Run Task - Successfully created and launched development server task, running on port 3000

- [x] Launch the Project - Successfully launched the Magpie Book Collection System

- [x] Ensure Documentation is Complete - README.md and copilot-instructions.md are complete with current project information

- [x] Setup CI/CD Pipeline - GitHub workflows for development and production deployment to Google Cloud Platform

- [x] Configure Google Cloud Resources - Firestore databases, service accounts, IAM roles, and secret management for both dev and prod environments

- [x] Enable Google Cloud APIs - Enabled all required APIs for both dev and prod: Artifact Registry, Cloud Run, Cloud Build, Firebase, Firebase Hosting, Firestore, IAM, Cloud Resource Manager

- [x] Setup Artifact Registry - Created Docker repositories in both environments with proper authentication and service account permissions

- [x] Configure Service Account Permissions - Added Artifact Registry writer permissions to GitHub Actions service accounts for Docker image pushing

- [x] Setup GitHub Secrets - Repository and environment secrets configured for secure deployment automation

- [x] Setup Firebase Hosting - Created Firebase projects with Hosting enabled and service account authentication configured

- [x] Configure PWA API Integration - Updated PWA to dynamically load backend API URLs from generated config.js files during deployment

## Project Summary

The Magpie Book Collection System has been successfully created with full CI/CD pipeline:

### Backend Features

- Clean Architecture with SOLID principles
- Node.js + TypeScript REST API
- Google Cloud Firestore database with complete book management
- External book data fetching (OpenLibrary API)
- Comprehensive validation with Zod
- Error handling and logging

### Frontend Features

- Progressive Web App (PWA) with offline support
- Service Worker for caching assets and offline functionality
- Responsive design with modern CSS architecture
- CSS-based book cover placeholders with gradients
- Magpie branding with horizontally-flipped logo
- Modern favicon and PWA icons
- Toast notifications with branded icons
- Web App Manifest for installable app experience
- Offline-first architecture with IndexedDB storage
- Dynamic API endpoint configuration for different environments

### API Endpoints

- GET /api/health - Health check
- GET /api/books - Get all books with filtering, sorting, pagination
- GET /api/books/:isbn - Get book by ISBN
- POST /api/books - Create new book
- PUT /api/books/:isbn - Update book
- DELETE /api/books/:isbn - Delete book
- GET /api/search?q=query - Search books
- GET /api/external/:isbn - Fetch external book data
- PUT /api/books/:isbn/favourite - Toggle favorite
- PUT /api/books/:isbn/loan - Update loan status

### Database Management

- **Firestore Integration**: Native Firestore database with TypeScript models and repositories
- **Database Setup Scripts**: Automated database configuration and metadata setup
- **Seeding Scripts**: Database seeding with sample book data for development and testing
- **NPM Scripts**:
  - `npm run db:setup` - Initialize database metadata and configuration
  - `npm run db:seed` - Populate database with sample book collection data
- **Development Data**: Sample books with various genres, authors, and metadata for testing
- **Environment-Specific**: Separate databases for development and production environments
- **Schema Validation**: Zod schemas ensure data consistency across database operations

### Firebase Configuration

- **Firebase Hosting**: PWA deployment platform with custom domain support and CDN
- **Firebase Configuration**: `firebase.json` defines hosting rules, rewrites, and headers
- **Service Worker Caching**: Special headers for service worker files to prevent caching issues
- **Single Page Application**: Rewrites all routes to `/index.html` for client-side routing
- **Firebase CLI Integration**: Automated deployment via Firebase CLI in CI/CD pipeline
- **Environment-Specific Projects**: Separate Firebase projects for development and production
- **Service Account Authentication**: CI/CD uses Firebase service accounts for automated deployments
- **Static Asset Serving**: Direct serving of PWA files from `public/` directory

### PWA Configuration & Deployment

- **Static File Structure**: Frontend assets served directly from `public/` directory
- **Service Worker**: `sw.js` provides offline caching and asset management
- **Web App Manifest**: `manifest.json` defines PWA installation and appearance settings
- **Dynamic API Configuration**: `config.js` file generated during deployment with environment-specific backend URLs
- **Firebase Hosting**: PWA deployed to Firebase Hosting with custom domain support
- **Offline Storage**: IndexedDB integration for offline book data persistence
- **Installation Support**: Users can install the app directly from their browser
- **Cross-Platform**: Works on desktop, mobile, and tablet devices
- **No Build Step**: Static files deployed directly without bundling or compilation

### Development

- Development server running on http://localhost:3000
- API accessible at http://localhost:3000/api
- Auto-reload with ts-node-dev
- TypeScript compilation working
- All dependencies installed
- Windows setup script available: `.\scripts\setup-windows.ps1`
- CSS organized into modular files (main.css, components.css, books.css, forms.css)
- PWA assets properly configured with service worker caching

### Deployment & CI/CD

- Single unified GitHub Actions workflow for all deployment scenarios
- Smart conditional logic determines deployment target based on trigger type
- Development environment: Deploy on PR creation/updates for testing and validation
- Production environment: Deploy on main branch pushes, releases, or manual dispatch
- Cloud Run for backend API hosting with containerized deployments
- Firebase Hosting for PWA frontend with dynamic API endpoint configuration and static file serving
- Firestore databases for both development and production environments
- Comprehensive testing, building, and deployment automation
- Environment protection rules for production deployments requiring approval
- Service account authentication and secret management for secure deployments
- Docker image building and pushing to Artifact Registry for both environments

### Google Cloud Platform Setup

- **Development Project**: Configured with dedicated GCP project
  - **APIs Enabled**: Artifact Registry, Cloud Run, Cloud Build, Firebase, Firebase Hosting, Firestore, IAM, Cloud Resource Manager
  - **Artifact Registry**: Docker repository for backend container images
  - **Firestore Database**: Development environment database
  - **Firebase Hosting**: PWA deployment with custom domain and CDN support
  - **Service Accounts**: Backend, GitHub Actions, and Firebase Admin service accounts with proper IAM roles
  - **Cloud Run Service**: Backend API deployment target
  - **Docker Authentication**: Configured for secure image pushing from CI/CD
  - **Firebase Service Accounts**: Configured for automated PWA deployments

- **Production Project**: Configured with dedicated GCP project
  - **APIs Enabled**: Artifact Registry, Cloud Run, Cloud Build, Firebase, Firebase Hosting, Firestore, IAM, Cloud Resource Manager
  - **Artifact Registry**: Docker repository for backend container images
  - **Firestore Database**: Production environment database
  - **Firebase Hosting**: PWA deployment with custom domain and CDN support
  - **Service Accounts**: Backend, GitHub Actions, and Firebase Admin service accounts with proper IAM roles
  - **Cloud Run Service**: Backend API deployment target
  - **Docker Authentication**: Configured for secure image pushing from CI/CD
  - **Firebase Service Accounts**: Configured for automated PWA deployments

### Infrastructure Requirements

To replicate this setup in new environments:

1. **Enable Required APIs**: Artifact Registry, Cloud Run, Cloud Build, Firebase, Firebase Hosting, Firestore, IAM, Cloud Resource Manager
2. **Create Artifact Registry**: Docker repository in target region for container storage
3. **Configure Service Accounts**: GitHub Actions service account with Artifact Registry writer, Cloud Run admin, Storage admin, and Service Account user roles
4. **Setup Firestore Database**: Native mode database in target region
5. **Configure Docker Authentication**: Enable gcloud credential helper for Artifact Registry
6. **Initialize Database**: Run `npm run db:setup` to configure database metadata
7. **Seed Development Data**: Run `npm run db:seed` to populate with sample books for testing
8. **Verify Permissions**: Ensure service accounts can push to registry and deploy to Cloud Run

### GitHub Workflows

- **Unified CI/CD Pipeline**: Single workflow file (ci-cd.yml) handles all deployment scenarios with smart conditional logic
- **Development Deployment**: Triggered on pull request creation/updates - deploys backend and frontend to dev environment for testing
- **Production Deployment**: Triggered on push to main branch or release creation - deploys to production environment with approval gates
- **Manual Deployment**: Workflow dispatch allows manual triggering for either dev or prod environment via GitHub Actions UI
- **Release Deployment**: GitHub releases automatically trigger production deployment
- **Environment Protection**: Production deployments require manual approval and use environment-specific secrets
- **Security**: Service account key authentication with proper IAM roles for both environments

The project is ready for development and production deployment with full CI/CD automation!
