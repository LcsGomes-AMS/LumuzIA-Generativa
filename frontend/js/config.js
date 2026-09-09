import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC71keQEOVxGO1ax1GqFMZdhW-Jv-XFt_M",
  authDomain: "lumuzia-bb98d.firebaseapp.com",
  projectId: "lumuzia-bb98d",
  storageBucket: "lumuzia-bb98d.firebasestorage.app",
  messagingSenderId: "175766461880",
  appId: "1:175766461880:web:7046115ecfabe82355434d",
  measurementId: "G-1YEBX4EEDL"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);