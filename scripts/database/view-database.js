#!/usr/bin/env node

/**
 * Display Database Contents in Detail
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
    } else {
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

async function displayDatabaseContents() {
    console.log('📊 Database Contents Report\n');
    console.log('='.repeat(50));
    
    try {
        // Get all books
        const booksCollection = db.collection('books');
        const books = await booksCollection.get();
        
        console.log(`\n📚 Books Collection: ${books.size} documents\n`);
        
        books.forEach((doc, index) => {
            const book = doc.data();
            console.log(`${index + 1}. ${book.title}`);
            console.log(`   📖 ISBN: ${doc.id}`);
            console.log(`   👤 Authors: ${book.authors?.join(', ') || 'Unknown'}`);
            console.log(`   🏷️  Genre: ${book.genre || 'Unknown'}`);
            console.log(`   📅 Year: ${book.publishingYear || 'Unknown'}`);
            console.log(`   ⭐ Favorite: ${book.isFavourite ? 'Yes' : 'No'}`);
            console.log(`   📍 Location: ${book.physicalLocation || 'Not specified'}`);
            console.log(`   🔄 Loan Status: ${book.loanStatus?.isLoaned ? 'Loaned out' : 'Available'}`);
            console.log('');
        });
        
        // Check system metadata
        const systemDoc = await db.collection('system').doc('stats').get();
        if (systemDoc.exists) {
            const stats = systemDoc.data();
            console.log('📈 System Statistics:');
            console.log(`   Total Books: ${stats.totalBooks}`);
            console.log(`   Last Sync: ${stats.lastSync?.toDate() || 'Unknown'}`);
            console.log(`   Updated: ${stats.updatedAt?.toDate() || 'Unknown'}`);
        } else {
            console.log('📈 System Statistics: Not initialized');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ Database Report Complete');
        
    } catch (error) {
        console.error('❌ Error reading database:', error.message);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    displayDatabaseContents()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('💥 Failed:', error.message);
            process.exit(1);
        });
}

module.exports = { displayDatabaseContents };