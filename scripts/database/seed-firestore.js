// Firestore seeding script
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function seedData() {
  console.log('Seeding Firestore with initial data...');

  try {
    // Load seed data
    const seedDataPath = path.join(__dirname, 'seed-data.json');
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));

    console.log(`Found ${seedData.length} books to seed`);

    // Check if any books already exist
    const booksCollection = db.collection('books');
    const existingBooks = await booksCollection.limit(1).get();

    if (!existingBooks.empty) {
      console.log('WARNING: Books collection already contains data');
      console.log('   Skipping seed data to avoid duplicates');
      console.log('   To force reseed, delete existing data first');
      return;
    }

    // Seed books
    const batch = db.batch();
    let seededCount = 0;

    for (const book of seedData) {
      // Add timestamps
      book.createdAt = admin.firestore.FieldValue.serverTimestamp();
      book.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      // Use ISBN as document ID
      const bookRef = booksCollection.doc(book.isbn);
      batch.set(bookRef, book);
      seededCount++;
    }

    // Commit batch
    await batch.commit();

    // Update stats
    const statsRef = db.collection('system').doc('stats');
    await statsRef.set(
      {
        totalBooks: seededCount,
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`SUCCESS: Successfully seeded ${seededCount} books`);
  } catch (error) {
    console.error('ERROR: Error seeding data:', error);
    throw error;
  }
}

// Run seeding
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('SUCCESS: Database seeding complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('FAILED: Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedData };
