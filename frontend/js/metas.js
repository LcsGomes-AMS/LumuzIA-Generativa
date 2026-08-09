import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* =========================================================
   USUÁRIO
========================================================= */

let usuarioAtual = null;

/* =========================================================
   AUTENTICAÇÃO
========================================================= */

onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioAtual = user;
        localStorage.setItem("userId", user.uid);
        carregarMetas();
    } else {
        window.location.href = "cad.html";
    }
});

/* =========================================================
   SALVAR META
========================================================= */

async function salvarMeta() {
    const nomeInput = document.getElementById("nome");
    const valorObjetivoInput = document.getElementById("valorObjetivo");
    const prazoInput = document.getElementById("prazo");

    const nome = nomeInput.value.trim();
    const valorObjetivo = parseFloat(valorObjetivoInput.value);
    const prazo = parseInt(prazoInput.value);

    if (!usuarioAtual) {
        alert("Usuário não autenticado. Aguarde um instante.");
        return;
    }

    if (!nome || isNaN(valorObjetivo) || valorObjetivo <= 0 || isNaN(prazo) || prazo <= 0) {
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

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            alert("Meta criada com sucesso! 🎯");

            nomeInput.value = "";
            valorObjetivoInput.value = "";
            prazoInput.value = "";

            carregarMetas();
        } else {
            alert(data.message || "Não foi possível salvar a meta.");
        }
    } catch (erro) {
        console.error("Erro ao salvar meta:", erro);
        alert("Não foi possível salvar a meta.");
    }
}

/* =========================================================
   CARREGAR METAS
========================================================= */

