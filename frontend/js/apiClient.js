import { requireUser, endSession } from "./session.js";

const API_BASE = "";

export async function apiFetch(path, options = {}) {
    const user = await requireUser();

    const request = async (forceRefresh = false) => {
        const token = await user.getIdToken(forceRefresh);
        const headers = new Headers(options.headers);
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        headers.set("Authorization", `Bearer ${token}`);

        return fetch(`${API_BASE}${path}`, { ...options, headers });
    };

    try {
        let response = await request();

        // Renova uma vez; se o servidor continuar recusando, encerra a sessão.
        if (response.status === 401) {
            response = await request(true);
            if (response.status === 401) {
                await endSession();
                throw new Error("Sessão expirada. Faça login novamente.");
            }
        }

        return response;
    } catch (error) {
        if ([
            "auth/user-token-expired",
            "auth/invalid-user-token",
            "auth/user-disabled",
            "auth/user-not-found"
        ].includes(error.code)) {
            await endSession();
        }
        throw error;
    }
}
