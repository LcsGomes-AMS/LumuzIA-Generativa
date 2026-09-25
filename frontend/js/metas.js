import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { apiFetch } from "./apiClient.js";
import { verificarParcelasPendentes } from "./notifications.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

let mediaMensalDisponivel = 0;

/* =========================================================
   SALVAR META
========================================================= */

async function salvarMeta() {
    const nome = document.getElementById("nome").value;
    const valorObjetivo = document.getElementById("valorObjetivo").value;
    const prazo = document.getElementById("prazo").value;

    const res = await apiFetch("/metas", {
        method: "POST",
        body: JSON.stringify({ nome, valorObjetivo, prazo })
    });

    const data = await res.json();

    if (data.success) {
        carregarMetas();
        document.getElementById("nome").value = "";
        document.getElementById("valorObjetivo").value = "";
        document.getElementById("prazo").value = "";
    } else {
        alert("Erro ao salvar meta: " + (data.error || "Desconhecido"));
    }
}

// Soma N meses a partir de hoje e retorna formatado dd/mm/aaaa
function calcularDataFutura(mesesAFrente) {
    const hoje = new Date();
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesesAFrente, hoje.getDate());
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function calcularPrevisao(meta) {
    const faltante = Number(meta.valor_objetivo) - Number(meta.valor_atual || 0);

    if (faltante <= 0) {
        return { texto: "🎉 Meta alcançada!", classe: "ok" };
    }
    if (mediaMensalDisponivel <= 0) {
        return { texto: "Sem dados suficientes para estimar", classe: "alerta" };
    }

    const mesesEstimados = Math.ceil(faltante / mediaMensalDisponivel);
    const dataEstimada = calcularDataFutura(mesesEstimados);
    return {
        texto: `~${mesesEstimados} ${mesesEstimados === 1 ? "mês" : "meses"} (até ${dataEstimada})`,
        classe: "ok"
    };
}

// Quanto a pessoa PRECISA guardar por mês para bater a meta dentro do prazo
// que ela mesma definiu ao criar a meta (independe do histórico de economia).
function calcularMetaMensalNecessaria(meta) {
    const faltante = Number(meta.valor_objetivo) - Number(meta.valor_atual || 0);

    if (faltante <= 0) {
        return { texto: "Concluída 🎉", classe: "ok" };
    }
    if (!meta.prazo || Number(meta.prazo) <= 0) {
        return { texto: "-", classe: "" };
    }

    const valorMensal = faltante / Number(meta.prazo);
    return {
        texto: `R$ ${valorMensal.toFixed(2)}/mês`,
        classe: "meta-mensal"
    };
}

async function carregarMediaMensal() {
    const uid = auth.currentUser.uid;
    const avisoEl = document.getElementById("avisoMedia");

    try {
        const res = await apiFetch(`/metas/estimativa/${uid}`);
        const data = await res.json();
        mediaMensalDisponivel = Number(data.mediaMensal) || 0;

        if (avisoEl) {
            avisoEl.style.display = "block";
            if (mediaMensalDisponivel > 0) {
                avisoEl.innerText = `📈 Com base no seu histórico (últimos ${data.baseMeses} mês(es) com movimentação), você guarda em média R$ ${mediaMensalDisponivel.toFixed(2)} por mês.`;
            } else {
                avisoEl.innerText = `⚠️ No seu histórico atual, os gastos igualam ou superam as receitas — ainda não é possível estimar quando as metas serão alcançadas.`;
            }
        }
    } catch (err) {
        console.error("Erro ao carregar média mensal:", err);
    }
}

/* =========================================================
   CARREGAR METAS
========================================================= */

let metasAtuais = [];

async function carregarMetas() {
    const uid = auth.currentUser.uid;
    const res = await apiFetch(`/metas/${uid}`);
    metasAtuais = await res.json();
    renderizarMetas(metasAtuais);
}

