import { auth, db } from "./config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let mode = "login";

const tabs = document.querySelectorAll(".tab");
const nameField = document.getElementById("nameField");
const cardTitle = document.getElementById("cardTitle");
const cardSub = document.getElementById("cardSub");
const submitBtn = document.getElementById("submitBtn");
const form = document.getElementById("authForm");
const googleBtn = document.getElementById("googleBtn");
const msg = document.getElementById("msg");

const forgotForm = document.getElementById("forgotForm");
const forgotLink = document.getElementById("forgotLink");
const backToLoginLink = document.getElementById("backToLoginLink");
const divider = document.getElementById("divider");

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.tab;
    hideMsg();

    if (mode === "signup") {
      nameField.style.display = "block";
      cardTitle.textContent = "Criar sua conta";
      cardSub.textContent = "Leva menos de um minuto.";
      submitBtn.textContent = "Criar conta";
    } else {
      nameField.style.display = "none";
      cardTitle.textContent = "Bem-vindo de volta";
      cardSub.textContent = "Entre para continuar sua conversa.";
      submitBtn.textContent = "Entrar";
    }
  });
});

function showMsg(text, type = "error") {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}

function hideMsg() {
  msg.className = "msg";
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  googleBtn.disabled = loading;
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/user-not-found": "Nenhuma conta encontrada com este e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet."
  };
  return map[code] || "Ocorreu um erro. Tente novamente.";
}

async function createProfileDoc(user, extra = {}) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName || extra.name || "",
      email: user.email,
      provider: extra.provider || "password",
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  setLoading(true);

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const name = document.getElementById("name").value.trim();

  try {
    if (mode === "signup") {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await createProfileDoc(cred.user, { name, provider: "password" });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(friendlyError(err.code));
  } finally {
    setLoading(false);
  }
});

googleBtn.addEventListener("click", async () => {
  hideMsg();
  setLoading(true);
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await createProfileDoc(cred.user, { provider: "google.com" });
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(friendlyError(err.code));
  } finally {
    setLoading(false);
  }
});

// ---- Esqueceu a senha ----

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  const email = document.getElementById("forgotEmail").value.trim();
  const btn = document.getElementById("forgotSubmitBtn");

  btn.disabled = true;
  btn.textContent = "Enviando...";

  // Configuração do link de redefinição
  const actionCodeSettings = {
    url: "https://lumuzia-generativa.onrender.com/reset-password.html",
    handleCodeInApp: false,
  };

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    showMsg(
      "Enviamos um link de redefinição para o seu e-mail. Verifique também a caixa de spam.",
      "success"
    );

  } catch (error) {
    console.error(error);
    showMsg(friendlyError(error.code));
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar link de redefinição";
  }
});