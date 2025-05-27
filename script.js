// Firebase initialization and export for use in other modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtqv4thV6R9KrI2Qlmqa-TTMhB0bUocxA",
  authDomain: "grit-802e6.firebaseapp.com",
  projectId: "grit-802e6",
  storageBucket: "grit-802e6.firebasestorage.app",
  messagingSenderId: "180225005875",
  appId: "1:180225005875:web:d5ac05f09529112ed60646",
  measurementId: "G-45F682645D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Call this after signup or login to ensure the root user doc exists
export async function ensureUserDocExists(userId) {
    await setDoc(doc(db, "users", userId), { createdAt: new Date().toISOString() }, { merge: true });
}
