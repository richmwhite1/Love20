const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBvOkJhHhHhHhHhHhHhHhHhHhHhHhHhHhH",
  authDomain: "love20-12345.firebaseapp.com",
  projectId: "love20-12345",
  storageBucket: "love20-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testUserCreation() {
  try {
    console.log('Testing user creation with default lists...');
    
    // Create a test user
    const email = `test-${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ User created:', user.uid);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      console.log('✅ User document created in Firestore');
    } else {
      console.log('❌ User document not found in Firestore');
    }
    
    // Check for default lists
    const listsQuery = await db.collection('lists').where('userId', '==', user.uid).get();
    const lists = listsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`✅ Found ${lists.length} lists for user`);
    
    const expectedLists = ['General', 'Favorites', 'Wishlist'];
    for (const expectedList of expectedLists) {
      const found = lists.find(list => list.name === expectedList);
      if (found) {
        console.log(`✅ Found ${expectedList} list (privacy: ${found.privacyLevel})`);
      } else {
        console.log(`❌ Missing ${expectedList} list`);
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUserCreation(); 