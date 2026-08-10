//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const db = require("./database");
const { verificarAutenticacao } = require("./firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Helper: Promisify para consultas SQLite
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err); else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// Helper para evitar violações de chave estrangeira ao cadastrar dados
async function garantirUsuarioExiste(userId) {
    if (!userId) return;
    await dbRun(`INSERT OR IGNORE INTO users (id) VALUES (?)`, [userId]);
}
// Lança automaticamente na tabela certa (gastos/receitas/metas) todo
// agendamento cuja data já chegou/passou e ainda está pendente.
async function processarAgendamentosPendentes(userId) {
    const hoje = new Date().toISOString().split("T")[0];
    const pendentes = await dbAll(
        "SELECT * FROM agendamentos WHERE user_id = ? AND status = 'pendente' AND data_agendada <= ? ORDER BY data_agendada ASC",
        [userId, hoje]
    );

    const lancados = [];

    for (const ag of pendentes) {
        try {
            if (ag.tipo === "gasto") {
                await dbRun(
                    `INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, ?, ?)`,
                    [userId, ag.descricao, ag.valor, ag.categoria || "Geral"]
                );
            } else if (ag.tipo === "receita") {
                await dbRun(
                    `INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)`,
                    [userId, ag.descricao, ag.valor]
                );
            } else if (ag.tipo === "meta") {
                await dbRun(
                    `INSERT INTO metas (user_id, nome, valor_objetivo, prazo) VALUES (?, ?, ?, ?)`,
                    [userId, ag.descricao, ag.valor, ag.prazo || 12]
                );
            }

            await dbRun(`UPDATE agendamentos SET status = 'lancado' WHERE id = ?`, [ag.id]);
            lancados.push(ag);
        } catch (err) {
            console.error(`Erro ao lançar agendamento ${ag.id}:`, err.message);
        }
    }

    return lancados;
}

// Cache em memória para cotações (10 minutos de TTL)
const priceCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const https = require("https");

// Agente HTTPS para ignorar erros de SSL em redes com proxy/bloqueio
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Mapeamento completo de criptomoedas para a AwesomeAPI
const MAPA_AWESOME = {
    "BITCOIN": "BTC-BRL",
    "BTC": "BTC-BRL",
    "ETHEREUM": "ETH-BRL",
    "ETH": "ETH-BRL",
    "SOLANA": "SOL-BRL",
    "SOL": "SOL-BRL",
    "CARDANO": "ADA-BRL",
    "ADA": "ADA-BRL",
    "RIPPLE": "XRP-BRL",
    "XRP": "XRP-BRL",
    "DOGECOIN": "DOGE-BRL",
    "DOGE": "DOGE-BRL",
    "POLKADOT": "DOT-BRL",
    "DOT": "DOT-BRL",
    "TETHER": "USDT-BRL",
    "USDT": "USDT-BRL"
};

