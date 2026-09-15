import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

// GRÁFICO 1: Evolução do rendimento total ao longo do tempo
async function carregarGraficoEvolucaoTotal(uid) {
    const res = await apiFetch(`/api/investimentos/historico/${uid}`);
    const historico = await res.json();
    const canvas = document.getElementById("graficoEvolucaoTotal");
    if (!canvas || historico.length === 0) return;

    if (window._chartEvolucaoTotal) window._chartEvolucaoTotal.destroy();

    const labels = historico.map(h => {
        const [ano, mes, dia] = h.data.split("-");
        return `${dia}/${mes}`;
    });

    window._chartEvolucaoTotal = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Rendimento acumulado (R$)",
                data: historico.map(h => h.rendimento),
                borderColor: "#10B981",
                backgroundColor: "rgba(16,185,129,0.1)",
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#fff" } } },
            scales: {
                x: { ticks: { color: "#8FA1A3" } },
                y: { ticks: { color: "#8FA1A3" } }
            }
        }
    });
}

// GRÁFICO 2: Rendimento de cada ativo separadamente (barras)
function carregarGraficoPorAtivo(detalhes) {
    const canvas = document.getElementById("graficoRendimentoPorAtivo");
    if (!canvas || !detalhes || detalhes.length === 0) return;

    if (window._chartPorAtivo) window._chartPorAtivo.destroy();

    const cores = detalhes.map(d => d.lucroOuPrejuizo >= 0 ? "#10B981" : "#EF4444");

    window._chartPorAtivo = new Chart(canvas, {
        type: "bar",
        data: {
            labels: detalhes.map(d => d.ticker),
            datasets: [{
                label: "Rendimento (R$)",
                data: detalhes.map(d => d.lucroOuPrejuizo),
                backgroundColor: cores
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#8FA1A3" } },
                y: { ticks: { color: "#8FA1A3" } }
            }
        }
    });
}

// 1. CARREGAR E RENDERIZAR OS INVESTIMENTOS NA TELA
let investimentosAtuais = [];
let respostaInvestimentosAtual = null;

function aplicarFiltrosInvestimentos(lista) {
    const ticker = (document.getElementById("filtroInvTicker")?.value || "").toLowerCase().trim();
    const tipo = document.getElementById("filtroInvTipo")?.value || "";
    const qmin = parseFloat(document.getElementById("filtroInvQtdMin")?.value);
    const qmax = parseFloat(document.getElementById("filtroInvQtdMax")?.value);
    const pmin = parseFloat(document.getElementById("filtroInvPrecoMin")?.value);
    const pmax = parseFloat(document.getElementById("filtroInvPrecoMax")?.value);
    const ini = document.getElementById("filtroInvInicio")?.value || "";
    const fim = document.getElementById("filtroInvFim")?.value || "";

    return lista.filter(i => {
        const d = String(i.dataCompra || "").slice(0, 10);
        const matchTicker = !ticker || String(i.ticker || "").toLowerCase().includes(ticker);
        const matchTipo = !tipo || i.tipo === tipo;
        const matchQmin = isNaN(qmin) || Number(i.quantidade) >= qmin;
        const matchQmax = isNaN(qmax) || Number(i.quantidade) <= qmax;
        const matchPmin = isNaN(pmin) || Number(i.precoMedio) >= pmin;
        const matchPmax = isNaN(pmax) || Number(i.precoMedio) <= pmax;
        const matchPeriodo = (!ini || d >= ini) && (!fim || d <= fim);
        return matchTicker && matchTipo && matchQmin && matchQmax && matchPmin && matchPmax && matchPeriodo;
    });
}

function renderizarInvestimentosFiltrados() {
    const tabela = document.getElementById("tabelaInvestimentos");
    if (!tabela) return;

    const detalhes = aplicarFiltrosInvestimentos(investimentosAtuais);
    const contagem = document.getElementById("contagemInvestimentos");
    if (contagem) contagem.textContent = `${detalhes.length} de ${investimentosAtuais.length} investimento(s) exibido(s)`;

    if (detalhes.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 20px; color: #8FA1A3;">
                    ${investimentosAtuais.length === 0 ? "Nenhum ativo cadastrado até o momento." : "Nenhum investimento encontrado com esses filtros."}
                </td>
            </tr>
        `;
        carregarGraficoPorAtivo([]);
        return;
    }

    let htmlRows = "";
    detalhes.forEach((item) => {
        const qtd = Number(item.quantidade) || 0;
        const pm = Number(item.precoMedio) || 0;
        const pa = Number(item.precoAtual) || 0;
        const total = Number(item.valorTotalAtual) || 0;
        const lucro = Number(item.lucroOuPrejuizo) || 0;
        const corLucro = lucro >= 0 ? "#10B981" : "#EF4444";

        let dataFormatada = "--";
        if (item.dataCompra) {
            const partes = item.dataCompra.split("-");
            if (partes.length === 3) {
                dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        htmlRows += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 12px; font-weight: bold; color: #6FE7DD;">${escapeHtml(item.ticker)}</td>
                <td style="padding: 12px; color: #fff;">${escapeHtml(item.tipo)}</td>
                <td style="padding: 12px; color: #fff;">${qtd}</td>
                <td style="padding: 12px; color: #fff;">R$ ${pm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 12px; font-weight: bold; color: #FFF;">R$ ${pa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 12px; font-weight: bold; color: #FFF;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 12px; color: ${corLucro}; font-weight: bold;">
                    ${lucro >= 0 ? '+' : ''}R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="padding: 12px; color: #8FA1A3;">${dataFormatada}</td>
                <td style="padding: 12px;">
                    <button onclick="deletarInvestimento(${item.id})" style="background: transparent; border: 1px solid #EF4444; color: #EF4444; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        Excluir
                    </button>
                </td>
            </tr>
        `;
    });

    tabela.innerHTML = htmlRows;
    carregarGraficoPorAtivo(detalhes);
}

