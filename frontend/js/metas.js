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

async function carregarMetas() {
    const uid = auth.currentUser.uid;
    const res = await apiFetch(`/metas/${uid}`);
    const metas = await res.json();

    const tabela = document.getElementById("tabelaMetas");
    tabela.innerHTML = "";

    if (!metas || metas.length === 0) {
        tabela.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#8FA1A3;">Nenhuma meta cadastrada.</td></tr>`;
        return;
    }

    metas.forEach(meta => {
        const progresso = meta.valor_objetivo > 0
            ? ((meta.valor_atual / meta.valor_objetivo) * 100).toFixed(1)
            : "0.0";

        const previsao = calcularPrevisao(meta);

        tabela.innerHTML += `
            <tr>
                <td>${escapeHtml(meta.nome)}</td>
                <td>R$ ${Number(meta.valor_objetivo).toFixed(2)}</td>
                <td>R$ ${Number(meta.valor_atual || 0).toFixed(2)}</td>
                <td>${meta.prazo} meses</td>
                <td>${progresso}%</td>
                <td class="meta-previsao ${previsao.classe}">${previsao.texto}</td>
                <td>
                    <button onclick="depositarMeta(${meta.id}, '${escapeHtml(meta.nome).replace(/'/g, "&#39;")}', ${meta.valor_objetivo}, ${meta.valor_atual || 0}, ${meta.prazo})" style="background:transparent;border:1px solid #10B981;color:#10B981;padding:4px 8px;border-radius:4px;cursor:pointer;">Guardar</button>
                    <button onclick="excluirMeta(${meta.id})" style="background:transparent;border:1px solid #EF4444;color:#EF4444;padding:4px 8px;border-radius:4px;cursor:pointer; margin-left:6px;">Excluir</button>
                </td>
            </tr>
        `;
    });
}

window.depositarMeta = async function (id, nome, valorObjetivo, valorAtual, prazo) {
    const valorStr = prompt(`Quanto você quer guardar para "${nome}"?`);
    if (valorStr === null) return;

    const valor = parseFloat(valorStr.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
        alert("Valor inválido.");
        return;
    }

    const novoValorAtual = Number(valorAtual) + valor;

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
            carregarMetas();
        } else {
            alert("Erro ao atualizar meta: " + (data.error || ""));
        }
    } catch (err) {
        console.error("Erro ao depositar:", err);
        alert("Falha na comunicação com o servidor.");
    }
};

window.excluirMeta = async function (id) {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;
    try {
        const res = await apiFetch(`/metas/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            carregarMetas();
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
    carregarMediaMensal().then(carregarMetas);
    verificarParcelasPendentes();
});