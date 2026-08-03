
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyMghZo93kMIouIJkq-4PG8ZU4FrhQdGk",
  authDomain: "feteps2027.firebaseapp.com",
  projectId: "feteps2027",
  storageBucket: "feteps2027.firebasestorage.app",
  messagingSenderId: "283844171197",
  appId: "1:283844171197:web:c2ab45f3ba15c26c20aed4",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);