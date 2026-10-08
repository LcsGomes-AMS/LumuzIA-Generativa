import { escapeHtml, bindActions } from "./security.js";
import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";



// =====================
// RECEITAS (já recebidas)
// =====================
async function salvarReceita() {
    const descricaoInput = document.getElementById("descricao");
    const valorInput = document.getElementById("valor");

    const descricao = descricaoInput.value.trim();
    const valor = parseFloat(valorInput.value);

    if (!descricao || isNaN(valor)) {
        alert("Por favor, preencha todos os campos corretamente.");
        return;
    }

    try {
        const res = await apiFetch("/receitas", {
            method: "POST",
            body: JSON.stringify({ descricao, valor })
        });

        if (!res.ok) throw new Error(`Erro no servidor: ${res.status}`);
        const data = await res.json();
        
        if (data.success) {
            descricaoInput.value = "";
            valorInput.value = "";
            carregarReceitas();
        } else {
            alert("Erro ao salvar receita: " + (data.error || "Erro desconhecido"));
        }
    } catch (erro) {
        console.error("Falha ao salvar receita:", erro);
        alert("Não foi possível salvar a receita. Verifique se o servidor está rodando.");
    }
}

let receitasAtuais = [];
function dataReceita(v){return v ? String(v).slice(0,10):"";}
async function carregarReceitas() {
    const tabela=document.getElementById("tabelaReceitas"); const uid=auth.currentUser.uid;
    try { const res=await apiFetch(`/receitas/${uid}`); if(!res.ok) throw new Error(`Erro ${res.status}`); receitasAtuais=await res.json(); renderizarTabelaReceitas(receitasAtuais); }
    catch(erro){console.error(erro); tabela.innerHTML=`<tr><td colspan="4">Erro ao carregar dados do servidor.</td></tr>`;}
}
window.filtrarReceitas = function() {
    const desc = (document.getElementById("filtroReceitaDescricao")?.value || "").toLowerCase().trim();
    const min = parseFloat(document.getElementById("filtroReceitaMin")?.value);
    const max = parseFloat(document.getElementById("filtroReceitaMax")?.value);
    const ini = document.getElementById("filtroReceitaInicio")?.value || "";
    const fim = document.getElementById("filtroReceitaFim")?.value || "";
    const erroEl = document.getElementById("filtroReceitaErro");

    if (ini && fim && ini > fim) {
        if (erroEl) {
            erroEl.textContent = "A data inicial não pode ser posterior à data final.";
            erroEl.style.display = "block";
        }
        return;
    }
    if (erroEl) {
        erroEl.style.display = "none";
        erroEl.textContent = "";
    }

    renderizarTabelaReceitas(receitasAtuais.filter(r => {
        const d = dataReceita(r.created_at);
        const matchDesc = !desc || String(r.descricao || "").toLowerCase().includes(desc);
        const matchMin = isNaN(min) || Number(r.valor) >= min;
        const matchMax = isNaN(max) || Number(r.valor) <= max;
        const matchPeriodo = (!ini || d >= ini) && (!fim || d <= fim);
        return matchDesc && matchMin && matchMax && matchPeriodo;
    }));
};

window.limparFiltroReceitas = function() {
    ["filtroReceitaDescricao", "filtroReceitaMin", "filtroReceitaMax", "filtroReceitaInicio", "filtroReceitaFim"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const iniEl = document.getElementById("filtroReceitaInicio");
    const fimEl = document.getElementById("filtroReceitaFim");
    if (iniEl) iniEl.removeAttribute("max");
    if (fimEl) fimEl.removeAttribute("min");
    const erroEl = document.getElementById("filtroReceitaErro");
    if (erroEl) {
        erroEl.style.display = "none";
        erroEl.textContent = "";
    }
    renderizarTabelaReceitas(receitasAtuais);
};

function inicializarEventosFiltroReceitas() {
    const iniEl = document.getElementById("filtroReceitaInicio");
    const fimEl = document.getElementById("filtroReceitaFim");
    const erroEl = document.getElementById("filtroReceitaErro");

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

    ["filtroReceitaDescricao", "filtroReceitaMin", "filtroReceitaMax", "filtroReceitaInicio", "filtroReceitaFim"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                window.filtrarReceitas();
            }
        });
    });
}

function renderizarTabelaReceitas(receitas) {
    const tabela = document.getElementById("tabelaReceitas");
    const contagem = document.getElementById("contagemReceitas");
    if (contagem) contagem.textContent = `${receitas.length} de ${receitasAtuais.length} receita(s) exibida(s)`;

    if (!receitas || receitas.length === 0) {
        tabela.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#8FA1A3;">Nenhuma receita cadastrada.</td></tr>`;
        return;
    }

    tabela.innerHTML = receitas.map(receita => `
        <tr id="linha-receita-${escapeHtml(receita.id)}">
            <td>${escapeHtml(receita.descricao)}</td>
            <td>R$ ${Number(receita.valor).toFixed(2)}</td>
            <td>${receita.created_at ? new Date(String(receita.created_at).slice(0,10)+"T00:00:00").toLocaleDateString("pt-BR") : "--"}</td>
            <td>
                <button data-action="editarReceita" data-id="${escapeHtml(receita.id)}" style="background:transparent;border:1px solid #6FE7DD;color:#6FE7DD;padding:4px 8px;border-radius:4px;cursor:pointer;">Editar</button>
                <button data-action="excluirReceita" data-id="${escapeHtml(receita.id)}" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer; margin-left:6px;">Excluir</button>
            </td>
        </tr>
    `).join("");
}