function renderizarMetas(metas) {

    const tabela = document.getElementById("tabelaMetas");
    const contagem = document.getElementById("contagemMetas");
    if (contagem) contagem.textContent = `${metas.length} de ${metasAtuais.length} meta(s) exibida(s)`;
    tabela.innerHTML = "";

    if (!metas || metas.length === 0) {
        tabela.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#8FA1A3;">Nenhuma meta cadastrada.</td></tr>`;
        return;
    }

    metas.forEach(meta => {
        const progresso = meta.valor_objetivo > 0
            ? ((meta.valor_atual / meta.valor_objetivo) * 100).toFixed(1)
            : "0.0";

        const previsao = calcularPrevisao(meta);
        const metaMensal = calcularMetaMensalNecessaria(meta);
        const nomeEscapado = escapeHtml(meta.nome).replace(/'/g, "&#39;");

        tabela.innerHTML += `
            <tr>
                <td>${escapeHtml(meta.nome)}</td>
                <td>R$ ${Number(meta.valor_objetivo).toFixed(2)}</td>
                <td>R$ ${Number(meta.valor_atual || 0).toFixed(2)}</td>
                <td>${meta.prazo} meses</td>
                <td>${progresso}%</td>
                <td class="meta-previsao ${previsao.classe}">${previsao.texto}</td>
                <td class="${metaMensal.classe}">${metaMensal.texto}</td>
                <td>${meta.created_at ? new Date(String(meta.created_at).slice(0,10)+"T00:00:00").toLocaleDateString("pt-BR") : "--"}</td>
                <td>
                    <button onclick="abrirModalMeta(${meta.id}, '${nomeEscapado}', ${meta.valor_objetivo}, ${meta.valor_atual || 0}, ${meta.prazo}, 'guardar')" style="background:transparent;border:1px solid #10B981;color:#10B981;padding:4px 8px;border-radius:4px;cursor:pointer;">Guardar</button>
                    <button onclick="abrirModalMeta(${meta.id}, '${nomeEscapado}', ${meta.valor_objetivo}, ${meta.valor_atual || 0}, ${meta.prazo}, 'retirar')" style="background:transparent;border:1px solid #FBBF24;color:#FBBF24;padding:4px 8px;border-radius:4px;cursor:pointer; margin-left:6px;">Retirar</button>
                    <button onclick="excluirMeta(${meta.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer; margin-left:6px;">Excluir</button>
                </td>
            </tr>
        `;
    });
}

window.filtrarMetas = function() {
    const nome = (document.getElementById("filtroMetaNome")?.value || "").toLowerCase().trim();
    const min = parseFloat(document.getElementById("filtroMetaMin")?.value);
    const max = parseFloat(document.getElementById("filtroMetaMax")?.value);
    const pmin = parseFloat(document.getElementById("filtroMetaPrazoMin")?.value);
    const pmax = parseFloat(document.getElementById("filtroMetaPrazoMax")?.value);
    const ini = document.getElementById("filtroMetaInicio")?.value || "";
    const fim = document.getElementById("filtroMetaFim")?.value || "";
    const erroEl = document.getElementById("filtroMetaErro");

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

    renderizarMetas(metasAtuais.filter(m => {
        const d = String(m.created_at || "").slice(0, 10);
        const matchNome = !nome || String(m.nome || "").toLowerCase().includes(nome);
        const matchMin = isNaN(min) || Number(m.valor_objetivo) >= min;
        const matchMax = isNaN(max) || Number(m.valor_objetivo) <= max;
        const matchPmin = isNaN(pmin) || Number(m.prazo) >= pmin;
        const matchPmax = isNaN(pmax) || Number(m.prazo) <= pmax;
        const matchPeriodo = (!ini || d >= ini) && (!fim || d <= fim);
        return matchNome && matchMin && matchMax && matchPmin && matchPmax && matchPeriodo;
    }));
};

window.limparFiltroMetas = function() {
    ["filtroMetaNome", "filtroMetaMin", "filtroMetaMax", "filtroMetaPrazoMin", "filtroMetaPrazoMax", "filtroMetaInicio", "filtroMetaFim"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const iniEl = document.getElementById("filtroMetaInicio");
    const fimEl = document.getElementById("filtroMetaFim");
    if (iniEl) iniEl.removeAttribute("max");
    if (fimEl) fimEl.removeAttribute("min");
    const erroEl = document.getElementById("filtroMetaErro");
    if (erroEl) {
        erroEl.style.display = "none";
        erroEl.textContent = "";
    }
    renderizarMetas(metasAtuais);
};

function inicializarEventosFiltroMetas() {
    const iniEl = document.getElementById("filtroMetaInicio");
    const fimEl = document.getElementById("filtroMetaFim");
    const erroEl = document.getElementById("filtroMetaErro");

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

    ["filtroMetaNome", "filtroMetaMin", "filtroMetaMax", "filtroMetaPrazoMin", "filtroMetaPrazoMax", "filtroMetaInicio", "filtroMetaFim"].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                window.filtrarMetas();
            }
        });
    });
}

/* =========================================================
   MODAL GUARDAR / RETIRAR VALOR
========================================================= */

let metaEmEdicao = null; // { id, nome, valorObjetivo, valorAtual, prazo, modo }

