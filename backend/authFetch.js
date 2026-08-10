import { auth } from "./config.js";

/**
 * Substitui o "fetch" comum em todas as chamadas ao backend.
 * Pega o ID Token atual do usuário logado no Firebase e anexa
 * no header Authorization, que o backend valida no middleware.
 *
 * Uso: em vez de `fetch(url, options)`, use `authFetch(url, options)`.
 */
export async function authFetch(url, options = {}) {
    const user = auth.currentUser;

    if (!user) {
        throw new Error("Usuário não autenticado.");
    }

    const token = await user.getIdToken();

    const headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };

    return fetch(url, { ...options, headers });
}
