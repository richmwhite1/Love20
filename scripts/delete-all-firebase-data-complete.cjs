const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function deleteAllUsers(nextPageToken) {
  const listUsersResult = await auth.listUsers(1000, nextPageToken);
  const uids = listUsersResult.users.map(userRecord => userRecord.uid);
  if (uids.length > 0) {
    await auth.deleteUsers(uids);
    console.log(`Deleted ${uids.length} users from Firebase Auth`);
  }
  if (listUsersResult.pageToken) {
    await deleteAllUsers(listUsersResult.pageToken);
  }
}

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const batchSize = 500;
  let batch = db.batch();
  let count = 0;
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit();
  }
  console.log(`Deleted ${count} documents from ${collectionName}`);
}

async function deleteAllCollections() {
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} collections to delete`);
  
  for (const collection of collections) {
    await deleteCollection(collection.id);
  }
}

async function main() {
  console.log('🗑️  Starting complete Firebase data cleanup...\n');
  
  // Delete all Firebase Auth users
  console.log('1. Deleting all Firebase Auth users...');
  await deleteAllUsers();
  
  // Delete all Firestore collections
  console.log('2. Deleting all Firestore collections...');
  await deleteAllCollections();
  
  console.log('\n✅ Complete Firebase cleanup finished!');
  console.log('All users and data have been deleted from Firebase.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
