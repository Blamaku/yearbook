// =====================================================
//  GLUK YEARBOOK 2026 — FIREBASE CONFIG
//  Replace the placeholder values below with your
//  actual Firebase project config.
//
//  HOW TO GET YOUR CONFIG:
//  1. Go to https://console.firebase.google.com
//  2. Open your project
//  3. Click the gear icon → Project Settings
//  4. Scroll to "Your apps" → click your web app
//  5. Copy the firebaseConfig object and paste below
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCmPQxO85kfiXbFe7hQ49BLQncDcmBWD0c",
  authDomain: "yearbook-d3f4f.firebaseapp.com",
  databaseURL: "https://yearbook-d3f4f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "yearbook-d3f4f",
  storageBucket: "yearbook-d3f4f.firebasestorage.app",
  messagingSenderId: "444628566195",
  appId: "1:444628566195:web:909c2ac7abbce5bd78b0c6"
};

// ── Initialise Firebase ────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// ── Firestore offline persistence (Phase 6) ────────
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firestore] Multiple tabs — persistence limited to one tab.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firestore] Offline persistence not supported in this browser.');
  }
});

// ── Admin account ──────────────────────────────────
// Create this account in Firebase Console → Authentication → Add user
// Email   : admin2026@gluk.ac.ke
// Password: admin2026
const ADMIN_EMAIL = 'admin2026@gluk.ac.ke';