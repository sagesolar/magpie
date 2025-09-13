#!/usr/bin/env node

/**
 * Check Database Contents and Force Reseed if needed
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  } else {
    admin.initializeApp({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  }
}

const db = admin.firestore();
const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

if (databaseId !== '(default)') {
  db.settings({ databaseId: databaseId });
}

async function checkAndClearDatabase() {
  console.log('🔍 Checking database contents...\n');

  try {
    // Check books collection
    const booksCollection = db.collection('books');
    const books = await booksCollection.get();

    console.log(`📚 Found ${books.size} books in database`);

    if (books.size > 0) {
      console.log('\n📖 Existing books:');
      books.forEach(doc => {
        const book = doc.data();
        console.log(`   - ${book.title} (${doc.id})`);
      });

      console.log('\n❓ Do you want to clear the database and reseed? (y/N)');

      // For automated execution, check if force flag is provided
      const forceFlag = process.argv.includes('--force');

      if (forceFlag) {
        console.log('🗑️  Force flag detected, clearing database...');
        await clearDatabase();
        return true; // Indicate we should reseed
      } else {
        console.log('❌ Database not cleared. To force clear and reseed, run:');
        console.log('   node scripts/database/check-database.js --force');
        console.log('   node scripts/database/seed-firestore.js');
        return false;
      }
    } else {
      console.log('✅ Database is empty, ready for seeding');
      return true;
    }
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    throw error;
  }
}

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');

  try {
    // Clear books collection
    const booksCollection = db.collection('books');
    const books = await booksCollection.get();

    const batch = db.batch();
    books.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleared ${books.size} books from database`);

    // Clear system metadata
    const systemDoc = db.collection('system').doc('stats');
    await systemDoc.delete();
    console.log('✅ Cleared system metadata');
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  checkAndClearDatabase()
    .then(shouldReseed => {
      if (shouldReseed) {
        console.log('\n🌱 Database is ready for seeding!');
        console.log('   Run: node scripts/database/seed-firestore.js');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { checkAndClearDatabase, clearDatabase };
