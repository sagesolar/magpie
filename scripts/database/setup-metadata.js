// System metadata setup script
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account file
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
    } else {
        // Use default credentials (for Cloud Run)
        admin.initializeApp({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
    }
}

const db = admin.firestore();
const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

if (databaseId !== '(default)') {
    db.settings({ databaseId: databaseId });
}

async function setupMetadata() {
    console.log('Setting up system metadata...');
    
    const systemCollection = db.collection('system');
    
    try {
        // App configuration
        await systemCollection.doc('config').set({
            appName: 'Magpie Book Collection',
            version: '1.0.0',
            features: {
                offlineMode: true,
                cameraOCR: true,
                externalSearch: true,
                analytics: false
            },
            limits: {
                maxBooksPerUser: 10000,
                maxImageSizeMB: 5,
                maxDescriptionLength: 2000
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Database schema version
        await systemCollection.doc('schema').set({
            version: '1.0.0',
            lastMigration: null,
            collections: {
                books: {
                    version: '1.0.0',
                    fields: [
                        'isbn', 'title', 'authors', 'publisher', 'edition',
                        'publishingYear', 'pages', 'genre', 'description',
                        'coverImageUrl', 'goodreadsLink', 'physicalLocation',
                        'condition', 'notes', 'isFavourite', 'type', 'loanStatus',
                        'createdAt', 'updatedAt'
                    ]
                }
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Statistics (initial values)
        await systemCollection.doc('stats').set({
            totalBooks: 0,
            totalUsers: 0,
            lastBackup: null,
            lastSync: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('SUCCESS: System metadata initialized successfully');
        
    } catch (error) {
        console.error('ERROR: Error setting up metadata:', error);
        process.exit(1);
    }
}

// Run setup
setupMetadata()
    .then(() => {
        console.log('SUCCESS: Database metadata setup complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('FAILED: Setup failed:', error);
        process.exit(1);
    });