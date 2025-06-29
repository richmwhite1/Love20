import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read service account key
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../server/serviceAccountKey.json'), 'utf8')
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'share-3f94b'
});

const db = admin.firestore();

const defaultLists = [
  {
    name: "General",
    description: "My general posts and thoughts",
    privacy: "public",
    isDefault: true
  },
  {
    name: "Personal",
    description: "Personal thoughts and experiences",
    privacy: "connections",
    isDefault: true
  },
  {
    name: "Work",
    description: "Work-related posts and updates",
    privacy: "public",
    isDefault: true
  }
];

async function createDefaultListsForUser(userId) {
  try {
    console.log(`Creating default lists for user: ${userId}`);
    
    for (const listData of defaultLists) {
      const listRef = db.collection('lists').doc();
      await listRef.set({
        ...listData,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Created list: ${listData.name}`);
    }
    
    console.log(`Successfully created ${defaultLists.length} default lists for user: ${userId}`);
  } catch (error) {
    console.error(`Error creating default lists for user ${userId}:`, error);
  }
}

async function checkAndCreateDefaultLists() {
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Check if user has any lists
      const listsSnapshot = await db.collection('lists')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (listsSnapshot.empty) {
        console.log(`User ${userId} has no lists, creating defaults...`);
        await createDefaultListsForUser(userId);
      } else {
        console.log(`User ${userId} already has lists, skipping...`);
      }
    }
    
    console.log('Default list creation process completed!');
  } catch (error) {
    console.error('Error in checkAndCreateDefaultLists:', error);
  }
}

// Run the script
checkAndCreateDefaultLists()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 