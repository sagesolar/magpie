# PowerShell Database Viewer Script for Magpie Book Collection
# Views the current contents of the Firestore database

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT_ID,
    [string]$DatabaseId = $env:FIRESTORE_DATABASE_ID,
    [switch]$Help
)

# Help information
if ($Help) {
    Write-Host @"
📊 Magpie Database Viewer Script

DESCRIPTION:
    Displays the current contents of the Firestore database

USAGE:
    .\scripts\view-database.ps1 [OPTIONS]

OPTIONS:
    -ProjectId <string>     GCP Project ID (default: env GOOGLE_CLOUD_PROJECT_ID)
    -DatabaseId <string>    Firestore Database ID (default: env FIRESTORE_DATABASE_ID)
    -Help                   Show this help message

EXAMPLES:
    .\scripts\view-database.ps1
    .\scripts\view-database.ps1 -ProjectId "my-project" -DatabaseId "my-db"

REQUIREMENTS:
    - Google Cloud CLI (gcloud) installed and authenticated
    - Proper GCP permissions for Firestore read access

"@
    exit 0
}

# Color functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Step { param($Message) Write-Host "🔄 $Message" -ForegroundColor Blue }

# Header
Write-Host @"
📊 Magpie Database Viewer
$('=' * 50)
"@ -ForegroundColor Magenta

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

Write-Info "Project ID: $ProjectId"
Write-Info "Database ID: $DatabaseId"

# Set current project
Write-Step "Setting GCP project..."
try {
    gcloud config set project $ProjectId 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Connected to project $ProjectId"
    } else {
        throw "Failed to set project"
    }
} catch {
    Write-Error "Failed to set GCP project: $($_.Exception.Message)"
    exit 1
}

# Query books using gcloud firestore
Write-Step "Querying books collection..."
try {
    # Use gcloud firestore documents list to get book data
    $booksList = gcloud firestore documents list --collection=books --format="json" --project=$ProjectId --database=$DatabaseId 2>$null
    
    if ($LASTEXITCODE -eq 0 -and $booksList) {
        $books = $booksList | ConvertFrom-Json
        $bookCount = $books.Count
        
        Write-Success "Found $bookCount books in database"
        Write-Host "`n📚 Books Collection:" -ForegroundColor Yellow
        
        if ($bookCount -eq 0) {
            Write-Info "   No books found in database"
        } else {
            $counter = 1
            foreach ($bookDoc in $books) {
                $bookPath = $bookDoc.name
                $isbn = ($bookPath -split '/')[-1]
                
                # Get individual book data
                $bookDataJson = gcloud firestore documents describe $bookPath --format="json" 2>$null
                if ($bookDataJson) {
                    $bookData = $bookDataJson | ConvertFrom-Json
                    $fields = $bookData.fields
                    
                    $title = if ($fields.title.stringValue) { $fields.title.stringValue } else { "Unknown Title" }
                    $authors = if ($fields.authors.arrayValue.values) { 
                        ($fields.authors.arrayValue.values | ForEach-Object { $_.stringValue }) -join ", "
                    } else { "Unknown Author" }
                    $genre = if ($fields.genre.stringValue) { $fields.genre.stringValue } else { "Unknown" }
                    $year = if ($fields.publishingYear.integerValue) { $fields.publishingYear.integerValue } else { "Unknown" }
                    $isFav = if ($fields.isFavourite.booleanValue) { "⭐" } else { "" }
                    $location = if ($fields.physicalLocation.stringValue) { $fields.physicalLocation.stringValue } else { "Not specified" }
                    
                    Write-Host "`n$counter. $title $isFav" -ForegroundColor White
                    Write-Host "   📖 ISBN: $isbn" -ForegroundColor Gray
                    Write-Host "   👤 Authors: $authors" -ForegroundColor Gray
                    Write-Host "   🏷️  Genre: $genre" -ForegroundColor Gray
                    Write-Host "   📅 Year: $year" -ForegroundColor Gray
                    Write-Host "   📍 Location: $location" -ForegroundColor Gray
                    
                    $counter++
                }
            }
        }
        
    } else {
        Write-Warning "Could not retrieve books using gcloud firestore"
        Write-Info "Falling back to Node.js script..."
        
        # Fallback to Node.js script if available
        if (Test-Path "scripts\database\view-database.js") {
            $env:GOOGLE_CLOUD_PROJECT_ID = $ProjectId
            $env:FIRESTORE_DATABASE_ID = $DatabaseId
            node "scripts\database\view-database.js"
        } else {
            Write-Error "Unable to retrieve database contents"
        }
    }
    
} catch {
    Write-Error "Failed to query database: $($_.Exception.Message)"
    Write-Info "Trying alternative method..."
    
    # Fallback method
    if (Test-Path "scripts\database\view-database.js") {
        $env:GOOGLE_CLOUD_PROJECT_ID = $ProjectId
        $env:FIRESTORE_DATABASE_ID = $DatabaseId
        node "scripts\database\view-database.js"
    }
}

Write-Host "`n$('=' * 50)" -ForegroundColor Magenta
Write-Success "Database view complete"