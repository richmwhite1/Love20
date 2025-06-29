import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';

const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const serviceAccountPath = process.env.FIREBASE_ADMIN_KEY_PATH || './firebase-admin-key.json';
    const serviceAccount = JSON.parse(readFileSync(path.resolve(serviceAccountPath), 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'share-3f94b', // Use environment variable or default
    });
  }
  return admin;
};

const firebaseAdmin = initializeFirebase();
export const db = firebaseAdmin.firestore();
export const auth = firebaseAdmin.auth();