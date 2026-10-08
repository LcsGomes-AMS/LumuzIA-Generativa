import { auth, requireUser, endSession } from "./session.js";

export async function apiFetch(path, options = {}) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
        throw new Error("Caminho de API inválido.");
    }
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("Caminho de API inválido.");
    const user = await requireUser();
    const sameUser = () => {
        if (auth.currentUser?.uid !== user.uid) throw new Error("A conta mudou. Recarregue a página.");
    };

    const request = async (forceRefresh = false) => {
        sameUser();
        const token = await user.getIdToken(forceRefresh);
        sameUser();
        const headers = new Headers(options.headers);
        if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        headers.set("Authorization", `Bearer ${token}`);

        const response = await fetch(url.href, { ...options, headers, cache: "no-store", redirect: "error" });
        sameUser();
        return response;
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
