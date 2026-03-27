// app/firebaseConfig.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase config from your project
const firebaseConfig = {
  apiKey: "AIzaSyDxtdc4kO4D7mpOM1KFbzybljR6VkyEGJs",
  authDomain: "flix-app-2808.firebaseapp.com",
  projectId: "flix-app-2808",
  storageBucket: "flix-app-2808.firebasestorage.app",
  messagingSenderId: "443329765236",
  appId: "1:443329765236:web:6359d46fdfd42004f31621",
  measurementId: "G-YH9PV70SZ2"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Export Auth module
export const auth = getAuth(app);