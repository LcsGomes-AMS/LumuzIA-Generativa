import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

// =====================
// GASTOS
// =====================
async function salvarGasto() {
    const descricao = document.getElementById("descricao").value;
    const valor = document.getElementById("valor").value;
    const categoria = document.getElementById("categoria").value;

    const res = await apiFetch("/gastos", {
        method: "POST",
        body: JSON.stringify({ descricao, valor, categoria })
    });

    const data = await res.json();

    if (data.success) {
        carregarGastos();
        document.getElementById("descricao").value = "";
        document.getElementById("valor").value = "";
    }
}

async function carregarGastos() {
    const uid = auth.currentUser.uid;
    const res = await apiFetch(`/gastos/${uid}`);
    const gastos = await res.json();

    const tabela = document.getElementById("tabelaGastos");
    tabela.innerHTML = "";

    gastos.forEach(gasto => {
        tabela.innerHTML += `
            <tr>
                <td>${escapeHtml(gasto.descricao)}</td>
                <td>R$ ${gasto.valor}</td>
                <td>${escapeHtml(gasto.categoria)}</td>
                <td><button onclick="excluirGasto(${gasto.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer;">Excluir</button></td>
            </tr>
        `;
    });
}

window.excluirGasto = async function (id) {
    if (!confirm("Excluir este gasto?")) return;
    try {
        const res = await apiFetch(`/gastos/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarGastos();
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

window.salvarGasto = salvarGasto;

// =====================
// GASTO PARCELADO (reaproveita o sistema de agendamentos)
// =====================
function addMesesISO(dataBaseISO, n) {
    const [ano, mes, dia] = dataBaseISO.split("-").map(Number);
    const d = new Date(ano, mes - 1 + n, dia);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function salvarParcelamento() {
    const descricao = document.getElementById("pcDescricao").value.trim();
    const valorTotal = parseFloat(document.getElementById("pcValorTotal").value);
    const numParcelas = parseInt(document.getElementById("pcParcelas").value, 10);
    const categoria = document.getElementById("pcCategoria").value;
    let dataPrimeira = document.getElementById("pcDataPrimeira").value;

    if (!descricao || isNaN(valorTotal) || valorTotal <= 0) {
        alert("Preencha descrição e valor total corretamente.");
        return;
    }
    if (isNaN(numParcelas) || numParcelas < 2 || numParcelas > 48) {
        alert("Número de parcelas deve ser entre 2 e 48.");
        return;
    }
    if (!dataPrimeira) {
        dataPrimeira = new Date().toISOString().split("T")[0];
    }

    const valorParcela = Math.floor((valorTotal / numParcelas) * 100) / 100;
    const somaParcelas = valorParcela * (numParcelas - 1);
    const valorUltimaParcela = Math.round((valorTotal - somaParcelas) * 100) / 100;

    try {
        const requisicoes = [];
        for (let i = 0; i < numParcelas; i++) {
            const valor = (i === numParcelas - 1) ? valorUltimaParcela : valorParcela;
            const dataAgendada = addMesesISO(dataPrimeira, i);

            requisicoes.push(
                apiFetch("/agendamentos", {
                    method: "POST",
                    body: JSON.stringify({
                        tipo: "gasto",
                        descricao: `${descricao} (${i + 1}/${numParcelas})`,
                        valor,
                        categoria,
                        dataAgendada
                    })
                })
            );
        }

        await Promise.all(requisicoes);

        document.getElementById("pcDescricao").value = "";
        document.getElementById("pcValorTotal").value = "";
        document.getElementById("pcParcelas").value = "";
        document.getElementById("pcDataPrimeira").value = "";

        alert(`Compra parcelada em ${numParcelas}x criada com sucesso!`);
        carregarParcelas();
        carregarAgendamentos();
    } catch (err) {
        console.error("Erro ao parcelar:", err);
        alert("Falha na comunicação com o servidor.");
    }
}

window.salvarParcelamento = salvarParcelamento;

async function carregarParcelas() {
    const uid = auth.currentUser.uid;
    const tabela = document.getElementById("tabelaParcelas");
    if (!tabela) return;

    try {
        const res = await apiFetch(`/agendamentos/${uid}`);
        const dados = await res.json();

        const itens = Array.isArray(dados)
            ? dados.filter(a => a.tipo === "gasto" && /\(\d+\/\d+\)$/.test(a.descricao))
            : [];

        if (itens.length === 0) {
            tabela.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#8FA1A3;">Nenhuma compra parcelada agendada.</td></tr>`;
            return;
        }

        tabela.innerHTML = itens
            .sort((a, b) => a.data_agendada.localeCompare(b.data_agendada))
            .map(item => {
                const [ano, mes, dia] = item.data_agendada.split("-");
                const badge = item.status === "lancado"
                    ? `<span style="color:#10B981;">pago</span>`
                    : `<span style="color:#FBBF24;">pendente</span>`;

                const botaoStatus = item.status === "pendente"
                    ? `<button onclick="marcarPago(${item.id})" style="background:transparent;border:1px solid #10B981;color:#10B981;padding:4px 8px;border-radius:4px;cursor:pointer;">Marcar pago</button>`
                    : `<button onclick="desmarcarPago(${item.id})" style="background:transparent;border:1px solid #F59E0B;color:#F59E0B;padding:4px 8px;border-radius:4px;cursor:pointer;">Desmarcar</button>`;

                const botaoExcluir = item.status === "pendente"
                    ? `<button onclick="excluirParcela(${item.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer;">Excluir</button>`
                    : "";

                return `
                    <tr>
                        <td>${dia}/${mes}/${ano}</td>
                        <td>${item.descricao}</td>
                        <td>R$ ${Number(item.valor).toFixed(2)}</td>
                        <td>${badge}</td>
                        <td>${botaoStatus} ${botaoExcluir}</td>
                    </tr>
                `;
            }).join("");
    } catch (err) {
        console.error("Erro ao carregar parcelas:", err);
    }
}

