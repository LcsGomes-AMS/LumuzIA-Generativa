import { auth } from "./config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Aguarda o Firebase restaurar a sessão antes de consultar currentUser.
const authReady = new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
    }, reject);
});

export { auth, onAuthStateChanged };

export function redirectToLogin() {
    document.documentElement.setAttribute("data-auth-pending", "");
    window.location.replace("./cad.html");
}

export async function endSession() {
    document.documentElement.setAttribute("data-auth-pending", "");
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao encerrar a sessão:", error);
    } finally {
        redirectToLogin();
    }
}

export async function requireUser() {
    await authReady;
    const user = auth.currentUser;

    if (!user || user.isAnonymous) {
        redirectToLogin();
        throw new Error("Faça login ou crie uma conta para continuar.");
    }

    return user;
}
