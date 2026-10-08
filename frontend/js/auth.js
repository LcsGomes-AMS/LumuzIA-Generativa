import { auth } from "./config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

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
let autenticando = false;

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
        "auth/popup-closed-by-user": "Login com Google cancelado.",
        "auth/popup-blocked": "Pop-up bloqueado. Redirecionando...",
        "auth/cancelled-popup-request": "Login com Google cancelado.",
        "auth/network-request-failed": "Erro de rede. Verifique sua conexão.",
        "auth/unauthorized-domain": "Este endereço ainda não está autorizado para login. Verifique os domínios autorizados no Firebase.",
        "auth/operation-not-allowed": "Este método de login ainda não está habilitado no Firebase."
    };
    return mapa[codigo] || "Ocorreu um erro. Tente novamente.";
}

// =====================
// Alternância entre abas Entrar / Criar conta
// =====================
function selecionarModo(modo) {
    modoAtual = modo;
    tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === modo));
    limparMensagem();
    authForm.style.display = "block";
    forgotForm.style.display = "none";
    if (divider) divider.style.display = "block";
    if (googleBtn) googleBtn.style.display = "flex";
    const cadastro = modo === "signup";
    nameField.style.display = cadastro ? "block" : "none";
    cardTitle.innerText = cadastro ? "Criar conta" : "Bem-vindo de volta";
    cardSub.innerText = cadastro ? "Preencha os dados para começar." : "Entre ou crie uma conta para usar a LumuzIA.";
    submitBtn.innerText = cadastro ? "Criar conta" : "Entrar";
    passwordInput.autocomplete = cadastro ? "new-password" : "current-password";
}

tabs.forEach(tab => {
    tab.addEventListener("click", () => selecionarModo(tab.dataset.tab));
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
    autenticando = true;

    try {
        if (modoAtual === "signup") {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name) {
                try {
                    await updateProfile(cred.user, { displayName: name });
                } catch (profileError) {
                    // A conta já foi criada; o nome pode ser atualizado no perfil.
                    console.error("Erro ao salvar o nome da conta:", profileError);
                }
            }
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }

        window.location.replace("./como-usar.html");
    } catch (err) {
        console.error(err);
        mostrarMensagem(traduzirErroFirebase(err), "error");
    } finally {
        autenticando = false;
        submitBtn.disabled = false;
    }
});

// =====================
// Login com Google
// Tenta popup primeiro; se falhar (bloqueado), usa redirect como fallback.
// =====================
const googleProvider = new GoogleAuthProvider();

if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        limparMensagem();
        googleBtn.disabled = true;

        try {
            // Tenta abrir o popup do Google
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user) {
                window.location.replace("./como-usar.html");
            }
        } catch (err) {
            console.error("Erro no login Google:", err);

            // Usa redirecionamento quando o navegador bloqueia o popup.
            if (err.code === "auth/popup-blocked") {
                mostrarMensagem("Redirecionando para login com Google...", "info");
                try {
                    await signInWithRedirect(auth, googleProvider);
                } catch (redirectErr) {
                    console.error("Erro no redirect:", redirectErr);
                    mostrarMensagem(traduzirErroFirebase(redirectErr), "error");
                    googleBtn.disabled = false;
                }
            } else {
                mostrarMensagem(traduzirErroFirebase(err), "error");
                googleBtn.disabled = false;
            }
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
        selecionarModo("login");
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
// Captura o resultado do login com Google após redirect (fallback)
// =====================
getRedirectResult(auth)
    .then((result) => {
        if (result && result.user) {
            window.location.replace("./como-usar.html");
        }
    })
    .catch((err) => {
        if (err.code) {
            console.error("Erro no redirect do Google:", err);
            mostrarMensagem(traduzirErroFirebase(err), "error");
        }
    });

// =====================
// Se já estiver logado, abre a plataforma após concluir o cadastro.
// =====================
onAuthStateChanged(auth, (user) => {
    if (user?.isAnonymous) {
        void signOut(auth);
        return;
    }
    if (user && !autenticando) {
        window.location.replace("./como-usar.html");
    }
});