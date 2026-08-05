import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioAtual = user;
    localStorage.setItem("userId", user.uid);
    carregarReceitas();
  } else {
    window.location.href = "cad.html";
  }
});

async function salvarReceita() {
  const descricaoInput = document.getElementById("descricao");
  const valorInput = document.getElementById("valor");

  const descricao = descricaoInput.value.trim();
  const valor = parseFloat(valorInput.value);

  if (!usuarioAtual) {
    alert("Usuário ainda não autenticado. Aguarde um instante.");
    return;
  }

  if (!descricao || isNaN(valor)) {
    alert("Por favor, preencha todos os campos corretamente.");
    return;
  }

  try {
    const res = await fetch("/receitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: usuarioAtual.uid,
        descricao,
        valor
      })
    });

    if (!res.ok) throw new Error(`Erro no servidor: ${res.status}`);

    descricaoInput.value = "";
    valorInput.value = "";
    carregarReceitas();

  } catch (erro) {
    console.error("Falha ao salvar receita:", erro);
    alert("Não foi possível salvar a receita.");
  }
}

async function carregarReceitas() {
  const tabela = document.getElementById("tabelaReceitas");
  
  if (!usuarioAtual) return;

  try {
    const res = await fetch(`/receitas/${usuarioAtual.uid}`);
    if (!res.ok) throw new Error(`Erro na requisição: ${res.status}`);

    const receitas = await res.json();

    if (receitas.length === 0) {
      tabela.innerHTML = `<tr><td colspan="3">Nenhuma receita cadastrada.</td></tr>`;
      return;
    }

    let linhasHtml = "";
    receitas.forEach(receita => {
      linhasHtml += `
        <tr>
          <td>${receita.descricao}</td>
          <td>R$ ${Number(receita.valor).toFixed(2)}</td>
          <td>
            <button onclick="editarReceita(${receita.id}, '${receita.descricao}', ${receita.valor})">✏️ Editar</button>
            <button onclick="deletarReceita(${receita.id})">🗑️ Excluir</button>
          </td>
        </tr>
      `;
    });

    tabela.innerHTML = linhasHtml;

  } catch (erro) {
    console.error("Falha ao carregar receitas:", erro);
    tabela.innerHTML = `<tr><td colspan="3">Erro ao carregar dados do servidor.</td></tr>`;
  }
}

async function deletarReceita(id) {
  if (!confirm("Tem certeza que deseja excluir esta receita?")) return;

  try {
    const res = await fetch(`/receitas/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioAtual.uid })
    });

    const data = await res.json();
    if (data.success) carregarReceitas();
  } catch (erro) {
    console.error("Erro ao deletar receita:", erro);
  }
}

async function editarReceita(id, descricaoAntiga, valorAntigo) {
  const novaDescricao = prompt("Nova descrição:", descricaoAntiga);
  if (novaDescricao === null) return;

  const novoValor = prompt("Novo valor:", valorAntigo);
  if (novoValor === null || isNaN(parseFloat(novoValor))) return;

  try {
    const res = await fetch(`/receitas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: usuarioAtual.uid,
        descricao: novaDescricao.trim(),
        valor: parseFloat(novoValor)
      })
    });

    const data = await res.json();
    if (data.success) carregarReceitas();
  } catch (erro) {
    console.error("Erro ao editar receita:", erro);
  }
}

window.salvarReceita = salvarReceita;
window.deletarReceita = deletarReceita;
window.editarReceita = editarReceita;