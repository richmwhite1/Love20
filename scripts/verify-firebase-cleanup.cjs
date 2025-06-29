const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function checkAuthUsers() {
  console.log('\n=== Firebase Authentication Users ===');
  try {
    const listUsersResult = await auth.listUsers(1000);
    console.log(`Total users in Auth: ${listUsersResult.users.length}`);
    if (listUsersResult.users.length > 0) {
      console.log('Remaining users:');
      listUsersResult.users.forEach(user => {
        console.log(`  - ${user.uid} (${user.email || 'no email'})`);
      });
    } else {
      console.log('✅ No users found in Firebase Authentication');
    }
  } catch (error) {
    console.error('Error checking Auth users:', error.message);
  }
}

async function checkCollection(collectionName) {
  console.log(`\n=== Firestore Collection: ${collectionName} ===`);
  try {
    const snapshot = await db.collection(collectionName).get();
    console.log(`Total documents: ${snapshot.docs.length}`);
    if (snapshot.docs.length > 0) {
      console.log('Sample documents:');
      snapshot.docs.slice(0, 5).forEach(doc => {
        console.log(`  - ${doc.id}: ${JSON.stringify(doc.data(), null, 2).substring(0, 100)}...`);
      });
      if (snapshot.docs.length > 5) {
        console.log(`  ... and ${snapshot.docs.length - 5} more documents`);
      }
    } else {
      console.log(`✅ Collection ${collectionName} is empty`);
    }
  } catch (error) {
    console.error(`Error checking collection ${collectionName}:`, error.message);
  }
}

async function listAllCollections() {
  console.log('\n=== All Firestore Collections ===');
  try {
    const collections = await db.listCollections();
    console.log(`Total collections found: ${collections.length}`);
    collections.forEach(collection => {
      console.log(`  - ${collection.id}`);
    });
  } catch (error) {
    console.error('Error listing collections:', error.message);
  }
}

async function main() {
  console.log('🔍 Verifying Firebase Data Cleanup...\n');
  
  // Check Firebase Auth users
  await checkAuthUsers();
  
  // List all collections first
  await listAllCollections();
  
  // Check key collections
  const keyCollections = [
    'users',
    'posts', 
    'lists',
    'notifications',
    'comments',
    'hashtags',
    'postHashtags',
    'postLikes',
    'friendRequests',
    'friendships',
    'blacklist',
    'reports',
    'postTags',
    'taggedPosts',
    'profileEnergyRatings',
    'postEnergyRatings',
    'rsvps',
    'hashtagFollows',
    'urlClicks',
    'audit_logs'
  ];
  
  for (const collection of keyCollections) {
    await checkCollection(collection);
  }
  
  console.log('\n=== Summary ===');
  console.log('If you see "✅" messages above, those collections are properly cleaned.');
  console.log('If you see document counts > 0, those collections still contain data.');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