window.filtrarInvestimentos = function() {
    const ini = document.getElementById("filtroInvInicio")?.value || "";
    const fim = document.getElementById("filtroInvFim")?.value || "";
    const erroEl = document.getElementById("filtroInvErro");

    if (ini && fim && ini > fim) {
        if (erroEl) {
            erroEl.textContent = "⚠️ A data inicial não pode ser posterior à data final.";
            erroEl.style.display = "block";
        }
        return;
    }
    if (erroEl) {
        erroEl.style.display = "none";
        erroEl.textContent = "";
    }

    if (investimentosAtuais && investimentosAtuais.length > 0) {
        renderizarInvestimentosFiltrados();
    } else {
        buscarInvestimentos();
    }
};

window.limparFiltroInvestimentos = function() {
    ["filtroInvTicker", "filtroInvTipo", "filtroInvQtdMin", "filtroInvQtdMax", "filtroInvPrecoMin", "filtroInvPrecoMax", "filtroInvInicio", "filtroInvFim"].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.value = "";
    });
    const iniEl = document.getElementById("filtroInvInicio");
    const fimEl = document.getElementById("filtroInvFim");
    if (iniEl) iniEl.removeAttribute("max");
    if (fimEl) fimEl.removeAttribute("min");
    const erroEl = document.getElementById("filtroInvErro");
    if (erroEl) {
        erroEl.style.display = "none";
        erroEl.textContent = "";
    }
    renderizarInvestimentosFiltrados();
};

function inicializarEventosFiltroInvestimentos() {
    const iniEl = document.getElementById("filtroInvInicio");
    const fimEl = document.getElementById("filtroInvFim");
    const erroEl = document.getElementById("filtroInvErro");

    iniEl?.addEventListener("change", () => {
        if (iniEl.value) {
            fimEl?.setAttribute("min", iniEl.value);
        } else {
            fimEl?.removeAttribute("min");
        }
        if (erroEl && iniEl.value && fimEl?.value && iniEl.value <= fimEl.value) {
            erroEl.style.display = "none";
        }
    });

    fimEl?.addEventListener("change", () => {
        if (fimEl.value) {
            iniEl?.setAttribute("max", fimEl.value);
        } else {
            iniEl?.removeAttribute("max");
        }
        if (erroEl && iniEl?.value && fimEl.value && iniEl.value <= fimEl.value) {
            erroEl.style.display = "none";
        }
    });

    ["filtroInvTicker", "filtroInvTipo", "filtroInvQtdMin", "filtroInvQtdMax", "filtroInvPrecoMin", "filtroInvPrecoMax", "filtroInvInicio", "filtroInvFim"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                window.filtrarInvestimentos();
            }
        });
    });
}

