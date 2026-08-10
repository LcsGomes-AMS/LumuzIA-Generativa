import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { apiFetch } from "./apiClient.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const chatContainer = document.getElementById("chatContainer");

    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = "cad.html";
    });

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageText = userInput.value.trim();
        if (!messageText) return;

        appendMessage("Você", messageText, "user-message");
        userInput.value = "";

        const typingIndicator = appendMessage("LumuzIA", "Pensando...", "ai-message typing");

        try {
            const response = await apiFetch("/chat", {
                method: "POST",
                body: JSON.stringify({ message: messageText })
            });

            const data = await response.json();

            typingIndicator.remove();
            if (data.reply) {
                appendMessage("LumuzIA", data.reply, "ai-message");
            } else {
                appendMessage("LumuzIA", data.error || "Erro sem resposta definida.", "ai-message");
            }

        } catch (error) {
            typingIndicator.remove();
            appendMessage("LumuzIA", "Não consegui conectar ao servidor.", "ai-message");
            console.error("Erro na comunicação:", error);
        }
    });

    function appendMessage(sender, text, className) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${className}`;
        messageDiv.innerHTML = `<strong>${escapeHtml(sender)}:</strong> <p style="margin-top: 4px; white-space: pre-line;">${escapeHtml(text)}</p>`;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        return messageDiv;
    }
});