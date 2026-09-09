import { auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { apiFetch } from "./apiClient.js";

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function fmtMoeda(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(v) {
    const iso = v ? String(v).slice(0, 10) : "";
    if (!iso) return "--";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function dataRegistro(v) {
    return v ? String(v).slice(0, 10) : "";
}

// =====================
// ESTADO
// =====================
let todosGastos = [];
let todasReceitas = [];
let gastosFiltrados = [];
let receitasFiltradas = [];

// =====================
// CARREGAMENTO
// =====================
async function carregarDados() {
    const status = document.getElementById("relatorioStatus");
    status.textContent = "Carregando dados...";
    status.classList.remove("erro");

    const uid = auth.currentUser.uid;

    try {
        const [resGastos, resReceitas] = await Promise.all([
            apiFetch(`/gastos/${uid}`),
            apiFetch(`/receitas/${uid}`)
        ]);

        todosGastos = await resGastos.json();
        todasReceitas = await resReceitas.json();

        if (!Array.isArray(todosGastos)) todosGastos = [];
        if (!Array.isArray(todasReceitas)) todasReceitas = [];

        aplicarFiltro();
        status.textContent = "";
    } catch (err) {
        console.error("Erro ao carregar relatório:", err);
        status.textContent = "Não foi possível carregar os dados do relatório.";
        status.classList.add("erro");
    }
}

function aplicarFiltro() {
    const inicio = document.getElementById("filtroInicio").value;
    const fim = document.getElementById("filtroFim").value;

    gastosFiltrados = todosGastos.filter(g => {
        const d = dataRegistro(g.created_at);
        return (!inicio || d >= inicio) && (!fim || d <= fim);
    });

    receitasFiltradas = todasReceitas.filter(r => {
        const d = dataRegistro(r.created_at);
        return (!inicio || d >= inicio) && (!fim || d <= fim);
    });

    renderizarRelatorio();
}

// =====================
// RENDERIZAÇÃO NA TELA
// =====================
function renderizarRelatorio() {
    const totalGastos = gastosFiltrados.reduce((s, g) => s + Number(g.valor || 0), 0);
    const totalReceitas = receitasFiltradas.reduce((s, r) => s + Number(r.valor || 0), 0);
    const saldo = totalReceitas - totalGastos;

    document.getElementById("rSaldo").textContent = fmtMoeda(saldo);
    document.getElementById("rSaldo").style.color = saldo >= 0 ? "var(--success)" : "var(--danger)";
    document.getElementById("rTotalReceitas").textContent = fmtMoeda(totalReceitas);
    document.getElementById("rTotalGastos").textContent = fmtMoeda(totalGastos);

    // Categorias
    const porCategoria = new Map();
    gastosFiltrados.forEach(g => {
        const cat = g.categoria || "Sem categoria";
        porCategoria.set(cat, (porCategoria.get(cat) || 0) + Number(g.valor || 0));
    });
    const categoriasOrdenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

    const corpoCategorias = document.querySelector("#tabelaCategorias tbody");
    corpoCategorias.innerHTML = categoriasOrdenadas.length
        ? categoriasOrdenadas.map(([cat, total]) => {
            const pct = totalGastos > 0 ? (total / totalGastos * 100) : 0;
            return `<tr><td>${escapeHtml(cat)}</td><td>${fmtMoeda(total)}</td><td>${pct.toFixed(1)}%</td></tr>`;
        }).join("")
        : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhum gasto no período.</td></tr>`;

    // Receitas
    const corpoReceitas = document.querySelector("#tabelaReceitasRel tbody");
    const receitasOrdenadas = [...receitasFiltradas].sort((a, b) =>
        dataRegistro(b.created_at).localeCompare(dataRegistro(a.created_at))
    );
    corpoReceitas.innerHTML = receitasOrdenadas.length
        ? receitasOrdenadas.map(r =>
            `<tr><td>${fmtData(r.created_at)}</td><td>${escapeHtml(r.descricao)}</td><td class="valor-receita">${fmtMoeda(r.valor)}</td></tr>`
        ).join("")
        : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhuma receita no período.</td></tr>`;

    // Gastos
    const corpoGastos = document.querySelector("#tabelaGastosRel tbody");
    const gastosOrdenados = [...gastosFiltrados].sort((a, b) =>
        dataRegistro(b.created_at).localeCompare(dataRegistro(a.created_at))
    );
    corpoGastos.innerHTML = gastosOrdenados.length
        ? gastosOrdenados.map(g =>
            `<tr><td>${fmtData(g.created_at)}</td><td>${escapeHtml(g.descricao)}</td><td>${escapeHtml(g.categoria)}</td><td class="valor-gasto">${fmtMoeda(g.valor)}</td></tr>`
        ).join("")
        : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Nenhum gasto no período.</td></tr>`;
}

// =====================
// LOGO EM BASE64 (para embutir no PDF)
// =====================
function carregarLogoBase64(caminho) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            try {
                resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = caminho;
    });
}

// =====================
// GERAÇÃO DO PDF
// =====================
async function gerarPdf() {
    const btn = document.getElementById("btnGerarPdf");
    const status = document.getElementById("relatorioStatus");
    btn.disabled = true;
    btn.textContent = "Gerando PDF...";
    status.classList.remove("erro");

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const margemEsquerda = 40;
        let cursorY = 40;

        // Logo no canto superior esquerdo
        try {
            const logo = await carregarLogoBase64("./img/LumuzIA.png");
            const larguraLogo = 42;
            const alturaLogo = larguraLogo * (logo.h / logo.w);
            doc.addImage(logo.dataUrl, "PNG", margemEsquerda, cursorY, larguraLogo, alturaLogo);
        } catch (e) {
            console.warn("Não foi possível carregar a logo no PDF:", e);
        }

        // Título ao lado da logo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(20, 20, 20);
        doc.text("LumuzIA", margemEsquerda + 54, cursorY + 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(90, 90, 90);
        doc.text("Relatório de Gastos e Receitas", margemEsquerda + 54, cursorY + 38);

        cursorY += 70;

        const inicio = document.getElementById("filtroInicio").value;
        const fim = document.getElementById("filtroFim").value;
        const periodoTexto = (inicio || fim)
            ? `Período: ${inicio ? fmtData(inicio) : "início"} até ${fim ? fmtData(fim) : "hoje"}`
            : "Período: todos os registros";
        const geradoEm = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;

        doc.setFontSize(10);
        doc.setTextColor(110, 110, 110);
        doc.text(periodoTexto, margemEsquerda, cursorY);
        doc.text(geradoEm, margemEsquerda, cursorY + 14);

        cursorY += 32;

        // Resumo
        const totalGastos = gastosFiltrados.reduce((s, g) => s + Number(g.valor || 0), 0);
        const totalReceitas = receitasFiltradas.reduce((s, r) => s + Number(r.valor || 0), 0);
        const saldo = totalReceitas - totalGastos;

        doc.setFontSize(12);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo do período", margemEsquerda, cursorY);
        cursorY += 8;

        doc.autoTable({
            startY: cursorY,
            margin: { left: margemEsquerda, right: margemEsquerda },
            head: [["Total de Receitas", "Total de Gastos", "Saldo"]],
            body: [[fmtMoeda(totalReceitas), fmtMoeda(totalGastos), fmtMoeda(saldo)]],
            theme: "grid",
            headStyles: { fillColor: [22, 30, 33], textColor: 255, fontStyle: "bold" },
            styles: { fontSize: 10, cellPadding: 6 }
        });
        cursorY = doc.lastAutoTable.finalY + 24;

        // Gastos por categoria
        const porCategoria = new Map();
        gastosFiltrados.forEach(g => {
            const cat = g.categoria || "Sem categoria";
            porCategoria.set(cat, (porCategoria.get(cat) || 0) + Number(g.valor || 0));
        });
        const categoriasOrdenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Gastos por categoria", margemEsquerda, cursorY);
        cursorY += 8;

        doc.autoTable({
            startY: cursorY,
            margin: { left: margemEsquerda, right: margemEsquerda },
            head: [["Categoria", "Total", "% do total de gastos"]],
            body: categoriasOrdenadas.length
                ? categoriasOrdenadas.map(([cat, total]) => [
                    cat,
                    fmtMoeda(total),
                    `${(totalGastos > 0 ? (total / totalGastos * 100) : 0).toFixed(1)}%`
                ])
                : [["Nenhum gasto no período", "-", "-"]],
            theme: "striped",
            headStyles: { fillColor: [242, 166, 90], textColor: 20, fontStyle: "bold" },
            styles: { fontSize: 10, cellPadding: 6 }
        });
        cursorY = doc.lastAutoTable.finalY + 24;

        // Receitas
        const receitasOrdenadas = [...receitasFiltradas].sort((a, b) =>
            dataRegistro(a.created_at).localeCompare(dataRegistro(b.created_at))
        );

        if (cursorY > 700) { doc.addPage(); cursorY = 40; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Receitas", margemEsquerda, cursorY);
        cursorY += 8;

        doc.autoTable({
            startY: cursorY,
            margin: { left: margemEsquerda, right: margemEsquerda },
            head: [["Data", "Descrição", "Valor"]],
            body: receitasOrdenadas.length
                ? receitasOrdenadas.map(r => [fmtData(r.created_at), r.descricao || "", fmtMoeda(r.valor)])
                : [["-", "Nenhuma receita no período", "-"]],
            theme: "striped",
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
            styles: { fontSize: 10, cellPadding: 6 }
        });
        cursorY = doc.lastAutoTable.finalY + 24;

        // Gastos detalhados
        const gastosOrdenados = [...gastosFiltrados].sort((a, b) =>
            dataRegistro(a.created_at).localeCompare(dataRegistro(b.created_at))
        );

        if (cursorY > 680) { doc.addPage(); cursorY = 40; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Gastos", margemEsquerda, cursorY);
        cursorY += 8;

        doc.autoTable({
            startY: cursorY,
            margin: { left: margemEsquerda, right: margemEsquerda },
            head: [["Data", "Descrição", "Categoria", "Valor"]],
            body: gastosOrdenados.length
                ? gastosOrdenados.map(g => [fmtData(g.created_at), g.descricao || "", g.categoria || "", fmtMoeda(g.valor)])
                : [["-", "Nenhum gasto no período", "-", "-"]],
            theme: "striped",
            headStyles: { fillColor: [226, 104, 92], textColor: 255, fontStyle: "bold" },
            styles: { fontSize: 10, cellPadding: 6 }
        });

        // Rodapé com numeração de páginas
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`LumuzIA — página ${i} de ${totalPaginas}`, margemEsquerda, doc.internal.pageSize.getHeight() - 20);
        }

        const nomeArquivo = `relatorio-lumuzia-${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(nomeArquivo);
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        status.textContent = "Não foi possível gerar o PDF. Tente novamente.";
        status.classList.add("erro");
    } finally {
        btn.disabled = false;
        btn.textContent = "📄 Gerar PDF";
    }
}

// =====================
// EVENTOS
// =====================
document.getElementById("btnAplicarFiltro").addEventListener("click", aplicarFiltro);
document.getElementById("btnLimparFiltro").addEventListener("click", () => {
    document.getElementById("filtroInicio").value = "";
    document.getElementById("filtroFim").value = "";
    aplicarFiltro();
});
document.getElementById("btnGerarPdf").addEventListener("click", gerarPdf);

// =====================
// INICIALIZAÇÃO
// =====================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "cad.html";
        return;
    }
    carregarDados();
});