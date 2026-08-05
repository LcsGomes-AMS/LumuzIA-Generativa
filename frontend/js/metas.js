import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarMetas();
    } else {
        window.location.href = "cad.html";
    }
});

async function salvarMeta() {
    const nome = document.getElementById("nome").value.trim();
    const valorObjetivo = parseFloat(document.getElementById("valorObjetivo").value);
    const prazo = parseInt(document.getElementById("prazo").value);

    if (!usuarioAtual) {
        alert("Usuário não autenticado. Aguarde um instante.");
        return;
    }

    if (!nome || isNaN(valorObjetivo) || isNaN(prazo)) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    try {
        const res = await fetch("/metas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                nome,
                valorObjetivo,
                prazo
            })
        });

        const data = await res.json();

        if (data.success) {
            carregarMetas();
            document.getElementById("nome").value = "";
            document.getElementById("valorObjetivo").value = "";
            document.getElementById("prazo").value = "";
        }
    } catch (erro) {
        console.error("Erro ao salvar meta:", erro);
        alert("Não foi possível salvar a meta.");
    }
}

async function carregarMetas() {
    const tabela = document.getElementById("tabelaMetas");
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/metas/${usuarioAtual.uid}`);
        if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`);

        const metas = await res.json();

        tabela.innerHTML = "";

        if (metas.length === 0) {
            tabela.innerHTML = `<tr><td colspan="6">Nenhuma meta cadastrada.</td></tr>`;
            return;
        }

        metas.forEach(meta => {
            const progresso = meta.valor_objetivo > 0 
                ? ((meta.valor_atual / meta.valor_objetivo) * 100).toFixed(1) 
                : "0.0";

            tabela.innerHTML += `
                <tr>
                    <td>${meta.nome}</td>
                    <td>R$ ${Number(meta.valor_objetivo).toFixed(2)}</td>
                    <td>R$ ${Number(meta.valor_atual).toFixed(2)}</td>
                    <td>${meta.prazo} meses</td>
                    <td>${progresso}%</td>
                    <td>
                        <button onclick="editarMeta(${meta.id}, '${meta.nome}', ${meta.valor_objetivo}, ${meta.valor_atual}, ${meta.prazo})">✏️ Editar</button>
                        <button onclick="deletarMeta(${meta.id})">🗑️ Excluir</button>
                    </td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar metas:", erro);
        tabela.innerHTML = `<tr><td colspan="6">Erro ao carregar dados do servidor.</td></tr>`;
    }
}

async function deletarMeta(id) {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return;

    try {
        const res = await fetch(`/metas/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: usuarioAtual.uid })
        });

        const data = await res.json();
        if (data.success) carregarMetas();
    } catch (erro) {
        console.error("Erro ao deletar meta:", erro);
    }
}

async function editarMeta(id, nomeAntigo, valorObjAntigo, valorAtualAntigo, prazoAntigo) {
    const novoNome = prompt("Nome da meta:", nomeAntigo);
    if (novoNome === null) return;

    const novoValorObj = prompt("Valor Objetivo:", valorObjAntigo);
    if (novoValorObj === null || isNaN(parseFloat(novoValorObj))) return;

    const novoValorAtual = prompt("Valor Atual economizado:", valorAtualAntigo);
    if (novoValorAtual === null || isNaN(parseFloat(novoValorAtual))) return;

    const novoPrazo = prompt("Prazo (meses):", prazoAntigo);
    if (novoPrazo === null || isNaN(parseInt(novoPrazo))) return;

    try {
        const res = await fetch(`/metas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                nome: novoNome.trim(),
                valorObjetivo: parseFloat(novoValorObj),
                valorAtual: parseFloat(novoValorAtual),
                prazo: parseInt(novoPrazo)
            })
        });

        const data = await res.json();
        if (data.success) carregarMetas();
    } catch (erro) {
        console.error("Erro ao editar meta:", erro);
    }
}

window.salvarMeta = salvarMeta;
window.deletarMeta = deletarMeta;
window.editarMeta = editarMeta;