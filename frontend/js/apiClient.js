// apiClient.js
// Importe a instância "auth" do seu config.js (a mesma usada no login).
// Ex.: import { auth } from "./config.js";
import { auth } from "./config.js";

const API_BASE = ""; // mesmo host, ajuste se o front e o back estiverem em domínios diferentes

/**
 * Faz fetch() para a API sempre anexando o Firebase ID token no header
 * Authorization. Use isso no lugar de fetch() puro em todos os arquivos
 * (gastos.js, receitas.js, metas.js, investimentos.js, dashboard.js, chat.js, perfil.js).
 *
 * Exemplo:
 *   const res = await apiFetch("/gastos", {
 *     method: "POST",
 *     body: JSON.stringify({ descricao, valor, categoria }),
 *   });
 */
export async function apiFetch(path, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Usuário não autenticado.");
    }

    // getIdToken() reaproveita o token em cache e só renova perto de expirar
    const token = await user.getIdToken();

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
        // token expirado/inválido -> manda de volta pro login
        window.location.href = "./cad.html";
        throw new Error("Sessão expirada.");
    }

    return res;
}