window.excluirParcela = async function (id) {
    if (!confirm("Excluir esta parcela? (só remove a parcela selecionada, não as demais)")) return;
    try {
        const res = await apiFetch(`/agendamentos/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarParcelas();
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

window.marcarPago = async function (id) {
    try {
        const res = await apiFetch(`/agendamentos/${id}/pago`, { method: "PATCH" });
        const data = await res.json();
        if (data.success) {
            carregarParcelas();
            carregarAgendamentos();
        } else {
            alert("Erro ao marcar como pago: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível atualizar o status.");
    }
};

window.desmarcarPago = async function (id) {
    if (!confirm("Voltar esta parcela para pendente? (o lançamento já criado em Gastos não é removido automaticamente)")) return;
    try {
        const res = await apiFetch(`/agendamentos/${id}/pendente`, { method: "PATCH" });
        const data = await res.json();
        if (data.success) {
            carregarParcelas();
            carregarAgendamentos();
        } else {
            alert("Erro ao desmarcar: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível atualizar o status.");
    }
};

// =====================
// CALENDÁRIO DE AGENDAMENTOS
// =====================
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

let calAnoAtual = new Date().getFullYear();
let calMesAtual = new Date().getMonth();
let calDataSelecionada = null;
let agendamentosPorData = new Map();
let todosAgendamentos = [];

function formatarDataISO(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function rotuloTipo(tipo) {
    if (tipo === "gasto") return "💸 Gasto";
    if (tipo === "receita") return "💵 Receita";
    if (tipo === "meta") return "🎯 Meta";
    return tipo;
}

function popularSeletoresCalendario() {
    const selectMes = document.getElementById("calSelectMes");
    const selectAno = document.getElementById("calSelectAno");
    if (!selectMes || !selectAno) return;

    selectMes.innerHTML = MESES.map((m, i) => `<option value="${i}">${m}</option>`).join("");

    const anoBase = new Date().getFullYear();
    let opcoesAno = "";
    for (let a = anoBase - 10; a <= anoBase + 20; a++) {
        opcoesAno += `<option value="${a}">${a}</option>`;
    }
    selectAno.innerHTML = opcoesAno;

    selectMes.value = calMesAtual;
    selectAno.value = calAnoAtual;
}

function renderizarCalendario() {
    const grid = document.getElementById("calendarioGrid");
    if (!grid) return;

    document.getElementById("calSelectMes").value = calMesAtual;
    document.getElementById("calSelectAno").value = calAnoAtual;

    const primeiroDiaSemana = new Date(calAnoAtual, calMesAtual, 1).getDay();
    const diasNoMes = new Date(calAnoAtual, calMesAtual + 1, 0).getDate();
    const diasNoMesAnterior = new Date(calAnoAtual, calMesAtual, 0).getDate();
    const hojeISO = new Date().toISOString().split("T")[0];

    let html = DIAS_SEMANA.map(d => `<div class="cal-dia-semana">${d}</div>`).join("");

    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
        const dia = diasNoMesAnterior - i;
        html += `<div class="cal-dia cal-outside">${dia}</div>`;
    }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataISO = formatarDataISO(calAnoAtual, calMesAtual, dia);
        const temEvento = agendamentosPorData.has(dataISO);
        const classes = ["cal-dia"];
        if (dataISO === hojeISO) classes.push("cal-hoje");
        if (dataISO === calDataSelecionada) classes.push("cal-selecionado");
        if (temEvento) classes.push("cal-tem-evento");

        html += `<div class="${classes.join(" ")}" data-data="${dataISO}">
            ${dia}${temEvento ? '<span class="cal-dot"></span>' : ''}
        </div>`;
    }

    const totalCelulas = primeiroDiaSemana + diasNoMes;
    const restante = (7 - (totalCelulas % 7)) % 7;
    for (let dia = 1; dia <= restante; dia++) {
        html += `<div class="cal-dia cal-outside">${dia}</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll(".cal-dia[data-data]").forEach(el => {
        el.addEventListener("click", () => selecionarData(el.dataset.data));
    });
}

function selecionarData(dataISO) {
    calDataSelecionada = dataISO;
    renderizarCalendario();

    const form = document.getElementById("calFormAgendamento");
    const titulo = document.getElementById("calDataSelecionadaTitulo");
    if (form) form.style.display = "block";

    const [ano, mes, dia] = dataISO.split("-");
    if (titulo) titulo.innerText = `Agendar para ${dia}/${mes}/${ano}`;

    renderizarListaDoDia(dataISO);
}

function renderizarListaDoDia(dataISO) {
    const lista = document.getElementById("listaAgendamentosDia");
    if (!lista) return;

    const itens = agendamentosPorData.get(dataISO) || [];

    if (itens.length === 0) {
        lista.innerHTML = `<p style="color:#8FA1A3; margin-top:10px;">Nenhum agendamento para este dia ainda.</p>`;
        return;
    }

    lista.innerHTML = `<h4 style="margin-top:15px;">Agendado para este dia:</h4>` + itens.map(ag => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; margin-top:8px;">
            <span>${rotuloTipo(ag.tipo)} — ${escapeHtml(ag.descricao)} — R$ ${Number(ag.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${ag.status === 'lancado' ? '✅ lançado' : ''}</span>
            ${ag.status === 'pendente' ? `<button onclick="deletarAgendamento(${ag.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:2px 8px;border-radius:4px;cursor:pointer;">Excluir</button>` : ''}
        </div>
    `).join("");
}

function renderizarTabelaFuturos() {
    const tabela = document.getElementById("tabelaAgendamentosFuturos");
    if (!tabela) return;

    const hojeISO = new Date().toISOString().split("T")[0];
    const futuros = todosAgendamentos
        .filter(a => a.status === "pendente" && a.data_agendada >= hojeISO)
        .sort((a, b) => a.data_agendada.localeCompare(b.data_agendada));

    if (futuros.length === 0) {
        tabela.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#8FA1A3; padding:15px;">Nenhum agendamento futuro.</td></tr>`;
        return;
    }

    tabela.innerHTML = futuros.map(ag => {
        const [ano, mes, dia] = ag.data_agendada.split("-");
        return `
            <tr>
                <td>${dia}/${mes}/${ano}</td>
                <td>${rotuloTipo(ag.tipo)}</td>
                <td>${escapeHtml(ag.descricao)}</td>
                <td>R$ ${Number(ag.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td><button onclick="deletarAgendamento(${ag.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer;">Excluir</button></td>
            </tr>
        `;
    }).join("");
}

async function carregarAgendamentos() {
    const uid = auth.currentUser.uid;
    try {
        const res = await apiFetch(`/agendamentos/${uid}`);
        const dados = await res.json();

        todosAgendamentos = Array.isArray(dados) ? dados : [];
        agendamentosPorData = new Map();

        todosAgendamentos.forEach(ag => {
            if (!agendamentosPorData.has(ag.data_agendada)) {
                agendamentosPorData.set(ag.data_agendada, []);
            }
            agendamentosPorData.get(ag.data_agendada).push(ag);
        });

        renderizarCalendario();
        renderizarTabelaFuturos();
        if (calDataSelecionada) renderizarListaDoDia(calDataSelecionada);

        carregarGastos();
    } catch (err) {
        console.error("Erro ao carregar agendamentos:", err);
    }
}

async function salvarAgendamento() {
    if (!calDataSelecionada) {
        alert("Selecione um dia no calendário primeiro.");
        return;
    }

    const tipo = document.getElementById("calTipo").value;
    const descricao = document.getElementById("calDescricao").value.trim();
    const valor = parseFloat(document.getElementById("calValor").value);
    const categoria = document.getElementById("calCategoria").value;
    const prazo = parseInt(document.getElementById("calPrazo").value, 10);

    if (!descricao || isNaN(valor)) {
        alert("Preencha descrição e valor corretamente.");
        return;
    }

    try {
        const res = await apiFetch("/agendamentos", {
            method: "POST",
            body: JSON.stringify({
                tipo,
                descricao,
                valor,
                categoria: tipo === "gasto" ? categoria : undefined,
                prazo: tipo === "meta" ? (isNaN(prazo) ? 12 : prazo) : undefined,
                dataAgendada: calDataSelecionada
            })
        });

        const data = await res.json();
        if (data.success) {
            document.getElementById("calDescricao").value = "";
            document.getElementById("calValor").value = "";
            carregarAgendamentos();
        } else {
            alert("Erro ao agendar: " + (data.error || "Tente novamente."));
        }
    } catch (err) {
        console.error("Erro ao agendar:", err);
        alert("Falha na comunicação com o servidor.");
    }
}

window.salvarAgendamento = salvarAgendamento;

window.deletarAgendamento = async function (id) {
    if (!confirm("Remover este agendamento?")) return;
    try {
        const res = await apiFetch(`/agendamentos/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarAgendamentos();
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

function inicializarCalendario() {
    popularSeletoresCalendario();
    renderizarCalendario();

    document.getElementById("calMesAnterior")?.addEventListener("click", () => {
        calMesAtual--;
        if (calMesAtual < 0) { calMesAtual = 11; calAnoAtual--; }
        renderizarCalendario();
    });

    document.getElementById("calMesProximo")?.addEventListener("click", () => {
        calMesAtual++;
        if (calMesAtual > 11) { calMesAtual = 0; calAnoAtual++; }
        renderizarCalendario();
    });

    document.getElementById("calHoje")?.addEventListener("click", () => {
        const hoje = new Date();
        calAnoAtual = hoje.getFullYear();
        calMesAtual = hoje.getMonth();
        renderizarCalendario();
    });

    document.getElementById("calSelectMes")?.addEventListener("change", (e) => {
        calMesAtual = parseInt(e.target.value, 10);
        renderizarCalendario();
    });

    document.getElementById("calSelectAno")?.addEventListener("change", (e) => {
        calAnoAtual = parseInt(e.target.value, 10);
        renderizarCalendario();
    });

    document.getElementById("calTipo")?.addEventListener("change", (e) => {
        const categoriaEl = document.getElementById("calCategoria");
        const prazoEl = document.getElementById("calPrazo");
        if (categoriaEl) categoriaEl.style.display = e.target.value === "gasto" ? "block" : "none";
        if (prazoEl) prazoEl.style.display = e.target.value === "meta" ? "block" : "none";
    });
}

// =====================
// INICIALIZAÇÃO
// =====================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "cad.html";
        return;
    }
    carregarGastos();
    inicializarCalendario();
    carregarAgendamentos();
    carregarParcelas();
    verificarParcelasPendentes();
});