window.abrirModalMeta = function (id, nome, valorObjetivo, valorAtual, prazo, modo) {
    metaEmEdicao = { id, nome, valorObjetivo, valorAtual, prazo, modo };

    const titulo = document.getElementById("modalMetaTitulo");
    const label = document.getElementById("modalMetaLabel");
    const input = document.getElementById("modalMetaValor");
    const erro = document.getElementById("modalMetaErro");
    const btnConfirmar = document.getElementById("modalMetaConfirmar");

    erro.style.display = "none";
    erro.innerText = "";
    input.value = "";

    if (modo === "retirar") {
        titulo.innerText = `Retirar valor de "${nome}"`;
        label.innerText = `Guardado atualmente: R$ ${Number(valorAtual).toFixed(2)}`;
        btnConfirmar.innerText = "Retirar";
        btnConfirmar.style.borderColor = "#FBBF24";
        btnConfirmar.style.color = "#FBBF24";
    } else {
        titulo.innerText = `Guardar valor em "${nome}"`;
        label.innerText = `Objetivo: R$ ${Number(valorObjetivo).toFixed(2)} — Guardado: R$ ${Number(valorAtual).toFixed(2)}`;
        btnConfirmar.innerText = "Guardar";
        btnConfirmar.style.borderColor = "#10B981";
        btnConfirmar.style.color = "#10B981";
    }

    document.getElementById("modalMetaOverlay").style.display = "flex";
    input.focus();
};

window.fecharModalMeta = function () {
    document.getElementById("modalMetaOverlay").style.display = "none";
    metaEmEdicao = null;
};

window.confirmarModalMeta = async function () {
    if (!metaEmEdicao) return;

    const input = document.getElementById("modalMetaValor");
    const erro = document.getElementById("modalMetaErro");
    const valor = parseFloat(String(input.value).replace(",", "."));

    if (isNaN(valor) || valor <= 0) {
        erro.innerText = "Informe um valor válido maior que zero.";
        erro.style.display = "block";
        return;
    }

    const { id, nome, valorObjetivo, valorAtual, prazo, modo } = metaEmEdicao;
    let novoValorAtual;

    if (modo === "retirar") {
        if (valor > Number(valorAtual)) {
            erro.innerText = "Você não pode retirar mais do que está guardado nessa meta.";
            erro.style.display = "block";
            return;
        }
        novoValorAtual = Number(valorAtual) - valor;
    } else {
        novoValorAtual = Number(valorAtual) + valor;
    }

    try {
        const res = await apiFetch(`/metas/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                nome,
                valorObjetivo,
                valorAtual: novoValorAtual,
                prazo
            })
        });
        const data = await res.json();

        if (data.success) {
            window.fecharModalMeta();
            carregarMetas();
            // Avisa outras telas (ex: dashboard) que o valor guardado em metas mudou,
            // para que possam descontar/recarregar o saldo disponível.
            window.dispatchEvent(new CustomEvent("metasAtualizadas"));
        } else {
            erro.innerText = "Erro ao atualizar meta: " + (data.error || "");
            erro.style.display = "block";
        }
    } catch (err) {
        console.error("Erro ao salvar valor da meta:", err);
        erro.innerText = "Falha na comunicação com o servidor.";
        erro.style.display = "block";
    }
};

window.excluirMeta = async function (id) {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;
    try {
        const res = await apiFetch(`/metas/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarMetas();
            window.dispatchEvent(new CustomEvent("metasAtualizadas"));
        } else {
            alert("Erro ao excluir: " + (data.error || ""));
        }
    } catch (err) {
        console.error(err);
        alert("Não foi possível excluir.");
    }
};

/* =========================================================
   DELETAR META
========================================================= */

async function deletarMeta(id) {
    const confirmar = confirm("Tem certeza que deseja excluir esta meta?");

    if (!confirmar) return;

    try {
        const res = await fetch(`/metas/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: usuarioAtual.uid })
        });

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            alert("Meta excluída com sucesso! 🗑️");
            carregarMetas();
        } else {
            alert(data.message || "Não foi possível excluir a meta.");
        }
    } catch (erro) {
        console.error("Erro ao deletar meta:", erro);
        alert("Erro ao excluir meta.");
    }
}

/* =========================================================
   SEGURANÇA
========================================================= */

function escapeHTML(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   DISPONIBILIZAR FUNÇÕES PARA O HTML
========================================================= */

window.salvarMeta = salvarMeta;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "cad.html";
        return;
    }
    inicializarEventosFiltroMetas();
    carregarMediaMensal().then(carregarMetas);
    verificarParcelasPendentes();
});