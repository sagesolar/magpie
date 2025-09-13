# PowerShell Database Seeding Script for Magpie Book Collection
# Seeds the Firestore database with sample book data

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT_ID,
    [string]$DatabaseId = $env:FIRESTORE_DATABASE_ID,
    [switch]$Force,
    [switch]$Help
)

# Help information
if ($Help) {
    Write-Host @"
📚 Magpie Database Seeding Script

DESCRIPTION:
    Seeds the Firestore database with sample book data from seed-data.json

USAGE:
    .\scripts\seed-database.ps1 [OPTIONS]

OPTIONS:
    -ProjectId <string>     GCP Project ID (default: env GOOGLE_CLOUD_PROJECT_ID)
    -DatabaseId <string>    Firestore Database ID (default: env FIRESTORE_DATABASE_ID)
    -Force                  Clear existing data before seeding
    -Help                   Show this help message

EXAMPLES:
    .\scripts\seed-database.ps1
    .\scripts\seed-database.ps1 -ProjectId "my-project" -DatabaseId "my-db"
    .\scripts\seed-database.ps1 -Force

REQUIREMENTS:
    - Google Cloud CLI (gcloud) installed and authenticated
    - Node.js installed (for running seeding scripts)
    - Proper GCP permissions for Firestore access

"@
    exit 0
}

# Configuration
$SeedDataPath = "scripts\database\seed-data.json"
$CheckScriptPath = "scripts\database\check-database.js"
$SeedScriptPath = "scripts\database\seed-firestore.js"
$ViewScriptPath = "scripts\database\view-database.js"

# Color functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Step { param($Message) Write-Host "🔄 $Message" -ForegroundColor Blue }

# Header
Write-Host @"
🌱 Magpie Database Seeding Script
$('=' * 50)
"@ -ForegroundColor Magenta

# Check prerequisites
Write-Step "Checking prerequisites..."

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Google Cloud CLI is installed"
    } else {
        throw "gcloud command failed"
    }
} catch {
    Write-Error "Google Cloud CLI is not installed or not in PATH"
    Write-Info "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js is installed ($nodeVersion)"
    } else {
        throw "node command failed"
    }
} catch {
    Write-Error "Node.js is not installed or not in PATH"
    Write-Info "Install from: https://nodejs.org/"
    exit 1
}

# Check authentication
Write-Step "Checking authentication..."
try {
    $currentAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if ($currentAccount) {
        Write-Success "Authenticated as: $currentAccount"
    } else {
        Write-Warning "No active authentication found"
        Write-Info "Run: gcloud auth login"
        Write-Info "Or for application default: gcloud auth application-default login"
        exit 1
    }
} catch {
    Write-Error "Failed to check authentication"
    exit 1
}

# Validate parameters
if (-not $ProjectId) {
    Write-Error "Project ID is required"
    Write-Info "Set GOOGLE_CLOUD_PROJECT_ID environment variable or use -ProjectId parameter"
    exit 1
}

if (-not $DatabaseId) {
    Write-Error "Database ID is required"
    Write-Info "Set FIRESTORE_DATABASE_ID environment variable or use -DatabaseId parameter"
    exit 1
}

# Check if seed data exists
if (-not (Test-Path $SeedDataPath)) {
    Write-Error "Seed data file not found: $SeedDataPath"
    exit 1
}

# Load and validate seed data
Write-Step "Loading seed data..."
try {
    $seedData = Get-Content $SeedDataPath | ConvertFrom-Json
    $bookCount = $seedData.Count
    Write-Success "Loaded $bookCount books from seed data"
} catch {
    Write-Error "Failed to parse seed data: $($_.Exception.Message)"
    exit 1
}

# Set environment variables
Write-Step "Setting up environment..."
$env:GOOGLE_CLOUD_PROJECT_ID = $ProjectId
$env:FIRESTORE_DATABASE_ID = $DatabaseId

Write-Info "Project ID: $ProjectId"
Write-Info "Database ID: $DatabaseId"

# Set current project
Write-Step "Setting GCP project..."
try {
    gcloud config set project $ProjectId 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Set current project to $ProjectId"
    } else {
        throw "Failed to set project"
    }
} catch {
    Write-Error "Failed to set GCP project: $($_.Exception.Message)"
    exit 1
}

# Check if database exists
Write-Step "Verifying database access..."
try {
    $dbList = gcloud firestore databases list --format="value(name)" 2>$null
    $dbExists = $dbList -contains "projects/$ProjectId/databases/$DatabaseId"
    
    if ($dbExists) {
        Write-Success "Database $DatabaseId exists and is accessible"
    } else {
        Write-Error "Database $DatabaseId not found or not accessible"
        Write-Info "Available databases:"
        $dbList | ForEach-Object { Write-Info "  - $($_.Split('/')[-1])" }
        exit 1
    }
} catch {
    Write-Error "Failed to verify database access: $($_.Exception.Message)"
    exit 1
}

# Handle force flag - clear existing data
if ($Force) {
    Write-Step "Force flag detected - clearing existing data..."
    try {
        node $CheckScriptPath --force
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Existing data cleared"
        } else {
            Write-Warning "Clear operation completed with warnings"
        }
    } catch {
        Write-Error "Failed to clear existing data: $($_.Exception.Message)"
        exit 1
    }
}

# Run seeding
Write-Step "Seeding database..."
try {
    node $SeedScriptPath
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database seeding completed successfully"
    } else {
        Write-Warning "Seeding completed with warnings (data may already exist)"
    }
} catch {
    Write-Error "Database seeding failed: $($_.Exception.Message)"
    exit 1
}

# Display results
Write-Step "Verifying seeded data..."
try {
    node $ViewScriptPath
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database verification completed"
    }
} catch {
    Write-Warning "Could not verify database contents, but seeding appears successful"
}

# Summary
Write-Host @"

🎉 Database Seeding Complete!

📊 Summary:
   Project: $ProjectId
   Database: $DatabaseId
   Books Seeded: $bookCount
   
🚀 Next Steps:
   1. Start your development server: npm run dev
   2. Visit: http://localhost:3000
   3. Test the API endpoints with the seeded data
   
📖 Useful Commands:
   View Database:  node scripts\database\view-database.js
   Check Status:   node scripts\database\check-database.js
   Force Reseed:   .\scripts\seed-database.ps1 -Force

$('=' * 50)
"@ -ForegroundColor Green