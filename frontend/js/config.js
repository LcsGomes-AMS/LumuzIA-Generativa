import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYHdzCPoYipHo3mzJfHeDv4h-A0BNNrMY",
  authDomain: "lumuz-e2f23.firebaseapp.com",
  projectId: "lumuz-e2f23",
  storageBucket: "lumuz-e2f23.firebasestorage.app",
  messagingSenderId: "523410509147",
  appId: "1:523410509147:web:fd1c9a5fd37504f7e29e7e",
  measurementId: "G-2QRKRY2QLP"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);