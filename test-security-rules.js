const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');

const PROJECT_ID = 'love20-test';
const RULES_FILE = 'firestore.rules';

// Test data
const testUsers = {
  alice: { uid: 'alice', email: 'alice@example.com' },
  bob: { uid: 'bob', email: 'bob@example.com' },
  charlie: { uid: 'charlie', email: 'charlie@example.com' },
  admin: { uid: 'admin', email: 'admin@example.com' }
};

const testData = {
  publicPost: {
    userId: 'alice',
    privacy: 'public',
    content: 'Public post content',
    createdAt: new Date()
  },
  privatePost: {
    userId: 'alice',
    privacy: 'private',
    content: 'Private post content',
    createdAt: new Date()
  },
  connectionsPost: {
    userId: 'alice',
    privacy: 'connections',
    content: 'Connections-only post content',
    createdAt: new Date()
  },
  publicList: {
    userId: 'alice',
    privacyLevel: 'public',
    name: 'Public List',
    description: 'A public list'
  },
  privateList: {
    userId: 'alice',
    privacyLevel: 'private',
    name: 'Private List',
    description: 'A private list'
  },
  friendship: {
    userId: 'alice',
    friendId: 'bob',
    status: 'accepted'
  }
};

async function testSecurityRules() {
  console.log('🧪 Testing Firestore Security Rules...\n');

  // Initialize test environment
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8')
    }
  });

  try {
    // Test 1: User Authentication
    await testUserAuthentication(testEnv);
    
    // Test 2: Post Privacy Rules
    await testPostPrivacyRules(testEnv);
    
    // Test 3: List Privacy Rules
    await testListPrivacyRules(testEnv);
    
    // Test 4: Friendship Rules
    await testFriendshipRules(testEnv);
    
    // Test 5: Comment Rules
    await testCommentRules(testEnv);
    
    // Test 6: Like/Share Rules
    await testEngagementRules(testEnv);
    
    // Test 7: Admin Rules
    await testAdminRules(testEnv);
    
    // Test 8: Edge Cases
    await testEdgeCases(testEnv);

    console.log('✅ All security rule tests passed!');
  } catch (error) {
    console.error('❌ Security rule test failed:', error);
  } finally {
    await testEnv.cleanup();
  }
}

async function testUserAuthentication(testEnv) {
  console.log('🔐 Testing User Authentication...');
  
  const db = testEnv.authenticatedContext('alice').firestore();
  
  // Test: Authenticated user can read user data
  await assertSucceeds(
    db.collection('users').doc('alice').get()
  );
  
  // Test: Authenticated user can update their own data
  await assertSucceeds(
    db.collection('users').doc('alice').update({ name: 'Alice Updated' })
  );
  
  // Test: User cannot update other user's data
  await assertFails(
    db.collection('users').doc('bob').update({ name: 'Bob Updated' })
  );
  
  console.log('✅ User authentication tests passed');
}

