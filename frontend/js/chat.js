document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const chatContainer = document.getElementById("chatContainer");

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageText = userInput.value.trim();
        if (!messageText) return;

        // 1. Exibe a mensagem do usuário na tela
        appendMessage("Você", messageText, "user-message");
        userInput.value = "";

        // 2. Exibe indicador de carregamento
        const typingIndicator = appendMessage("LumuzIA", "Pensando...", "ai-message typing");

        try {
            // 3. Faz a requisição para o backend local Express
            const response = await fetch("http://localhost:3000/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: messageText })
            });

            const data = await response.json();

            // 4. Remove indicador e adiciona a resposta oficial
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
        
        // Mantém o scroll sempre embaixo ao mandar mensagens
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageDiv;
    }
});