async function carregarMetas() {
    const tabela = document.getElementById("tabelaMetas");

    if (!tabela) {
        console.error("Elemento #tabelaMetas não encontrado.");
        return;
    }

    if (!usuarioAtual) return;

    try {
        const res = await fetch(`/metas/${usuarioAtual.uid}`);

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const metas = await res.json();

        tabela.innerHTML = "";

        if (!Array.isArray(metas) || metas.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6">Nenhuma meta cadastrada.</td>
                </tr>
            `;
            return;
        }

        metas.forEach((meta) => {
            const valorObjetivo = Number(meta.valor_objetivo) || 0;
            const valorAtual = Number(meta.valor_atual) || 0;
            const prazo = Number(meta.prazo) || 0;

            let progresso = 0;

            if (valorObjetivo > 0) {
                progresso = (valorAtual / valorObjetivo) * 100;
            }

            progresso = Math.min(progresso, 100);

            const nomeMeta = JSON.stringify(meta.nome);

            tabela.innerHTML += `
                <tr>
                    <!-- META -->
                    <td data-label="Meta">${escapeHTML(meta.nome)}</td>

                    <!-- OBJETIVO -->
                    <td data-label="Objetivo">R$ ${valorObjetivo.toFixed(2)}</td>

                    <!-- GUARDADO -->
                    <td data-label="Guardado">R$ ${valorAtual.toFixed(2)}</td>

                    <!-- PRAZO -->
                    <td data-label="Prazo">${prazo} meses</td>

                    <!-- PROGRESSO -->
                    <td data-label="Progresso">
                        <div class="progress-container">
                            <div class="progress-bar" style="width:${progresso}%;"></div>
                        </div>
                        <strong class="progress-text">${progresso.toFixed(1)}%</strong>
                    </td>

                    <!-- AÇÕES -->
                    <td data-label="Ações">
                        <button
                            type="button"
                            class="btn-add"
                            onclick='adicionarSaldo(${meta.id}, ${nomeMeta}, ${valorAtual}, ${valorObjetivo}, ${prazo})'
                        >
                            💰 Adicionar
                        </button>

                        <button
                            type="button"
                            class="btn-remove"
                            onclick='removerSaldo(${meta.id}, ${nomeMeta}, ${valorAtual}, ${valorObjetivo}, ${prazo})'
                        >
                            ➖ Remover
                        </button>

                        <button
                            type="button"
                            class="btn-edit"
                            onclick='editarMeta(${meta.id}, ${nomeMeta}, ${valorObjetivo}, ${valorAtual}, ${prazo})'
                        >
                            ✏️ Editar
                        </button>

                        <button
                            type="button"
                            class="btn-delete"
                            onclick="deletarMeta(${meta.id})"
                        >
                            🗑️ Excluir
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (erro) {
        console.error("Erro ao carregar metas:", erro);

        tabela.innerHTML = `
            <tr>
                <td colspan="6">❌ Erro ao carregar dados do servidor.</td>
            </tr>
        `;
    }
}

/* =========================================================
   MODAL "ADICIONAR/REMOVER SALDO"
========================================================= */

function injetarEstilosModal() {
    if (document.getElementById("estilos-modal-saldo")) return;

    const style = document.createElement("style");
    style.id = "estilos-modal-saldo";

    style.textContent = `
        .modal-saldo-overlay {
            position: fixed;
            inset: 0;
            background: rgba(10, 14, 16, 0.72);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease;
            padding: 16px;
        }

        .modal-saldo-overlay.aberto {
            opacity: 1;
        }

        .modal-saldo-card {
            background: linear-gradient(145deg, rgba(22, 30, 33, 0.98), rgba(29, 39, 43, 0.9));
            border: 1px solid var(--border, #2A3538);
            border-radius: var(--radius, 14px);
            width: 100%;
            max-width: 380px;
            padding: 28px 26px 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
            transform: translateY(12px) scale(0.97);
            transition: transform 0.2s ease;
            font-family: var(--font-body, 'Inter', system-ui, sans-serif);
            color: var(--text, #F3EFE7);
        }

        .modal-saldo-overlay.aberto .modal-saldo-card {
            transform: translateY(0) scale(1);
        }

        .modal-saldo-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;
        }

        .modal-saldo-icone {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--accent, #F2A65A), #E8903F);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
            box-shadow: 0 8px 20px rgba(242, 166, 90, 0.18);
        }

        .modal-saldo-titulo {
            font-family: var(--font-display, 'Space Grotesk', sans-serif);
            font-size: 17px;
            font-weight: 700;
            letter-spacing: -0.01em;
            color: var(--text, #F3EFE7);
        }

        .modal-saldo-nomemeta {
            font-size: 13px;
            color: var(--text-muted, #8FA1A3);
            margin: 0 0 18px 52px;
        }

        .modal-saldo-info {
            display: flex;
            justify-content: space-between;
            background: var(--surface-2, #1D272B);
            border: 1px solid var(--border, #2A3538);
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 16px;
        }

        .modal-saldo-info-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .modal-saldo-info-label {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 10px;
            color: var(--text-muted, #8FA1A3);
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .modal-saldo-info-valor {
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 14px;
            font-weight: 500;
            color: var(--text, #F3EFE7);
        }

        .modal-saldo-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--text, #F3EFE7);
            margin-bottom: 6px;
            display: block;
        }

        .modal-saldo-input-wrap {
            position: relative;
            margin-bottom: 14px;
        }

        .modal-saldo-prefixo {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted, #8FA1A3);
            font-weight: 600;
            font-size: 15px;
            pointer-events: none;
        }

        .modal-saldo-input {
            width: 100%;
            box-sizing: border-box;
            height: 46px;
            padding: 0 14px 0 40px;
            border-radius: 9px;
            border: 1px solid var(--border, #2A3538);
            background: var(--surface-2, #1D272B);
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 16px;
            font-weight: 500;
            color: var(--text, #F3EFE7);
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .modal-saldo-input::placeholder {
            color: var(--text-muted, #8FA1A3);
        }

        .modal-saldo-input:focus {
            border-color: var(--accent-2, #6FE7DD);
            background: #202C30;
            box-shadow: 0 0 0 3px rgba(111, 231, 221, 0.08);
        }

        .modal-saldo-rapidos {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
        }

        .modal-saldo-chip {
            flex: 1;
            padding: 8px 0;
            border-radius: 8px;
            border: 1px solid var(--border, #2A3538);
            background: var(--surface-2, #1D272B);
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 12px;
            font-weight: 500;
            color: var(--text-muted, #8FA1A3);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .modal-saldo-chip:hover {
            border-color: var(--accent-2, #6FE7DD);
            color: var(--accent-2, #6FE7DD);
            background: rgba(111, 231, 221, 0.08);
        }

        .modal-saldo-progresso-wrap {
            margin-bottom: 20px;
        }

        .modal-saldo-progresso-linha {
            display: flex;
            justify-content: space-between;
            font-family: var(--font-mono, 'JetBrains Mono', monospace);
            font-size: 11px;
            color: var(--text-muted, #8FA1A3);
            margin-bottom: 7px;
        }

        .modal-saldo-progresso-linha strong {
            color: var(--accent-2, #6FE7DD);
            font-weight: 500;
        }

        .modal-saldo-barra-fundo {
            width: 100%;
            height: 8px;
            border-radius: 999px;
            background: #263236;
            overflow: hidden;
        }

        .modal-saldo-barra-preenchida {
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, var(--accent-2, #6FE7DD), var(--success, #10B981));
            box-shadow: 0 0 10px rgba(111, 231, 221, 0.2);
            transition: width 0.2s ease;
        }

        .modal-saldo-botoes {
            display: flex;
            gap: 10px;
        }

        .modal-saldo-btn {
            flex: 1;
            height: 44px;
            border-radius: 9px;
            font-family: var(--font-body, 'Inter', sans-serif);
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            border: none;
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease, background 0.2s ease;
        }

        .modal-saldo-btn:active {
            transform: scale(0.97);
        }

        .modal-saldo-btn-cancelar {
            background: var(--surface-2, #1D272B);
            border: 1px solid var(--border, #2A3538);
            color: var(--text, #F3EFE7);
        }

        .modal-saldo-btn-cancelar:hover {
            border-color: var(--border-light, #334155);
            transform: translateY(-1px);
        }

        .modal-saldo-btn-confirmar {
            background: linear-gradient(135deg, var(--accent, #F2A65A), #E8903F);
            color: #1A1206;
        }

        .modal-saldo-btn-confirmar:hover:not(:disabled) {
            transform: translateY(-2px);
            filter: brightness(1.05);
            box-shadow: 0 8px 22px rgba(242, 166, 90, 0.18);
        }

        /* Variante "remover" */

        .modal-saldo-icone.remover {
            background: linear-gradient(135deg, var(--danger, #E2685C), #C4493D);
            box-shadow: 0 8px 20px rgba(226, 104, 92, 0.18);
        }

        .modal-saldo-input.remover:focus {
            border-color: var(--danger, #E2685C);
            box-shadow: 0 0 0 3px rgba(226, 104, 92, 0.12);
        }

        .modal-saldo-chip.remover:hover {
            border-color: var(--danger, #E2685C);
            color: var(--danger, #E2685C);
            background: rgba(226, 104, 92, 0.08);
        }

        .modal-saldo-barra-preenchida.remover {
            background: linear-gradient(90deg, var(--warning, #F59E0B), var(--danger, #E2685C));
            box-shadow: 0 0 10px rgba(226, 104, 92, 0.2);
        }

        .modal-saldo-btn-confirmar.remover {
            background: linear-gradient(135deg, var(--danger, #E2685C), #C4493D);
            color: #fff;
        }

        .modal-saldo-btn-confirmar.remover:hover:not(:disabled) {
            box-shadow: 0 8px 22px rgba(226, 104, 92, 0.22);
        }

        .modal-saldo-btn-confirmar:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        .modal-saldo-erro {
            font-size: 12px;
            color: var(--danger, #E2685C);
            margin: -8px 0 12px;
            min-height: 14px;
        }
    `;

    document.head.appendChild(style);
}

function fecharModalSaldo() {
    const overlay = document.getElementById("modal-saldo-overlay");

    if (!overlay) return;

    overlay.classList.remove("aberto");

    setTimeout(() => overlay.remove(), 180);
}

function abrirModalSaldo(modo, id, nome, valorAtual, valorObjetivo, prazo) {
    injetarEstilosModal();

    // Remove modal antigo, se existir
    const antigo = document.getElementById("modal-saldo-overlay");
    if (antigo) antigo.remove();

    const ehRemover = modo === "remover";

    valorAtual = Number(valorAtual);
    valorObjetivo = Number(valorObjetivo);

    const progressoAtual =
        valorObjetivo > 0 ? Math.min((valorAtual / valorObjetivo) * 100, 100) : 0;

    const textos = ehRemover
        ? {
              icone: "➖",
              titulo: "Remover saldo",
              label: "Valor a remover",
              prefixoChip: "−R$",
              confirmar: "Remover",
              salvando: "Removendo..."
          }
        : {
              icone: "💰",
              titulo: "Adicionar saldo",
              label: "Valor a adicionar",
              prefixoChip: "+R$",
              confirmar: "Confirmar",
              salvando: "Salvando..."
          };

    const overlay = document.createElement("div");
    overlay.className = "modal-saldo-overlay";
    overlay.id = "modal-saldo-overlay";

    overlay.innerHTML = `
        <div class="modal-saldo-card">
            <div class="modal-saldo-header">
                <div class="modal-saldo-icone${ehRemover ? " remover" : ""}">${textos.icone}</div>
                <div class="modal-saldo-titulo">${textos.titulo}</div>
            </div>

            <p class="modal-saldo-nomemeta">${escapeHTML(nome)}</p>

            <div class="modal-saldo-info">
                <div class="modal-saldo-info-item">
                    <span class="modal-saldo-info-label">Guardado</span>
                    <span class="modal-saldo-info-valor" id="modal-saldo-guardado">R$ ${valorAtual.toFixed(2)}</span>
                </div>
                <div class="modal-saldo-info-item" style="text-align:right;">
                    <span class="modal-saldo-info-label">Objetivo</span>
                    <span class="modal-saldo-info-valor">R$ ${valorObjetivo.toFixed(2)}</span>
                </div>
            </div>

            <label class="modal-saldo-label" for="modal-saldo-input">${textos.label}</label>

            <div class="modal-saldo-input-wrap">
                <span class="modal-saldo-prefixo">R$</span>
                <input
                    type="text"
                    inputmode="decimal"
                    id="modal-saldo-input"
                    class="modal-saldo-input${ehRemover ? " remover" : ""}"
                    placeholder="0,00"
                    autocomplete="off"
                />
            </div>

            <div class="modal-saldo-erro" id="modal-saldo-erro"></div>

            <div class="modal-saldo-rapidos">
                <button type="button" class="modal-saldo-chip${ehRemover ? " remover" : ""}" data-valor="50">${textos.prefixoChip}50</button>
                <button type="button" class="modal-saldo-chip${ehRemover ? " remover" : ""}" data-valor="100">${textos.prefixoChip}100</button>
                <button type="button" class="modal-saldo-chip${ehRemover ? " remover" : ""}" data-valor="200">${textos.prefixoChip}200</button>
                <button type="button" class="modal-saldo-chip${ehRemover ? " remover" : ""}" data-valor="500">${textos.prefixoChip}500</button>
            </div>

            <div class="modal-saldo-progresso-wrap">
                <div class="modal-saldo-progresso-linha">
                    <span>Progresso</span>
                    <strong id="modal-saldo-progresso-texto">${progressoAtual.toFixed(1)}%</strong>
                </div>
                <div class="modal-saldo-barra-fundo">
                    <div
                        class="modal-saldo-barra-preenchida${ehRemover ? " remover" : ""}"
                        id="modal-saldo-barra"
                        style="width:${progressoAtual}%;"
                    ></div>
                </div>
            </div>

            <div class="modal-saldo-botoes">
                <button type="button" class="modal-saldo-btn modal-saldo-btn-cancelar" id="modal-saldo-cancelar">
                    Cancelar
                </button>
                <button type="button" class="modal-saldo-btn modal-saldo-btn-confirmar${ehRemover ? " remover" : ""}" id="modal-saldo-confirmar" disabled>
                    ${textos.confirmar}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add("aberto"));

    const input = overlay.querySelector("#modal-saldo-input");
    const erroEl = overlay.querySelector("#modal-saldo-erro");
    const btnConfirmar = overlay.querySelector("#modal-saldo-confirmar");
    const barra = overlay.querySelector("#modal-saldo-barra");
    const progressoTexto = overlay.querySelector("#modal-saldo-progresso-texto");

    function atualizarPreview() {
        const bruto = input.value.replace(",", ".");
        const valor = parseFloat(bruto);

        if (isNaN(valor) || valor <= 0) {
            btnConfirmar.disabled = true;

            erroEl.textContent =
                input.value.trim() === "" ? "" : "Digite um valor válido maior que zero.";

            barra.style.width = `${progressoAtual}%`;
            progressoTexto.textContent = `${progressoAtual.toFixed(1)}%`;

            return;
        }

        if (ehRemover && valor > valorAtual) {
            btnConfirmar.disabled = true;

            erroEl.textContent = `Você só tem R$ ${valorAtual.toFixed(2)} guardado nessa meta.`;

            barra.style.width = `${progressoAtual}%`;
            progressoTexto.textContent = `${progressoAtual.toFixed(1)}%`;

            return;
        }

        erroEl.textContent = "";
        btnConfirmar.disabled = false;

        const novoTotal = ehRemover ? valorAtual - valor : valorAtual + valor;

        let novoProgresso = valorObjetivo > 0 ? (novoTotal / valorObjetivo) * 100 : 0;
        novoProgresso = Math.min(Math.max(novoProgresso, 0), 100);

        barra.style.width = `${novoProgresso}%`;
        progressoTexto.textContent = `${novoProgresso.toFixed(1)}%`;
    }

    input.addEventListener("input", atualizarPreview);

    overlay.querySelectorAll(".modal-saldo-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const atual = parseFloat(input.value.replace(",", ".")) || 0;
            const passo = Number(chip.dataset.valor);

            input.value = (atual + passo).toFixed(2).replace(".", ",");

            atualizarPreview();
        });
    });

    overlay.querySelector("#modal-saldo-cancelar").addEventListener("click", fecharModalSaldo);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) fecharModalSaldo();
    });

    document.addEventListener("keydown", function escListener(e) {
        if (e.key === "Escape") {
            fecharModalSaldo();
            document.removeEventListener("keydown", escListener);
        }
    });

    btnConfirmar.addEventListener("click", async () => {
        const valorDigitado = parseFloat(input.value.replace(",", "."));

        if (isNaN(valorDigitado) || valorDigitado <= 0) return;
        if (ehRemover && valorDigitado > valorAtual) return;

        btnConfirmar.disabled = true;
        btnConfirmar.textContent = textos.salvando;

        const novoValorAtual = ehRemover ? valorAtual - valorDigitado : valorAtual + valorDigitado;

        try {
            const res = await fetch(`/metas/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: usuarioAtual.uid,
                    nome,
                    valorObjetivo,
                    valorAtual: novoValorAtual,
                    prazo: Number(prazo)
                })
            });

            if (!res.ok) {
                throw new Error(`Erro HTTP: ${res.status}`);
            }

            const data = await res.json();

            if (data.success) {
                fecharModalSaldo();

                if (!ehRemover && novoValorAtual >= valorObjetivo) {
                    alert(
                        `🎉 META ATINGIDA!\n\n${nome}\n\nSaldo: R$ ${novoValorAtual.toFixed(2)}\nProgresso: 100%`
                    );
                }

                carregarMetas();
            } else {
                erroEl.textContent =
                    data.message ||
                    (ehRemover
                        ? "Não foi possível remover o saldo."
                        : "Não foi possível adicionar o saldo.");

                btnConfirmar.disabled = false;
                btnConfirmar.textContent = textos.confirmar;
            }
        } catch (erro) {
            console.error(
                ehRemover ? "Erro ao remover saldo:" : "Erro ao adicionar saldo:",
                erro
            );

            erroEl.textContent = ehRemover ? "Erro ao remover saldo." : "Erro ao adicionar saldo.";

            btnConfirmar.disabled = false;
            btnConfirmar.textContent = textos.confirmar;
        }
    });

    setTimeout(() => input.focus(), 200);
}

