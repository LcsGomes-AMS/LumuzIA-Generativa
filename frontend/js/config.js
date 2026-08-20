import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBa11Ri21pkQiBZ6NGpIA3bUnxr2D_gm1E",
  authDomain: "lumuziaedfinanceira-3cd38.firebaseapp.com",
  projectId: "lumuziaedfinanceira-3cd38",
  storageBucket: "lumuziaedfinanceira-3cd38.firebasestorage.app",
  messagingSenderId: "533770695157",
  appId: "1:533770695157:web:1e227d89292efc2fc430bc",
  measurementId: "G-90MLECQM0V"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);