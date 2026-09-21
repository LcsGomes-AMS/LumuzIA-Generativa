import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

    const btnOpenHistory = document.getElementById("btnOpenHistory");
    const btnCloseHistory = document.getElementById("btnCloseHistory");
    const chatHistoryDrawer = document.getElementById("chatHistoryDrawer");
    const chatHistoryOverlay = document.getElementById("chatHistoryOverlay");
    const btnNovaConversa = document.getElementById("btnNovaConversa");
    const conversaList = document.getElementById("conversaList");

    let conversaAtualId = null;

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
        carregarListaConversas(user.uid);
    });

    // --- Histórico UI ---
    btnOpenHistory?.addEventListener("click", () => {
        chatHistoryDrawer.classList.add("open");
        chatHistoryOverlay.style.display = "block";
    });

    btnCloseHistory?.addEventListener("click", fecharHistorico);
    chatHistoryOverlay?.addEventListener("click", fecharHistorico);

    function fecharHistorico() {
        chatHistoryDrawer.classList.remove("open");
        chatHistoryOverlay.style.display = "none";
    }

    btnNovaConversa?.addEventListener("click", () => {
        novaConversa();
        fecharHistorico();
    });

    function novaConversa() {
        conversaAtualId = null;
        chatContainer.innerHTML = `
            <div class="message ai-message">
                <strong>LumuzIA:</strong> Olá! Analisei o seu banco de dados e estou pronta para te ajudar. Pode me perguntar sobre seus gastos, saldo ou pedir dicas para economizar!
            </div>
        `;
        renderizarListaConversas(); // Atualiza a seleção
    }

    // --- API Histórico ---
    let conversas = [];

    async function carregarListaConversas(uid) {
        try {
            const res = await apiFetch(`/api/chat/conversas/${uid}`);
            if (res.ok) {
                conversas = await res.json();
                renderizarListaConversas();
            }
        } catch (err) {
            console.error("Erro ao carregar conversas", err);
        }
    }

    function renderizarListaConversas() {
        if (!conversaList) return;
        conversaList.innerHTML = "";
        if (conversas.length === 0) {
            conversaList.innerHTML = "<p style='color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 20px;'>Nenhuma conversa salva.</p>";
            return;
        }

        conversas.forEach(conv => {
            const div = document.createElement("div");
            div.className = `conversa-item ${conv.id === conversaAtualId ? 'active' : ''}`;
            
            const dataStr = new Date(conv.created_at).toLocaleDateString('pt-BR');
            
            div.innerHTML = `
                <div class="conversa-titulo" title="${escapeHtml(conv.titulo)}">${escapeHtml(conv.titulo)}</div>
                <div class="conversa-data">${dataStr}</div>
                <button class="conversa-item-delete" title="Excluir Conversa">&times;</button>
            `;

            div.addEventListener("click", (e) => {
                if (e.target.classList.contains('conversa-item-delete')) {
                    deletarConversa(conv.id);
                    return;
                }
                carregarMensagens(conv.id);
                fecharHistorico();
            });

            conversaList.appendChild(div);
        });
    }

    async function carregarMensagens(id) {
        try {
            const uid = auth.currentUser.uid;
            const res = await apiFetch(`/api/chat/conversas/${uid}/${id}/mensagens`);
            if (res.ok) {
                const msgs = await res.json();
                conversaAtualId = id;
                chatContainer.innerHTML = "";
                msgs.forEach(m => {
                    const sender = m.role === 'user' ? "Você" : "LumuzIA";
                    const className = m.role === 'user' ? "user-message" : "ai-message";
                    appendMessage(sender, m.conteudo, className);
                });
                renderizarListaConversas(); // Atualiza a classe active
            }
        } catch (err) {
            console.error("Erro ao carregar mensagens", err);
        }
    }

    async function deletarConversa(id) {
        if (!confirm("Tem certeza que deseja excluir esta conversa?")) return;
        try {
            const uid = auth.currentUser.uid;
            const res = await apiFetch(`/api/chat/conversas/${uid}/${id}`, { method: 'DELETE' });
            if (res.ok) {
                conversas = conversas.filter(c => c.id !== id);
                if (conversaAtualId === id) {
                    novaConversa();
                } else {
                    renderizarListaConversas();
                }
            }
        } catch (err) {
            console.error("Erro ao deletar conversa", err);
        }
    }

    async function criarConversaApi(titulo) {
        try {
            const res = await apiFetch(`/api/chat/conversas`, {
                method: 'POST',
                body: JSON.stringify({ titulo: titulo.length > 30 ? titulo.substring(0, 30) + "..." : titulo })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.conversa) {
                    conversaAtualId = data.conversa.id;
                    conversas.unshift(data.conversa);
                    renderizarListaConversas();
                }
            }
        } catch (err) {
            console.error("Erro ao criar conversa", err);
        }
    }

    // --- Chat Form ---
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageText = userInput.value.trim();
        if (!messageText) return;

        appendMessage("Você", messageText, "user-message");
        userInput.value = "";

        const typingIndicator = appendMessage("LumuzIA", "Pensando...", "ai-message typing");

        // Se for a primeira mensagem, cria a conversa primeiro
        if (!conversaAtualId) {
            await criarConversaApi(messageText);
        }

        try {
            const response = await apiFetch("/api/ia/chat", {
                method: "POST",
                body: JSON.stringify({
                    prompt: messageText,
                    conversaId: conversaAtualId
                })
            });

            const data = await response.json();
            typingIndicator.remove();

            if (response.status === 401) {
                appendMessage("LumuzIA", "Sua sessão expirou. Faça login novamente.", "ai-message");
                setTimeout(() => { window.location.href = "cad.html"; }, 1500);
                return;
            }

            if (data.success && data.resposta) {
                appendMessage("LumuzIA", data.resposta, "ai-message");
                
                // Se foi a primeira mensagem, o backend deve ter atualizado o título
                // Vamos recarregar a lista para pegar o título correto caso precise.
                if (conversas.length > 0 && conversas[0].id === conversaAtualId && conversas[0].titulo === "Nova Conversa") {
                    carregarListaConversas(auth.currentUser.uid);
                }
            } else {
                appendMessage("LumuzIA", data.error || "Erro sem resposta definida.", "ai-message");
            }

        } catch (error) {
            typingIndicator.remove();
            console.error("Erro na comunicação com o servidor:", error);
            appendMessage("LumuzIA", "Não consegui conectar ao servidor.", "ai-message");
        }
    });

    function appendMessage(sender, text, className) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${className}`;
        messageDiv.innerHTML = `
            <strong>${escapeHtml(sender)}:</strong>
            <p style="margin-top: 4px; white-space: pre-line;">${escapeHtml(text)}</p>
        `;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageDiv;
    }

});