async function obterPrecoAtivo(ticker, tipo) {
    if (!ticker) return null;

    let tickerUpper = ticker.toUpperCase().trim();
    const tipoUpper = (tipo || "").toUpperCase().trim();

    const ehCripto = tipoUpper.includes("CRIPTO") || Boolean(MAPA_AWESOME[tickerUpper]);
    const cacheKey = `${tickerUpper}_${ehCripto ? "CRIPTO" : tipoUpper}`;

    // 1. Cache
    if (priceCache.has(cacheKey)) {
        const cached = priceCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.price;
        }
    }

    try {
        let price = null;

        // 2. BUSCA CRIPTOMOEDAS (AwesomeAPI -> Binance Fallback)
        if (ehCripto) {
            const par = MAPA_AWESOME[tickerUpper] || `${tickerUpper}-BRL`;

            const resAwesome = await axios.get(`https://economia.awesomeapi.com.br/last/${par}`, {
                httpsAgent,
                timeout: 5000
            }).catch(() => null);

            const chaveAwesome = par.replace("-", "");
            if (resAwesome?.data?.[chaveAwesome]?.bid) {
                price = parseFloat(resAwesome.data[chaveAwesome].bid);
            }

            if (!price) {
                const resBinance = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${tickerUpper}BRL`, {
                    httpsAgent,
                    timeout: 4000
                }).catch(() => null);

                if (resBinance?.data?.price) {
                    price = parseFloat(resBinance.data.price);
                }
            }
        }
        // 3. BUSCA AÇÕES E FIIS B3 (StatusInvest Web Scraping -> Brapi Fallback)
        else {
            try {
                const pathType = tipoUpper.includes("FII") ? "fundos-imobiliarios" : "acoes";
                const url = `https://statusinvest.com.br/${pathType}/${tickerUpper}`;

                const { data } = await axios.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    httpsAgent,
                    timeout: 5000
                });

                const $ = cheerio.load(data);
                const precoTexto = $('div[title="Valor atual do ativo"] strong.value').text();

                if (precoTexto) {
                    const priceClean = precoTexto.replace(/\./g, "").replace(",", ".").trim();
                    const parsed = parseFloat(priceClean);
                    if (!isNaN(parsed) && parsed > 0) price = parsed;
                }
            } catch (errScrap) {
                // Silencioso para tentar o fallback
            }

            if (!price) {
                const brapiRes = await axios.get(`https://brapi.dev/api/quote/${tickerUpper}`, {
                    httpsAgent,
                    timeout: 4000
                }).catch(() => null);

                if (brapiRes?.data?.results?.[0]?.regularMarketPrice) {
                    price = parseFloat(brapiRes.data.results[0].regularMarketPrice);
                }
            }
        }

        if (price !== null && !isNaN(price) && price > 0) {
            priceCache.set(cacheKey, { price, timestamp: Date.now() });
            return price;
        }

        console.warn(`[COTAÇÃO AVISO] Não foi possível capturar preço em tempo real para: ${tickerUpper}. Usando Preço Médio.`);
        return null;
    } catch (error) {
        console.error(`[COTAÇÃO ERRO] Falha geral em ${tickerUpper}:`, error.message);
        return null;
    }
}

// =====================
// ROTAS DE NAVEGAÇÃO
// =====================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dashboard.html"));
});

// A partir daqui, TODAS as rotas abaixo exigem token válido (header Authorization: Bearer <token>).
// req.uid é o UID real, extraído do token — nunca confie em req.params.userId / req.body.userId
// para decidir DE QUEM são os dados; use sempre req.uid para isso.
app.use(verificarAutenticacao);

