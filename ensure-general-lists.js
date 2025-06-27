const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, query, where } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBYgkWQjf9Fxt28JklkOnITBSbRDdILkA",
  authDomain: "share-3f94b.firebaseapp.com",
  projectId: "share-3f94b",
  storageBucket: "share-3f94b.firebasestorage.app",
  messagingSenderId: "927972049756",
  appId: "1:927972049756:web:a4d137e84d7e19bf23f799"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function ensureGeneralListsForAllUsers() {
  try {
    console.log('Starting to ensure all users have a General list...');
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnapshot.size} users`);
    
    let createdCount = 0;
    let existingCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`Processing user: ${userData.username || userData.name || userId}`);
      
      // Check if user already has a General list
      const listsQuery = query(
        collection(db, 'lists'),
        where('userId', '==', userId),
        where('name', '==', 'General')
      );
      
      const listsSnapshot = await getDocs(listsQuery);
      
      if (listsSnapshot.empty) {
        // Create General list for this user
        await addDoc(collection(db, 'lists'), {
          userId: userId,
          name: 'General',
          description: 'Default list for all posts',
          privacyLevel: 'public',
          isPublic: true,
          createdAt: new Date(),
          deletedAt: null
        });
        
        console.log(`✅ Created General list for user: ${userData.username || userData.name || userId}`);
        createdCount++;
      } else {
        console.log(`ℹ️  User already has General list: ${userData.username || userData.name || userId}`);
        existingCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total users processed: ${usersSnapshot.size}`);
    console.log(`General lists created: ${createdCount}`);
    console.log(`Users with existing General lists: ${existingCount}`);
    console.log('✅ All users now have a General list!');
    
  } catch (error) {
    console.error('Error ensuring General lists:', error);
    throw error;
  }
}

// Run the script
ensureGeneralListsForAllUsers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 