function adicionarSaldo(id, nome, valorAtual, valorObjetivo, prazo) {
    abrirModalSaldo("adicionar", id, nome, valorAtual, valorObjetivo, prazo);
}

function removerSaldo(id, nome, valorAtual, valorObjetivo, prazo) {
    abrirModalSaldo("remover", id, nome, valorAtual, valorObjetivo, prazo);
}

/* =========================================================
   EDITAR META
========================================================= */

async function editarMeta(id, nomeAntigo, valorObjAntigo, valorAtualAntigo, prazoAntigo) {
    const novoNome = prompt("Nome da meta:", nomeAntigo);

    if (novoNome === null) return;

    if (!novoNome.trim()) {
        alert("O nome não pode ficar vazio.");
        return;
    }

    const novoValorObj = prompt("Valor Objetivo:", valorObjAntigo);

    if (novoValorObj === null) return;

    const valorObjetivo = parseFloat(novoValorObj.replace(",", "."));

    if (isNaN(valorObjetivo) || valorObjetivo <= 0) {
        alert("Digite um valor objetivo válido.");
        return;
    }

    const novoValorAtual = prompt("Valor Atual economizado:", valorAtualAntigo);

    if (novoValorAtual === null) return;

    const valorAtual = parseFloat(novoValorAtual.replace(",", "."));

    if (isNaN(valorAtual) || valorAtual < 0) {
        alert("Digite um valor atual válido.");
        return;
    }

    const novoPrazo = prompt("Prazo (meses):", prazoAntigo);

    if (novoPrazo === null) return;

    const prazo = parseInt(novoPrazo);

    if (isNaN(prazo) || prazo <= 0) {
        alert("Digite um prazo válido.");
        return;
    }

    try {
        const res = await fetch(`/metas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: usuarioAtual.uid,
                nome: novoNome.trim(),
                valorObjetivo,
                valorAtual,
                prazo
            })
        });

        if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            alert("Meta atualizada com sucesso! ✅");
            carregarMetas();
        } else {
            alert(data.message || "Não foi possível editar a meta.");
        }
    } catch (erro) {
        console.error("Erro ao editar meta:", erro);
        alert("Erro ao editar meta.");
    }
}

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
window.adicionarSaldo = adicionarSaldo;
window.removerSaldo = removerSaldo;
window.editarMeta = editarMeta;
window.deletarMeta = deletarMeta;