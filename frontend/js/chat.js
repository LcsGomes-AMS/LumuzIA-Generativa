import { auth } from "./config.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {

    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const chatContainer = document.getElementById("chatContainer");

    if (!chatForm || !userInput || !chatContainer) {
        console.error("Elementos do chat não encontrados.");
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "cad.html";
            return;
        }

        verificarParcelasPendentes();
    });

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageText = userInput.value.trim();
        if (!messageText) return;

        appendMessage(
            "Você",
            messageText,
            "user-message"
        );

        userInput.value = "";

        const typingIndicator = appendMessage(
            "LumuzIA",
            "Pensando...",
            "ai-message typing"
        );

        try {
            // Rota atualizada para /api/ia/chat e chave do payload ajustada para 'prompt'
            const response = await apiFetch("/api/ia/chat", {
                method: "POST",
                body: JSON.stringify({
                    prompt: messageText
                })
            });

            const data = await response.json();

            typingIndicator.remove();

            if (response.status === 401) {
                appendMessage(
                    "LumuzIA",
                    "Sua sessão expirou. Faça login novamente.",
                    "ai-message"
                );

                setTimeout(() => {
                    window.location.href = "cad.html";
                }, 1500);

                return;
            }

            // O backend retorna data.resposta em vez de data.reply
            if (data.success && data.resposta) {
                appendMessage(
                    "LumuzIA",
                    data.resposta,
                    "ai-message"
                );
            } else {
                appendMessage(
                    "LumuzIA",
                    data.error || "Erro sem resposta definida.",
                    "ai-message"
                );
            }

        } catch (error) {
            typingIndicator.remove();

            console.error(
                "Erro na comunicação com o servidor:",
                error
            );

            appendMessage(
                "LumuzIA",
                "Não consegui conectar ao servidor.",
                "ai-message"
            );
        }
    });

    function appendMessage(sender, text, className) {
        const messageDiv = document.createElement("div");

        messageDiv.className = `message ${className}`;

        messageDiv.innerHTML = `
            <strong>${escapeHtml(sender)}:</strong>
            <p style="margin-top: 4px; white-space: pre-line;">
                ${escapeHtml(text)}
            </p>
        `;

        chatContainer.appendChild(messageDiv);

        chatContainer.scrollTop =
            chatContainer.scrollHeight;

        return messageDiv;
    }

});