import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Firebase web API keys are not secrets — they just identify the project.
// Real access control lives in firestore.rules (see repo root), which is
// what actually decides who can read/write what.
const firebaseConfig = {
  apiKey: 'AIzaSyDBot8_xZXzu8hFXZ0nI7LtpGGrjwjgMsc',
  authDomain: 'sleep-gogo.firebaseapp.com',
  projectId: 'sleep-gogo',
  storageBucket: 'sleep-gogo.firebasestorage.app',
  messagingSenderId: '891937223736',
  appId: '1:891937223736:web:1ee983426033fd27d0a2cd',
};

export const ADMIN_EMAIL = 'sycovy0706@naver.com';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