// Transforma a linha em um formulário de edição inline
window.editarReceita = function (id) {
    const receita = receitasAtuais.find(item => Number(item.id) === Number(id));
    if (!receita) return;
    const linha = document.getElementById(`linha-receita-${id}`);
    if (!linha) return;

    linha.innerHTML = `
        <td><input class="receita-edit-input" id="editDesc-${escapeHtml(id)}"></td>
        <td><input class="receita-edit-input" id="editValor-${escapeHtml(id)}" type="number" min="0.01" step="0.01"></td>
        <td>
            <button data-action="salvarEdicaoReceita" data-id="${escapeHtml(id)}" style="background:#10B981;border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;">Salvar</button>
            <button data-action="filtrarReceitas" style="background:transparent;border:1px solid #8FA1A3;color:#8FA1A3;padding:4px 8px;border-radius:4px;cursor:pointer; margin-left:6px;">Cancelar</button>
        </td>
    `;
    document.getElementById(`editDesc-${id}`).value = receita.descricao;
    document.getElementById(`editValor-${id}`).value = receita.valor;
};

window.salvarEdicaoReceita = async function (id) {
    const descricao = document.getElementById(`editDesc-${id}`).value.trim();
    const valor = parseFloat(document.getElementById(`editValor-${id}`).value);

    if (!descricao || isNaN(valor)) {
        alert("Preencha os campos corretamente.");
        return;
    }

    try {
        const res = await apiFetch(`/receitas/${id}`, {
            method: "PUT",
            body: JSON.stringify({ descricao, valor })
        });
        const data = await res.json();
        if (data.success) {
            carregarReceitas();
        } else {
            alert("Erro ao editar: " + (data.error || "Tente novamente."));
        }
    } catch (err) {
        console.error("Erro ao editar receita:", err);
        alert("Falha na comunicação com o servidor.");
    }
};

window.excluirReceita = async function (id) {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    try {
        const res = await apiFetch(`/receitas/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarReceitas();
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

// =====================
// A RECEBER (agendamentos tipo 'receita', até 30 dias)
// =====================
function addDiasISO(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split("T")[0];
}

async function salvarAReceber() {
    const descricao = document.getElementById("arDescricao").value.trim();
    const valor = parseFloat(document.getElementById("arValor").value);
    let dias = parseInt(document.getElementById("arDias").value, 10);

    if (!descricao || isNaN(valor) || isNaN(dias)) {
        alert("Preencha descrição, valor e prazo em dias.");
        return;
    }
    if (dias < 1) dias = 1;
    if (dias > 30) {
        alert("O prazo máximo para 'A Receber' é 30 dias.");
        return;
    }

    try {
        const res = await apiFetch("/agendamentos", {
            method: "POST",
            body: JSON.stringify({
                tipo: "receita",
                descricao,
                valor,
                dataAgendada: addDiasISO(dias)
            })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById("arDescricao").value = "";
            document.getElementById("arValor").value = "";
            document.getElementById("arDias").value = "";
            carregarAReceber();
        } else {
            alert("Erro ao agendar: " + (data.error || "Tente novamente."));
        }
    } catch (err) {
        console.error("Erro ao agendar a receber:", err);
        alert("Falha na comunicação com o servidor.");
    }
}

async function carregarAReceber() {
    const uid = auth.currentUser.uid;
    const tabela = document.getElementById("tabelaAReceber");

    try {
        // Esse GET já lança (processa) automaticamente qualquer item vencido
        const res = await apiFetch(`/agendamentos/${uid}`);
        const dados = await res.json();

        const itens = Array.isArray(dados) ? dados.filter(a => a.tipo === "receita") : [];

        if (itens.length === 0) {
            tabela.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#8FA1A3;">Nenhum valor a receber agendado.</td></tr>`;
        } else {
            tabela.innerHTML = itens.map(item => {
                const [ano, mes, dia] = item.data_agendada.split("-");
                const badge = item.status === "lancado"
                    ? `<span class="badge-recebido">recebido</span>`
                    : `<span class="badge-pendente">pendente</span>`;
                const botaoExcluir = item.status === "pendente"
                    ? `<button data-action="excluirAReceber" data-id="${escapeHtml(item.id)}" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer;">Excluir</button>`
                    : "—";

                return `
                    <tr>
                        <td>${escapeHtml(dia)}/${escapeHtml(mes)}/${escapeHtml(ano)}</td>
                        <td>${escapeHtml(item.descricao)}</td>
                        <td>R$ ${Number(item.valor).toFixed(2)}</td>
                        <td>${badge}</td>
                        <td>${botaoExcluir}</td>
                    </tr>
                `;
            }).join("");
        }

        // Se algo tiver sido lançado agora, a lista de receitas "de verdade" também mudou
        carregarReceitas();
    } catch (err) {
        console.error("Erro ao carregar 'a receber':", err);
        tabela.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#EF4444;">Erro ao carregar.</td></tr>`;
    }
}

window.salvarReceita = salvarReceita;
window.salvarAReceber = salvarAReceber;

window.excluirAReceber = async function (id) {
    if (!confirm("Cancelar este valor a receber?")) return;
    try {
        const res = await apiFetch(`/agendamentos/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarAReceber();
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

// =====================
// INICIALIZAÇÃO
// =====================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "cad.html";
        return;
    }
    carregarReceitas();
    inicializarEventosFiltroReceitas();
    carregarAReceber();
    verificarParcelasPendentes();
});

bindActions({
    salvarReceita: window.salvarReceita,
    filtrarReceitas: window.filtrarReceitas,
    limparFiltroReceitas: window.limparFiltroReceitas,
    salvarAReceber: window.salvarAReceber,
    editarReceita: window.editarReceita,
    salvarEdicaoReceita: window.salvarEdicaoReceita,
    excluirReceita: window.excluirReceita,
    excluirAReceber: window.excluirAReceber
});
