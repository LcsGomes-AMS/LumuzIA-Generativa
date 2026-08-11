// apiClient.js

import { auth } from "./config.js";


// URL base da API
// Se frontend e backend estiverem no mesmo domínio,
// deixe vazio.
const API_BASE = "";


// =====================================================
// FETCH AUTENTICADO
// =====================================================

export async function apiFetch(path, options = {}) {

    const user = auth.currentUser;


    // Usuário não está logado
    if (!user) {

        window.location.href = "./cad.html";

        throw new Error("Usuário não autenticado.");

    }


    try {

        // Pega o Firebase ID Token
        const token = await user.getIdToken();


        // Headers padrão
        const headers = {

            "Content-Type": "application/json",

            "Authorization": `Bearer ${token}`,

            ...(options.headers || {})

        };


        // Faz a requisição
        const response = await fetch(
            `${API_BASE}${path}`,
            {
                ...options,
                headers
            }
        );


        // =================================================
        // TOKEN INVÁLIDO / EXPIRADO
        // =================================================

        if (response.status === 401) {

            console.warn(
                "Sessão Firebase inválida ou expirada."
            );

            // Tenta renovar o token uma vez
            const novoToken =
                await user.getIdToken(true);


            const retryHeaders = {

                "Content-Type": "application/json",

                "Authorization":
                    `Bearer ${novoToken}`,

                ...(options.headers || {})

            };


            const retryResponse = await fetch(
                `${API_BASE}${path}`,
                {
                    ...options,
                    headers: retryHeaders
                }
            );


            // Se continuar 401, manda para login
            if (retryResponse.status === 401) {

                window.location.href = "./cad.html";

                throw new Error(
                    "Sessão expirada. Faça login novamente."
                );

            }


            return retryResponse;

        }


        return response;


    } catch (error) {

        console.error(
            "Erro na requisição API:",
            error
        );

        throw error;

    }

}