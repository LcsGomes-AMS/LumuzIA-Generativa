import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const chatContainer = document.getElementById("chatContainer");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioAtual = user;
            localStorage.setItem("userId", user.uid);
        } else {
            window.location.href = "cad.html";
        }
    });

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageText = userInput.value.trim();
        if (!messageText) return;

        if (!usuarioAtual) {
            alert("Aguarde a autenticação do usuário.");
            return;
        }

        // 1. Exibe a mensagem do usuário
        appendMessage("Você", messageText, "user-message");
        userInput.value = "";

        // 2. Exibe indicador de carregamento
        const typingIndicator = appendMessage("LumuzIA", "Pensando...", "ai-message typing");

        try {
            // 3. Envia o UID do Firebase junto com a mensagem
            const response = await fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    userId: usuarioAtual.uid, 
                    message: messageText 
                })
            });

            const data = await response.json();

            // 4. Exibe a resposta
            typingIndicator.remove();
            if (data.reply) {
                appendMessage("LumuzIA", data.reply, "ai-message");
            } else {
                appendMessage("LumuzIA", data.error || "Erro sem resposta definida.", "ai-message");
            }

        } catch (error) {
            typingIndicator.remove();
            appendMessage("LumuzIA", "Não consegui conectar ao servidor local.", "ai-message");
            console.error("Erro na comunicação:", error);
        }
    });

    function appendMessage(sender, text, className) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${className}`;
        messageDiv.innerHTML = `<strong>${sender}:</strong> <p style="margin-top: 4px; white-space: pre-line;">${text}</p>`;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageDiv;
    }
});