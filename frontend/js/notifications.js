// notifications.js
// Módulo reutilizável: mostra popups (toasts) avisando sobre parcelas
// pendentes (compras parceladas cadastradas em /agendamentos com tipo "gasto")
// que estão vencidas ou próximas do vencimento.
//
// Uso: em qualquer página autenticada, dentro do onAuthStateChanged,
// depois de confirmar que existe usuário logado, chame:
//
//   import { verificarParcelasPendentes } from "./notifications.js";
//   verificarParcelasPendentes();

import { auth } from "./config.js";
import { apiFetch } from "./apiClient.js";

// Quantos dias antes do vencimento o aviso já deve aparecer
const DIAS_AVISO_ANTECEDENCIA = 3;

// Tempo que o toast fica visível antes de sumir sozinho (ms)
const DURACAO_TOAST = 12000;

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function injetarEstilos() {
    if (document.getElementById("lzNotifStyles")) return;
    const style = document.createElement("style");
    style.id = "lzNotifStyles";
    style.textContent = `
        @keyframes lzToastIn {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #lzNotifContainer {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 340px;
        }
        .lz-toast {
            background: #182225;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 14px 16px;
            color: #fff;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            font-family: inherit;
            font-size: 14px;
            animation: lzToastIn 0.25s ease-out;
            position: relative;
        }
        .lz-toast-close {
            position: absolute;
            top: 8px;
            right: 10px;
            background: transparent;
            border: none;
            color: #8FA1A3;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
        }
        .lz-toast-close:hover { color: #fff; }
        .lz-toast-title {
            font-weight: bold;
            margin-bottom: 6px;
            padding-right: 16px;
        }
        .lz-toast-body {
            color: #C7D1D3;
            white-space: pre-line;
            line-height: 1.5;
        }
        @media (max-width: 480px) {
            #lzNotifContainer {
                left: 12px;
                right: 12px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(style);
}

function garantirContainer() {
    let container = document.getElementById("lzNotifContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "lzNotifContainer";
        document.body.appendChild(container);
    }
    return container;
}

function criarToast({ titulo, mensagem, tipo = "proxima" }) {
    injetarEstilos();
    const container = garantirContainer();

    const estilosPorTipo = {
        vencida: { borda: "#EF4444", icone: "⚠️" },
        proxima: { borda: "#F59E0B", icone: "⏰" }
    };
    const cor = estilosPorTipo[tipo] || estilosPorTipo.proxima;

    const toast = document.createElement("div");
    toast.className = "lz-toast";
    toast.style.borderLeft = `4px solid ${cor.borda}`;

    toast.innerHTML = `
        <button class="lz-toast-close" aria-label="Fechar">✕</button>
        <div class="lz-toast-title">${cor.icone} ${escapeHtml(titulo)}</div>
        <div class="lz-toast-body">${escapeHtml(mensagem)}</div>
    `;

    container.appendChild(toast);

    const remover = () => toast.remove();
    toast.querySelector(".lz-toast-close").addEventListener("click", remover);
    setTimeout(remover, DURACAO_TOAST);
}

// Diferença em dias (inteiro) entre hoje e a data ISO informada.
// Positivo = no futuro, negativo = já passou.
function diasAteVencimento(dataISO) {
    const hoje = new Date();
    const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const alvo = new Date(ano, mes - 1, dia);

    return Math.round((alvo - hojeSemHora) / (1000 * 60 * 60 * 24));
}

// Evita repetir o mesmo aviso várias vezes no mesmo dia
// (ex: usuário navega entre várias páginas em minutos).
function jaAvisadoHoje(chave) {
    const hojeISO = new Date().toISOString().split("T")[0];
    try {
        const registro = JSON.parse(localStorage.getItem("lzParcelasAvisadas") || "{}");
        return registro[chave] === hojeISO;
    } catch {
        return false;
    }
}

function marcarAvisadoHoje(chave) {
    const hojeISO = new Date().toISOString().split("T")[0];
    try {
        const registro = JSON.parse(localStorage.getItem("lzParcelasAvisadas") || "{}");
        registro[chave] = hojeISO;
        localStorage.setItem("lzParcelasAvisadas", JSON.stringify(registro));
    } catch {
        // localStorage indisponível — apenas não deduplica, sem quebrar o app
    }
}

/**
 * Busca os agendamentos do usuário, identifica parcelas pendentes
 * (descrição terminando em "(n/total)") e exibe um popup para as
 * que estão vencidas e para as que vencem nos próximos
 * DIAS_AVISO_ANTECEDENCIA dias.
 */
export async function verificarParcelasPendentes() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const res = await apiFetch(`/agendamentos/${user.uid}`);
        if (!res.ok) return;

        const dados = await res.json();
        if (!Array.isArray(dados)) return;

        const parcelas = dados.filter(a =>
            a.tipo === "gasto" &&
            a.status === "pendente" &&
            /\(\d+\/\d+\)$/.test(a.descricao)
        );

        if (parcelas.length === 0) return;

        const vencidas = [];
        const proximas = [];

        parcelas.forEach(p => {
            const dias = diasAteVencimento(p.data_agendada);
            if (dias < 0) {
                vencidas.push(p);
            } else if (dias <= DIAS_AVISO_ANTECEDENCIA) {
                proximas.push(p);
            }
        });

        if (vencidas.length > 0) {
            const chave = `vencidas-${vencidas.map(v => v.id).sort((a, b) => a - b).join(",")}`;
            if (!jaAvisadoHoje(chave)) {
                const linhas = vencidas
                    .map(v => `• ${v.descricao} — R$ ${Number(v.valor).toFixed(2)}`)
                    .join("\n");

                criarToast({
                    titulo: vencidas.length > 1
                        ? "Parcelas vencidas"
                        : "Parcela vencida",
                    mensagem: `Efetue o pagamento das parcelas:\n${linhas}`,
                    tipo: "vencida"
                });

                marcarAvisadoHoje(chave);
            }
        }

        if (proximas.length > 0) {
            const chave = `proximas-${proximas.map(v => v.id).sort((a, b) => a - b).join(",")}`;
            if (!jaAvisadoHoje(chave)) {
                const linhas = proximas
                    .map(v => {
                        const dias = diasAteVencimento(v.data_agendada);
                        const quando = dias === 0 ? "vence hoje" : `vence em ${dias} dia${dias > 1 ? "s" : ""}`;
                        return `• ${v.descricao} — R$ ${Number(v.valor).toFixed(2)} (${quando})`;
                    })
                    .join("\n");

                criarToast({
                    titulo: proximas.length > 1
                        ? "Parcelas próximas do vencimento"
                        : "Parcela próxima do vencimento",
                    mensagem: `Efetue o pagamento das parcelas:\n${linhas}`,
                    tipo: "proxima"
                });

                marcarAvisadoHoje(chave);
            }
        }
    } catch (err) {
        console.error("Erro ao verificar parcelas pendentes:", err);
    }
}