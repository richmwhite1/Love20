const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');

// Firebase config (using the correct project ID)
const firebaseConfig = {
  apiKey: "AIzaSyBvOkJqHqHqHqHqHqHqHqHqHqHqHqHqHqHq",
  authDomain: "share-3f94b.firebaseapp.com",
  projectId: "share-3f94b",
  storageBucket: "share-3f94b.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSampleData() {
  try {
    console.log('🎯 Creating sample data for Love20...');
    
    // Create a test user
    const testUser = {
      id: 'test-user-123',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      profilePictureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await setDoc(doc(db, 'users', testUser.id), testUser);
    console.log('✅ Test user created');
    
    // Create sample posts
    const samplePosts = [
      {
        userId: testUser.id,
        content: 'Welcome to Love20! This is my first post. 🎉',
        type: 'post',
        privacy: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
        engagement: 5,
        likeCount: 3,
        commentCount: 2,
        shareCount: 0
      },
      {
        userId: testUser.id,
        content: 'Testing the Love20 app - it\'s amazing! ✨',
        type: 'post',
        privacy: 'public',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        updatedAt: new Date(Date.now() - 3600000),
        engagement: 8,
        likeCount: 5,
        commentCount: 3,
        shareCount: 1
      },
      {
        userId: testUser.id,
        content: 'Just created my first list! 📝',
        type: 'post',
        privacy: 'public',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        updatedAt: new Date(Date.now() - 7200000),
        engagement: 3,
        likeCount: 2,
        commentCount: 1,
        shareCount: 0
      }
    ];
    
    for (const post of samplePosts) {
      await addDoc(collection(db, 'posts'), post);
    }
    console.log('✅ Sample posts created');
    
    // Create default lists
    const defaultLists = [
      {
        userId: testUser.id,
        name: 'General',
        description: 'Default list for all posts',
        privacyLevel: 'public',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: testUser.id,
        name: 'Favorites',
        description: 'Your favorite posts',
        privacyLevel: 'public',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: testUser.id,
        name: 'Wishlist',
        description: 'Posts you want to remember',
        privacyLevel: 'connections',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    for (const list of defaultLists) {
      await addDoc(collection(db, 'lists'), list);
    }
    console.log('✅ Default lists created');
    
    console.log('\n🎉 Sample data created successfully!');
    console.log('📱 You can now test the app with this data.');
    console.log('👤 Test user ID: test-user-123');
    console.log('📝 Created 3 sample posts');
    console.log('📋 Created 3 default lists');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

createSampleData(); 