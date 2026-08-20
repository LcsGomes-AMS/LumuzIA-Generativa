import { auth } from "./config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const authForm = document.getElementById("authForm");
const forgotForm = document.getElementById("forgotForm");
const msg = document.getElementById("msg");
const submitBtn = document.getElementById("submitBtn");
const googleBtn = document.getElementById("googleBtn");

const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const forgotEmailInput = document.getElementById("forgotEmail");
const forgotSubmitBtn = document.getElementById("forgotSubmitBtn");

const cardTitle = document.getElementById("cardTitle");
const cardSub = document.getElementById("cardSub");
const divider = document.getElementById("divider");

const forgotLink = document.getElementById("forgotLink");
const backToLoginLink = document.getElementById("backToLoginLink");

const tabs = document.querySelectorAll(".tab");
let modoAtual = "login"; // "login" ou "signup"

function mostrarMensagem(texto, tipo = "info") {
    if (!msg) return;
    msg.textContent = texto;
    msg.className = `msg show ${tipo}`;
}

function limparMensagem() {
    if (!msg) return;
    msg.textContent = "";
    msg.className = "msg";
}

function traduzirErroFirebase(err) {
    const codigo = err?.code || "";
    const mapa = {
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-disabled": "Esta conta foi desativada.",
        "auth/user-not-found": "E-mail ou senha incorretos.",
        "auth/wrong-password": "E-mail ou senha incorretos.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/email-already-in-use": "Este e-mail já está cadastrado.",
        "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
        "auth/popup-closed-by-user": "Login com Google cancelado."
    };
    return mapa[codigo] || "Ocorreu um erro. Tente novamente.";
}

// =====================
// Alternância entre abas Entrar / Criar conta
// =====================
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        modoAtual = tab.dataset.tab;
        limparMensagem();

        if (modoAtual === "signup") {
            nameField.style.display = "block";
            cardTitle.innerText = "Criar conta";
            cardSub.innerText = "Preencha os dados para começar.";
            submitBtn.innerText = "Criar conta";
        } else {
            nameField.style.display = "none";
            cardTitle.innerText = "Bem-vindo de volta";
            cardSub.innerText = "Entre para continuar sua conversa.";
            submitBtn.innerText = "Entrar";
        }
    });
});

// =====================
// Login / Cadastro com e-mail e senha
// =====================
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparMensagem();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const name = nameInput.value.trim();

    submitBtn.disabled = true;

    try {
        if (modoAtual === "signup") {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name) {
                await updateProfile(cred.user, { displayName: name });
            }
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }

        window.location.href = "./dashboard.html";
    } catch (err) {
        console.error(err);
        mostrarMensagem(traduzirErroFirebase(err), "error");
    } finally {
        submitBtn.disabled = false;
    }
});

// =====================
// Login com Google
// =====================
if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        limparMensagem();
        googleBtn.disabled = true;

        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            window.location.href = "./dashboard.html";
        } catch (err) {
            console.error(err);
            mostrarMensagem(traduzirErroFirebase(err), "error");
        } finally {
            googleBtn.disabled = false;
        }
    });
}

// =====================
// Esqueci minha senha
// =====================
if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        limparMensagem();
        authForm.style.display = "none";
        forgotForm.style.display = "block";
        if (divider) divider.style.display = "none";
        if (googleBtn) googleBtn.style.display = "none";
        cardTitle.innerText = "Redefinir senha";
        cardSub.innerText = "Informe seu e-mail para receber o link.";
    });
}

if (backToLoginLink) {
    backToLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        limparMensagem();
        forgotForm.style.display = "none";
        authForm.style.display = "block";
        if (divider) divider.style.display = "block";
        if (googleBtn) googleBtn.style.display = "flex";
        cardTitle.innerText = "Bem-vindo de volta";
        cardSub.innerText = "Entre para continuar sua conversa.";
    });
}

if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparMensagem();

        const email = forgotEmailInput.value.trim();
        forgotSubmitBtn.disabled = true;

        try {
            await sendPasswordResetEmail(auth, email);
            mostrarMensagem("Link de redefinição enviado! Verifique seu e-mail.", "info");
        } catch (err) {
            console.error(err);
            mostrarMensagem(traduzirErroFirebase(err), "error");
        } finally {
            forgotSubmitBtn.disabled = false;
        }
    });
}

// =====================
// Se já estiver logado, pula direto pro dashboard
// =====================
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "./dashboard.html";
    }
});