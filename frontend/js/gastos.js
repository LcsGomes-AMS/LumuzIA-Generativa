import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarGastos();
    } else {
        window.location.href = "cad.html";
    }
});

async function salvarGasto() {
    const descricao = document.getElementById("descricao").value.trim();
    const valor = parseFloat(document.getElementById("valor").value);
    const categoria = document.getElementById("categoria").value;

    if (!usuarioAtual) {
        alert("Usuário não autenticado. Aguarde um instante.");
        return;
    }

    if (!descricao || isNaN(valor)) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    try {
        const res = await fetch("/gastos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                descricao,
                valor,
                categoria
            })
        });

        const data = await res.json();

        if (data.success) {
            carregarGastos();
            document.getElementById("descricao").value = "";
            document.getElementById("valor").value = "";
        }
    } catch (erro) {
        console.error("Erro ao salvar gasto:", erro);
        alert("Não foi possível salvar o gasto.");
    }
}

async function carregarGastos() {
    const tabela = document.getElementById("tabelaGastos");
    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/gastos/${usuarioAtual.uid}`);
        if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`);

        const gastos = await res.json();

        tabela.innerHTML = "";

        if (gastos.length === 0) {
            tabela.innerHTML = `<tr><td colspan="4">Nenhum gasto cadastrado.</td></tr>`;
            return;
        }

        gastos.forEach(gasto => {
            tabela.innerHTML += `
                <tr>
                    <td>${gasto.descricao}</td>
                    <td>R$ ${Number(gasto.valor).toFixed(2)}</td>
                    <td>${gasto.categoria}</td>
                    <td>
                        <button onclick="editarGasto(${gasto.id}, '${gasto.descricao}', ${gasto.valor}, '${gasto.categoria}')">✏️ Editar</button>
                        <button onclick="deletarGasto(${gasto.id})">🗑️ Excluir</button>
                    </td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar gastos:", erro);
        tabela.innerHTML = `<tr><td colspan="4">Erro ao carregar dados do servidor.</td></tr>`;
    }
}

async function deletarGasto(id) {
    if (!confirm("Tem certeza que deseja excluir este gasto?")) return;

    try {
        const res = await fetch(`/gastos/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: usuarioAtual.uid })
        });

        const data = await res.json();
        if (data.success) carregarGastos();
    } catch (erro) {
        console.error("Erro ao deletar gasto:", erro);
    }
}

async function editarGasto(id, descricaoAntiga, valorAntigo, categoriaAntiga) {
    const novaDescricao = prompt("Nova descrição:", descricaoAntiga);
    if (novaDescricao === null) return;

    const novoValor = prompt("Novo valor:", valorAntigo);
    if (novoValor === null || isNaN(parseFloat(novoValor))) return;

    const novaCategoria = prompt("Nova categoria:", categoriaAntiga);
    if (novaCategoria === null) return;

    try {
        const res = await fetch(`/gastos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                descricao: novaDescricao.trim(),
                valor: parseFloat(novoValor),
                categoria: novaCategoria.trim()
            })
        });

        const data = await res.json();
        if (data.success) carregarGastos();
    } catch (erro) {
        console.error("Erro ao editar gasto:", erro);
    }
}

window.salvarGasto = salvarGasto;
window.deletarGasto = deletarGasto;
window.editarGasto = editarGasto;