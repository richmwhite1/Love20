// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDBYgkWQjf9Fxt28JklkOnITBSbRDdILkA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "share-3f94b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "share-3f94b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "share-3f94b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "927972049756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:927972049756:web:a4d137e84d7e19bf23f799",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-1YJ4JDVKK8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