// =====================
// PERFIL
// =====================
app.post("/perfil", async (req, res) => {
    const userId = req.uid;
    const { nome, salario, meta, valorMeta } = req.body;

    try {
        await dbRun(
            `INSERT INTO users (id, nome, salario, meta, valor_meta)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                salario = excluded.salario,
                meta = excluded.meta,
                valor_meta = excluded.valor_meta`,
            [userId, nome || "", salario || 0, meta || "", valorMeta || 0]
        );
        res.json({ success: true, userId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Erro interno no servidor." });
    }
});

// =====================
// RECEITAS
// =====================
app.post("/receitas", async (req, res) => {
    const userId = req.uid;
    const { descricao, valor } = req.body;

    if (!descricao || valor == null) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await dbRun(
            `INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)`,
            [userId, descricao, valor]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get("/receitas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM receitas WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

app.delete("/receitas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM receitas WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar receita." });
    }
});

app.put("/receitas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { descricao, valor } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }

    try {
        const result = await dbRun(
            "UPDATE receitas SET descricao = ?, valor = ? WHERE id = ? AND user_id = ?",
            [descricao, valor, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar receita." });
    }
});

// =====================
// GASTOS
// =====================
app.post("/gastos", async (req, res) => {
    const userId = req.uid;
    const { descricao, valor, categoria } = req.body;

    if (!descricao || valor == null) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await dbRun(
            `INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, ?, ?)`,
            [userId, descricao, valor, categoria || "Geral"]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get("/gastos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM gastos WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

app.delete("/gastos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM gastos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar gasto." });
    }
});

app.put("/gastos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { descricao, valor, categoria } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }

    try {
        const result = await dbRun(
            "UPDATE gastos SET descricao = ?, valor = ?, categoria = ? WHERE id = ? AND user_id = ?",
            [descricao, valor, categoria, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar gasto." });
    }
});

// =====================
// METAS
// =====================
app.post("/metas", async (req, res) => {
    const userId = req.uid;
    const { nome, valorObjetivo, prazo } = req.body;

    if (!nome) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    try {
        await garantirUsuarioExiste(userId);
        await dbRun(
            `INSERT INTO metas (user_id, nome, valor_objetivo, prazo) VALUES (?, ?, ?, ?)`,
            [userId, nome, valorObjetivo || 0, prazo || 12]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get("/metas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM metas WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

app.delete("/metas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM metas WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar meta." });
    }
});

app.put("/metas/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nome, valorObjetivo, valorAtual, prazo } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }

    try {
        const result = await dbRun(
            "UPDATE metas SET nome = ?, valor_objetivo = ?, valor_atual = ?, prazo = ? WHERE id = ? AND user_id = ?",
            [nome, valorObjetivo, valorAtual, prazo, id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar meta." });
    }
});
// Estima quanto a pessoa consegue guardar por mês, com base no histórico
// (receitas - gastos, dividido pela quantidade de meses com movimentação registrada).
// É uma aproximação: usa a data de cadastro (created_at) de cada lançamento.
app.get("/metas/estimativa/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const receitasPorMes = await dbAll(
            `SELECT strftime('%Y-%m', created_at) AS mes, SUM(valor) AS total FROM receitas WHERE user_id = ? GROUP BY mes`,
            [req.uid]
        );
        const gastosPorMes = await dbAll(
            `SELECT strftime('%Y-%m', created_at) AS mes, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY mes`,
            [req.uid]
        );

        const mesesSet = new Set([
            ...receitasPorMes.map(r => r.mes),
            ...gastosPorMes.map(g => g.mes)
        ]);
        const numMeses = mesesSet.size || 1;

        const totalReceitas = receitasPorMes.reduce((s, r) => s + (r.total || 0), 0);
        const totalGastos = gastosPorMes.reduce((s, g) => s + (g.total || 0), 0);

        const mediaMensal = (totalReceitas - totalGastos) / numMeses;

        res.json({ mediaMensal, baseMeses: numMeses });
    } catch (err) {
        console.error("Erro ao calcular estimativa:", err);
        res.status(500).json({ mediaMensal: 0, baseMeses: 0 });
    }
});
// =====================
// AGENDAMENTOS (Calendário de gastos/receitas/metas futuras)
// =====================
app.post("/agendamentos", async (req, res) => {
    const userId = req.uid;
    const { tipo, descricao, valor, categoria, prazo, dataAgendada } = req.body;

    if (!tipo || !descricao || valor == null || !dataAgendada) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }
    if (!["gasto", "receita", "meta"].includes(tipo)) {
        return res.status(400).json({ success: false, error: "Tipo inválido." });
    }

    try {
        await garantirUsuarioExiste(userId);
        const result = await dbRun(
            `INSERT INTO agendamentos (user_id, tipo, descricao, valor, categoria, prazo, data_agendada)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, tipo, descricao, valor, categoria || null, prazo || null, dataAgendada]
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        console.error("Erro ao criar agendamento:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/agendamentos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        // Antes de listar, lança automaticamente tudo que já venceu
        await processarAgendamentosPendentes(req.uid);

        const rows = await dbAll(
            "SELECT * FROM agendamentos WHERE user_id = ? ORDER BY data_agendada ASC",
            [req.uid]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// Endpoint leve só pra processar (usado no dashboard, sem precisar da lista inteira)
app.get("/agendamentos/processar/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const lancados = await processarAgendamentosPendentes(req.uid);
        res.json({ lancados });
    } catch (err) {
        console.error(err);
        res.status(500).json({ lancados: [] });
    }
});

app.delete("/agendamentos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun("DELETE FROM agendamentos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Registro não encontrado." });
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao deletar agendamento." });
    }
});

// =====================
// INVESTIMENTOS
// =====================
app.post("/investimentos", async (req, res) => {
    const userId = req.uid;
    const { ticker, tipo, quantidade, precoMedio, dataCompra } = req.body;

    if (!ticker || !quantidade || !precoMedio) {
        return res.status(400).json({ success: false, error: "Dados incompletos." });
    }

    const tickerFinal = ticker.toUpperCase().trim();
    const qtdNova = parseFloat(quantidade);
    const precoNovo = parseFloat(precoMedio);
    const dataFinal = dataCompra || new Date().toISOString().split("T")[0];

    try {
        await garantirUsuarioExiste(userId);

        // Registra o aporte individual (histórico bruto, nunca é sobrescrito)
        await dbRun(
            `INSERT INTO aportes (user_id, ticker, tipo, quantidade, preco_unitario, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, tickerFinal, tipo, qtdNova, precoNovo, dataFinal]
        );

        // Já existe esse ticker na posição consolidada do usuário?
        const existente = await dbGet(
            "SELECT * FROM investimentos WHERE user_id = ? AND ticker = ? LIMIT 1",
            [userId, tickerFinal]
        );

        if (existente) {
            // Soma a quantidade e recalcula o preço médio ponderado
            const qtdAtual = parseFloat(existente.quantidade) || 0;
            const pmAtual = parseFloat(existente.preco_medio) || 0;

            const qtdTotal = qtdAtual + qtdNova;
            const custoTotal = (qtdAtual * pmAtual) + (qtdNova * precoNovo);
            const novoPrecoMedio = qtdTotal > 0 ? custoTotal / qtdTotal : precoNovo;

            // data_compra NÃO é sobrescrita: mantém a data do primeiro aporte
            await dbRun(
                `UPDATE investimentos SET quantidade = ?, preco_medio = ?, tipo = ? WHERE id = ?`,
                [qtdTotal, novoPrecoMedio, tipo || existente.tipo, existente.id]
            );

            return res.json({
                success: true,
                id: existente.id,
                atualizado: true,
                quantidade: qtdTotal,
                precoMedio: novoPrecoMedio
            });
        }

        // Ativo novo -> insere normalmente
        const result = await dbRun(
            `INSERT INTO investimentos (user_id, ticker, tipo, quantidade, preco_medio, data_compra)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, tickerFinal, tipo, qtdNova, precoNovo, dataFinal]
        );
        res.json({ success: true, id: result.lastID, atualizado: false });
    } catch (err) {
        console.error("Erro ao cadastrar investimento:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/investimentos/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll("SELECT * FROM investimentos WHERE user_id = ? ORDER BY id DESC", [req.uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

app.delete("/investimentos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "ID ausente." });
    }

    try {
        const result = await dbRun("DELETE FROM investimentos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: "Ativo não encontrado ou não pertence a este usuário." });
        }
        res.json({ success: true, message: "Ativo excluído com sucesso." });
    } catch (err) {
        console.error("Erro SQL ao excluir investimento:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Cotação individual
app.get("/api/cotacao/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const tipo = req.query.tipo || "Ação";
    const price = await obterPrecoAtivo(ticker, tipo);

    if (price !== null) {
        return res.json({ price });
    } else {
        return res.status(404).json({ error: "Preço não encontrado" });
    }
});

// Carteira detalhada com cotações (também salva o snapshot diário)
app.get("/api/investimentos/cotacoes/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    const userId = req.uid;

    try {
        priceCache.clear();

        const ativos = await dbAll("SELECT * FROM investimentos WHERE user_id = ?", [userId]);

        if (!ativos || ativos.length === 0) {
            return res.json({
                totalInvestido: 0,
                valorAtual: 0,
                rendimento: 0,
                crescimentoPercentual: "0.00",
                proximosProventos: "0.00",
                detalhes: []
            });
        }

        let totalInvestido = 0;
        let valorAtualTotal = 0;

        const detalhes = await Promise.all(
            ativos.map(async (ativo) => {
                const qtd = parseFloat(ativo.quantidade) || 0;
                const pm = parseFloat(ativo.preco_medio) || 0;
                const investidoAtivo = qtd * pm;

                const cotado = await obterPrecoAtivo(ativo.ticker, ativo.tipo);
                const precoAtual = (cotado && cotado > 0) ? cotado : pm;
                const valorAtualAtivo = qtd * precoAtual;

                totalInvestido += investidoAtivo;
                valorAtualTotal += valorAtualAtivo;

                return {
                    id: ativo.id,
                    ticker: ativo.ticker,
                    tipo: ativo.tipo,
                    quantidade: qtd,
                    precoMedio: pm,
                    precoAtual: precoAtual,
                    valorTotalAtual: valorAtualAtivo,
                    lucroOuPrejuizo: valorAtualAtivo - investidoAtivo,
                    dataCompra: ativo.data_compra || null
                };
            })
        );

        const rendimentoTotal = valorAtualTotal - totalInvestido;
        const crescimentoPercentual = totalInvestido > 0 ? (rendimentoTotal / totalInvestido) * 100 : 0;

        // Salva o snapshot de hoje (idempotente: roda de novo hoje, só atualiza)
        const hoje = new Date().toISOString().split("T")[0];
        await dbRun(
            `INSERT INTO historico_patrimonio (user_id, data, valor_investido, valor_atual, rendimento)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, data) DO UPDATE SET
                valor_investido = excluded.valor_investido,
                valor_atual = excluded.valor_atual,
                rendimento = excluded.rendimento`,
            [userId, hoje, totalInvestido, valorAtualTotal, rendimentoTotal]
        );

        for (const item of detalhes) {
            await dbRun(
                `INSERT INTO historico_ativos (user_id, ticker, data, valor_investido, valor_atual, rendimento)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, ticker, data) DO UPDATE SET
                    valor_investido = excluded.valor_investido,
                    valor_atual = excluded.valor_atual,
                    rendimento = excluded.rendimento`,
                [userId, item.ticker, hoje, item.quantidade * item.precoMedio, item.valorTotalAtual, item.lucroOuPrejuizo]
            );
        }

        res.json({
            totalInvestido,
            valorAtual: valorAtualTotal,
            rendimento: rendimentoTotal,
            crescimentoPercentual: crescimentoPercentual.toFixed(2),
            proximosProventos: (valorAtualTotal * 0.007).toFixed(2),
            detalhes
        });
    } catch (err) {
        console.error("Erro na rota de cotações:", err);
        res.status(500).json({ error: "Erro ao processar cotações." });
    }
});

// Evolução do patrimônio total (gráfico do Dashboard e da tela de Investimentos)
app.get("/api/investimentos/historico/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            "SELECT data, valor_investido, valor_atual, rendimento FROM historico_patrimonio WHERE user_id = ? ORDER BY data ASC",
            [req.uid]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        res.status(500).json([]);
    }
});

// Evolução do rendimento de um ativo específico
app.get("/api/investimentos/historico-ativo/:userId/:ticker", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            "SELECT data, valor_investido, valor_atual, rendimento FROM historico_ativos WHERE user_id = ? AND ticker = ? ORDER BY data ASC",
            [req.uid, req.params.ticker.toUpperCase()]
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar histórico do ativo:", err);
        res.status(500).json([]);
    }
});

// =====================
// DASHBOARD & ESTATÍSTICAS
// =====================
app.get("/dashboard/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const row = await dbGet(
            `SELECT
                (SELECT IFNULL(SUM(valor),0) FROM receitas WHERE user_id = ?) AS receitas,
                (SELECT IFNULL(SUM(valor),0) FROM gastos WHERE user_id = ?) AS gastos`,
            [req.uid, req.uid]
        );

        const receitas = row ? row.receitas : 0;
        const gastos = row ? row.gastos : 0;

        res.json({
            receitas,
            gastos,
            saldo: receitas - gastos
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ receitas: 0, gastos: 0, saldo: 0 });
    }
});

app.get("/estatisticas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    try {
        const rows = await dbAll(
            `SELECT categoria, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY categoria`,
            [req.uid]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// =====================
// CHAT IA (Ollama + Contexto)
// =====================
app.post("/chat", async (req, res) => {
    const userId = req.uid;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Mensagem vazia" });
    }

    try {
        const [financeRow, categoriasRows, ativosRows] = await Promise.all([
            dbGet(
                `SELECT 
                    (SELECT IFNULL(SUM(valor), 0) FROM receitas WHERE user_id = ?) AS total_receitas,
                    (SELECT IFNULL(SUM(valor), 0) FROM gastos WHERE user_id = ?) AS total_gastos`,
                [userId, userId]
            ),
            dbAll(`SELECT categoria, SUM(valor) AS total FROM gastos WHERE user_id = ? GROUP BY categoria`, [userId]),
            dbAll(`SELECT ticker, tipo, quantidade, preco_medio FROM investimentos WHERE user_id = ?`, [userId])
        ]);

        const receitas = financeRow ? financeRow.total_receitas : 0;
        const gastos = financeRow ? financeRow.total_gastos : 0;
        const saldo = receitas - gastos;

        const resumoCategorias = categoriasRows.length > 0
            ? categoriasRows.map(c => `- ${c.categoria}: R$ ${c.total.toFixed(2)}`).join("\n")
            : "Nenhum gasto cadastrado ainda.";

        let valorTotalInvestido = 0;
        const resumoInvestimentos = ativosRows.length > 0
            ? ativosRows.map(a => {
                const subtotal = a.quantidade * a.preco_medio;
                valorTotalInvestido += subtotal;
                return `- ${a.ticker} (${a.tipo}): ${a.quantidade} cota(s) a R$ ${a.preco_medio.toFixed(2)} (Total: R$ ${subtotal.toFixed(2)})`;
            }).join("\n")
            : "Nenhum ativo investido na carteira no momento.";

        const systemPrompt = `Você é a LumuzIA, uma assistente virtual de IA especializada em finanças pessoais e investimentos.
Seu tom de voz deve ser amigável, acolhedor e focado em educação financeira.

Aqui estão os dados financeiros ATUAIS e REAIS do usuário:
- Saldo em Conta: R$ ${saldo.toFixed(2)}
- Total de Receitas: R$ ${receitas.toFixed(2)}
- Total de Gastos: R$ ${gastos.toFixed(2)}
- Total Aplicado em Investimentos: R$ ${valorTotalInvestido.toFixed(2)}

Gastos por Categoria:
${resumoCategorias}

Carteira de Investimentos (B3, FIIs e Criptos):
${resumoInvestimentos}

Use estritamente esses dados se o usuário perguntar sobre o saldo, investimentos ou situação financeira dele. Dê conselhos práticos e personalizados.`;

        const response = await axios.post("http://localhost:11434/api/generate", {
            model: "llama3",
            prompt: `${systemPrompt}\n\nUsuário: ${message}\nLumuzIA:`,
            stream: false
        }, { timeout: 30000 });

        res.json({ reply: response.data.response });

    } catch (error) {
        console.error("Erro no chat:", error.message);
        res.status(500).json({ error: "Erro ao comunicar com Ollama ou ao buscar os dados do usuário." });
    }
});

// =====================
// SERVIDOR
// =====================
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});