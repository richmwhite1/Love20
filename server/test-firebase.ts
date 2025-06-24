// Create this file as: server/test-firebase.ts
import { db, auth } from './db';

async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    
    // Test Firestore connection
    const testDoc = await db.collection('test').doc('connection-test').get();
    console.log('✅ Firestore connection successful');
    
    // Test Auth connection
    try {
      await auth.listUsers(1);
      console.log('✅ Firebase Auth connection successful');
    } catch (authError) {
      console.log('⚠️ Firebase Auth connection issue:', authError.message);
    }
    
    console.log('Firebase setup appears to be working!');
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    console.error('Check your firebase-admin-key.json file and environment variables');
  }
}

testFirebaseConnection();
