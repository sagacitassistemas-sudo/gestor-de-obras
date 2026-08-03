/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Load config from JSON file or environment
import configData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: configData.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: configData.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: configData.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: configData.storageBucket || '',
  messagingSenderId: configData.messagingSenderId || '',
  appId: configData.appId || ''
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, (configData as any).firestoreDatabaseId || undefined);
