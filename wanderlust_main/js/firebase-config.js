// Firebase CDN imports (no npm needed)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signOut, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbgdHEH_htXsaDhJ72ikYtEwUJ81u7Dqw",
  authDomain: "wanderlustbagsph-816c1.firebaseapp.com",
  projectId: "wanderlustbagsph-816c1",
  storageBucket: "wanderlustbagsph-816c1.firebasestorage.app",
  messagingSenderId: "636378988315",
  appId: "1:636378988315:web:ce8e59a66f6f4b8be21dbe",
  measurementId: "G-TR5RS6XMTB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set session-only persistence - user logs out when browser/tab closes
// This provides better security: session doesn't persist after browser close
auth.setPersistence(browserSessionPersistence).catch((error) => {
  console.warn("Firebase persistence setting failed:", error);
});

const db = getFirestore(app);

// Export so other JS files can use them
export { auth, db, signOut };