async function buscarInvestimentos() {
    const uid = auth.currentUser.uid;
    const tabela = document.getElementById("tabelaInvestimentos");

    if (!tabela) return;

    tabela.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 20px; color: #8FA1A3;">
                Buscando cotações atualizadas na B3 e mercado Cripto...
            </td>
        </tr>
    `;

    try {
        const response = await apiFetch(`/api/investimentos/cotacoes/${uid}`);
        if (!response.ok) throw new Error("Erro ao consultar backend.");

        const data = await response.json();
        const detalhesOriginais = Array.isArray(data.detalhes) ? data.detalhes : [];
        investimentosAtuais = detalhesOriginais;
        respostaInvestimentosAtual = data;

        // ------------------------------------
        // A. ATUALIZA OS CARDS DO TOPO
        // ------------------------------------
        const elTotal = document.getElementById("totalInvestido");
        const elLucro = document.getElementById("lucroTotal");
        const elPercent = document.getElementById("percentualTotal");
        const elProventos = document.getElementById("proventosEstimados");

        if (elTotal) {
            elTotal.innerText = `R$ ${(data.valorAtual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (elLucro) {
            elLucro.innerText = `R$ ${(data.rendimento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (elProventos) {
            elProventos.innerText = `R$ ${parseFloat(data.proximosProventos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (estimado)`;
            elProventos.title = "Valor estimado com base nos últimos proventos anunciados. Pode variar até a data de pagamento.";
        }

        if (elPercent) {
            const perc = parseFloat(data.crescimentoPercentual) || 0;
            elPercent.innerText = `${perc >= 0 ? '+' : ''}${perc.toFixed(2)}%`;
            elPercent.style.color = perc >= 0 ? "#10B981" : "#EF4444";
        }

        // ------------------------------------
        // B. PREENCHE A TABELA DINÂMICA
        // ------------------------------------
        renderizarInvestimentosFiltrados();

    } catch (err) {
        console.error("Erro ao carregar dados na tela:", err);
        tabela.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: #EF4444; padding: 20px;">
                    Erro ao carregar os dados de investimentos.
                </td>
            </tr>
        `;
    }
}

const carregarInvestimentos = buscarInvestimentos;

// 2. ADICIONAR NOVO ATIVO VIA FORMULÁRIO
const form = document.getElementById("formInvestimento");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const ticker = document.getElementById("ticker").value;
        const tipo = document.getElementById("tipo").value;
        const quantidade = parseFloat(document.getElementById("quantidade").value);
        const precoMedio = parseFloat(document.getElementById("precoMedio").value);

        // dataCompra é opcional — só inclui se o campo existir na página
        const inputData = document.getElementById("dataCompra");
        const dataCompra = inputData ? inputData.value : undefined;

        try {
            const response = await apiFetch("/investimentos", {
                method: "POST",
                body: JSON.stringify({ ticker, tipo, quantidade, precoMedio, dataCompra })
            });

            const resData = await response.json();

            if (resData.success) {
                form.reset();
                if (inputData) inputData.valueAsDate = new Date();
                buscarInvestimentos();
                carregarGraficoEvolucaoTotal(auth.currentUser.uid);
            } else {
                alert("Erro ao salvar ativo: " + (resData.error || "Tente novamente."));
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
            alert("Falha na comunicação com o servidor.");
        }
    });
}

// 3. DELETAR ATIVO
window.deletarInvestimento = async function(id) {
    if (!confirm("Tem certeza que deseja remover este ativo da carteira?")) return;

    try {
        const response = await apiFetch(`/investimentos/${id}`, {
            method: "DELETE"
        });

        const resData = await response.json();

        if (resData.success) {
            buscarInvestimentos();
        } else {
            alert("Erro ao excluir: " + (resData.error || "Ativo não encontrado."));
        }
    } catch (error) {
        console.error("Erro ao deletar:", error);
        alert("Não foi possível excluir o ativo.");
    }
};

// 4. INICIALIZAÇÃO DA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    const inputData = document.getElementById("dataCompra");
    if (inputData && !inputData.value) {
        inputData.valueAsDate = new Date();
    }
});

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "cad.html";
        return;
    }
    buscarInvestimentos();
    inicializarEventosFiltroInvestimentos();
    carregarGraficoEvolucaoTotal(user.uid);
    verificarParcelasPendentes();
});