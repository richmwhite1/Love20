const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

// Firebase config (you'll need to replace with your actual config)
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
    console.log('🧪 Testing user creation with default lists...\n');
    
    // Create a test user
    const email = `test-${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    console.log(`📧 Creating user with email: ${email}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ User created in Firebase Auth:', user.uid);
    
    // Check if user document exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      console.log('✅ User document created in Firestore');
      console.log('   📝 User data:', userDoc.data());
    } else {
      console.log('❌ User document not found in Firestore');
    }
    
    // Check for default lists
    console.log('\n📋 Checking for default lists...');
    const listsQuery = query(collection(db, 'lists'), where('userId', '==', user.uid));
    const listsSnapshot = await getDocs(listsQuery);
    const lists = listsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`✅ Found ${lists.length} lists for user`);
    
    const expectedLists = [
      { name: 'General', privacy: 'public' },
      { name: 'Favorites', privacy: 'public' },
      { name: 'Wishlist', privacy: 'connections' }
    ];
    
    for (const expectedList of expectedLists) {
      const found = lists.find(list => list.name === expectedList.name);
      if (found) {
        console.log(`✅ Found "${expectedList.name}" list`);
        console.log(`   🔒 Privacy: ${found.privacyLevel} (expected: ${expectedList.privacy})`);
        console.log(`   📝 Description: ${found.description || 'No description'}`);
      } else {
        console.log(`❌ Missing "${expectedList.name}" list`);
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - User created: ✅`);
    console.log(`   - User document: ${userDoc.exists() ? '✅' : '❌'}`);
    console.log(`   - Lists created: ${lists.length}/3`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testUserCreation(); 