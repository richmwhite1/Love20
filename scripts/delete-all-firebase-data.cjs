const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json'); // <-- update this path if needed

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
    console.log(`Deleted ${uids.length} users`);
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

async function main() {
  await deleteAllUsers();
  await deleteCollection('users');
  await deleteCollection('lists');
  // Uncomment below if you want to delete posts, notifications, etc.
  // await deleteCollection('posts');
  // await deleteCollection('notifications');
  // await deleteCollection('other-collection');
  console.log('All users and data deleted.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 