async function testPostPrivacyRules(testEnv) {
  console.log('📝 Testing Post Privacy Rules...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  
  // Setup: Create posts
  await aliceDb.collection('posts').doc('public-post').set(testData.publicPost);
  await aliceDb.collection('posts').doc('private-post').set(testData.privatePost);
  await aliceDb.collection('posts').doc('connections-post').set(testData.connectionsPost);
  
  // Test: Public posts are readable by everyone
  await assertSucceeds(
    bobDb.collection('posts').doc('public-post').get()
  );
  
  await assertSucceeds(
    charlieDb.collection('posts').doc('public-post').get()
  );
  
  // Test: Private posts are only readable by owner
  await assertSucceeds(
    aliceDb.collection('posts').doc('private-post').get()
  );
  
  await assertFails(
    bobDb.collection('posts').doc('private-post').get()
  );
  
  await assertFails(
    charlieDb.collection('posts').doc('private-post').get()
  );
  
  // Test: Connections-only posts require friendship
  await assertFails(
    charlieDb.collection('posts').doc('connections-post').get()
  );
  
  // Setup: Create friendship between Alice and Bob
  await aliceDb.collection('friendships').doc('alice_bob').set(testData.friendship);
  
  // Test: Bob can now read Alice's connections-only post
  await assertSucceeds(
    bobDb.collection('posts').doc('connections-post').get()
  );
  
  console.log('✅ Post privacy tests passed');
}

async function testListPrivacyRules(testEnv) {
  console.log('📋 Testing List Privacy Rules...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  
  // Setup: Create lists
  await aliceDb.collection('lists').doc('public-list').set(testData.publicList);
  await aliceDb.collection('lists').doc('private-list').set(testData.privateList);
  
  // Test: Public lists are readable by everyone
  await assertSucceeds(
    bobDb.collection('lists').doc('public-list').get()
  );
  
  // Test: Private lists are only readable by owner
  await assertSucceeds(
    aliceDb.collection('lists').doc('private-list').get()
  );
  
  await assertFails(
    bobDb.collection('lists').doc('private-list').get()
  );
  
  // Test: Only owner can update lists
  await assertSucceeds(
    aliceDb.collection('lists').doc('public-list').update({ name: 'Updated List' })
  );
  
  await assertFails(
    bobDb.collection('lists').doc('public-list').update({ name: 'Hacked List' })
  );
  
  console.log('✅ List privacy tests passed');
}

async function testFriendshipRules(testEnv) {
  console.log('👥 Testing Friendship Rules...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  
  // Test: Users can create friendships
  await assertSucceeds(
    aliceDb.collection('friendships').doc('alice_bob').set(testData.friendship)
  );
  
  // Test: Users can read friendships they're part of
  await assertSucceeds(
    aliceDb.collection('friendships').doc('alice_bob').get()
  );
  
  await assertSucceeds(
    bobDb.collection('friendships').doc('alice_bob').get()
  );
  
  // Test: Users cannot read friendships they're not part of
  await assertFails(
    charlieDb.collection('friendships').doc('alice_bob').get()
  );
  
  // Test: Users can update friendships they're part of
  await assertSucceeds(
    bobDb.collection('friendships').doc('alice_bob').update({ status: 'blocked' })
  );
  
  console.log('✅ Friendship tests passed');
}

async function testCommentRules(testEnv) {
  console.log('💬 Testing Comment Rules...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  
  // Setup: Create a public post
  await aliceDb.collection('posts').doc('public-post').set(testData.publicPost);
  
  // Test: Users can comment on posts they can read
  await assertSucceeds(
    bobDb.collection('comments').doc('comment1').set({
      postId: 'public-post',
      userId: 'bob',
      text: 'Great post!',
      createdAt: new Date()
    })
  );
  
  // Test: Users cannot comment on posts they cannot read
  await assertFails(
    charlieDb.collection('comments').doc('comment2').set({
      postId: 'private-post',
      userId: 'charlie',
      text: 'This should fail',
      createdAt: new Date()
    })
  );
  
  // Test: Users can only update their own comments
  await assertSucceeds(
    bobDb.collection('comments').doc('comment1').update({ text: 'Updated comment' })
  );
  
  await assertFails(
    aliceDb.collection('comments').doc('comment1').update({ text: 'Hacked comment' })
  );
  
  console.log('✅ Comment tests passed');
}

async function testEngagementRules(testEnv) {
  console.log('❤️ Testing Engagement Rules...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  
  // Setup: Create a public post
  await aliceDb.collection('posts').doc('public-post').set(testData.publicPost);
  
  // Test: Users can like posts they can read
  await assertSucceeds(
    bobDb.collection('postLikes').doc('like1').set({
      postId: 'public-post',
      userId: 'bob',
      createdAt: new Date()
    })
  );
  
  // Test: Users cannot like posts they cannot read
  await assertFails(
    charlieDb.collection('postLikes').doc('like2').set({
      postId: 'private-post',
      userId: 'charlie',
      createdAt: new Date()
    })
  );
  
  // Test: Users can only unlike their own likes
  await assertSucceeds(
    bobDb.collection('postLikes').doc('like1').delete()
  );
  
  await assertFails(
    aliceDb.collection('postLikes').doc('like1').delete()
  );
  
  console.log('✅ Engagement tests passed');
}

async function testAdminRules(testEnv) {
  console.log('🔧 Testing Admin Rules...');
  
  const adminDb = testEnv.authenticatedContext('admin').firestore();
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  
  // Setup: Create admin user
  await adminDb.collection('adminUsers').doc('admin').set({
    userId: 'admin',
    role: 'admin',
    createdAt: new Date()
  });
  
  // Test: Admin can access admin collections
  await assertSucceeds(
    adminDb.collection('adminUsers').doc('admin').get()
  );
  
  await assertSucceeds(
    adminDb.collection('auditLogs').doc('log1').set({
      action: 'test',
      userId: 'admin',
      timestamp: new Date()
    })
  );
  
  // Test: Regular users cannot access admin collections
  await assertFails(
    aliceDb.collection('adminUsers').doc('admin').get()
  );
  
  await assertFails(
    aliceDb.collection('auditLogs').doc('log1').set({
      action: 'test',
      userId: 'alice',
      timestamp: new Date()
    })
  );
  
  console.log('✅ Admin tests passed');
}

async function testEdgeCases(testEnv) {
  console.log('🔍 Testing Edge Cases...');
  
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  
  // Test: Unauthenticated access is denied
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(
    unauthenticatedDb.collection('posts').doc('public-post').get()
  );
  
  // Test: Users cannot create posts for other users
  await assertFails(
    bobDb.collection('posts').doc('fake-post').set({
      userId: 'alice', // Bob trying to create post for Alice
      privacy: 'public',
      content: 'Fake post',
      createdAt: new Date()
    })
  );
  
  // Test: Users cannot access non-existent collections
  await assertFails(
    aliceDb.collection('nonexistent').doc('test').get()
  );
  
  console.log('✅ Edge case tests passed');
}

// Run the tests
if (require.main === module) {
  testSecurityRules().catch(console.error);
}

module.exports = { testSecurityRules }; 