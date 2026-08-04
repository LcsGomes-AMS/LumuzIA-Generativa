import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let usuarioAtual = null;

// Escuta o login do Firebase antes de liberar as chamadas para o backend
onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioAtual = user;
    localStorage.setItem("userId", user.uid);
    carregarReceitas(); // Carrega apenas depois de confirmar o usuário
  } else {
    window.location.href = "cad.html"; // Redireciona se não estiver logado
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: usuarioAtual.uid, // <-- Garante o UID real do Firebase (ex: "Kj98aXzL0mN...")
        descricao,
        valor
      })
    });

    if (!res.ok) {
      throw new Error(`Erro no servidor: ${res.status}`);
    }

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

    if (!res.ok) {
      throw new Error(`Erro na requisição: ${res.status}`);
    }

    const receitas = await res.json();

    if (receitas.length === 0) {
      tabela.innerHTML = `<tr><td colspan="2">Nenhuma receita cadastrada.</td></tr>`;
      return;
    }

    let linhasHtml = "";
    receitas.forEach(receita => {
      linhasHtml += `
        <tr>
          <td>${receita.descricao}</td>
          <td>R$ ${Number(receita.valor).toFixed(2)}</td>
        </tr>
      `;
    });

    tabela.innerHTML = linhasHtml;

  } catch (erro) {
    console.error("Falha ao carregar receitas:", erro);
    tabela.innerHTML = `<tr><td colspan="2">Erro ao carregar dados do servidor.</td></tr>`;
  }
}

// Torna a função global para o atributo onclick="" do HTML encontrar
window.salvarReceita = salvarReceita;