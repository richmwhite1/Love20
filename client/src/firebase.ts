// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration (temporary hardcoded)
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

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
