require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const db = require("./database");
const { verificarAutenticacao } = require("./firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares

// CORS restrito: só aceita requisições vindas dos domínios listados em
// CORS_ORIGINS (separados por vírgula). Ex: CORS_ORIGINS=https://lumuzia.com,https://www.lumuzia.com
// Se a variável não estiver definida, cai em modo permissivo (dev local) e avisa no log.
const origensPermitidas = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

if (origensPermitidas.length === 0) {
    console.warn(
        "[CORS AVISO] CORS_ORIGINS não definida — liberando qualquer origem. " +
        "Defina CORS_ORIGINS em produção (ex: https://seudominio.com)."
    );
}

app.use(cors({
    origin: (origin, callback) => {
        // Requisições sem "origin" (ex: curl, apps mobile, mesmo domínio) são permitidas.
        if (!origin) return callback(null, true);

        // Modo dev: sem whitelist configurada, libera tudo.
        if (origensPermitidas.length === 0) return callback(null, true);

        if (origensPermitidas.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true
}));

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

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

// Agente HTTPS padrão — valida certificados normalmente (rejectUnauthorized: true,
// que é o default). NUNCA desative essa validação globalmente: isso abre brecha
// para ataques man-in-the-middle em todas as chamadas externas (cotações e IA),
// incluindo o endpoint de IA que recebe saldo/receitas/gastos do usuário.
//
// Se algum provedor específico tiver certificado inválido/self-signed, trate
// esse caso isoladamente com um agente próprio só para ele — nunca globalmente.
const httpsAgent = new https.Agent({
    rejectUnauthorized: true
});

// Mapeamento de nomes/apelidos de cripto para o ID usado na CoinGecko
const MAPA_CRIPTO = {
    "BITCOIN": "bitcoin", "BTC": "bitcoin",
    "ETHEREUM": "ethereum", "ETH": "ethereum",
    "SOLANA": "solana", "SOL": "solana",
    "CARDANO": "cardano", "ADA": "cardano",
    "RIPPLE": "ripple", "XRP": "ripple",
    "DOGECOIN": "dogecoin", "DOGE": "dogecoin",
    "POLKADOT": "polkadot", "DOT": "polkadot",
    "TETHER": "tether", "USDT": "tether"
};

const BRAPI_TOKEN = process.env.BRAPI_TOKEN || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";

// Busca em UMA ÚNICA chamada o preço de todas as criptomoedas da carteira,
// e já deixa cada uma pronta no cache. Isso evita que a CoinGecko bloqueie
// por excesso de chamadas simultâneas quando há mais de uma cripto — o que
// acontecia antes (ex: Bitcoin falhando, Ethereum passando, de forma aleatória).
async function prefetchPrecosCripto(ativos) {
    const cryptoAtivos = ativos.filter((a) => {
        const tipoUpper = (a.tipo || "").toUpperCase().trim();
        const tickerUpper = (a.ticker || "").toUpperCase().trim();
        return tipoUpper.includes("CRIPTO") || Boolean(MAPA_CRIPTO[tickerUpper]);
    });

    if (cryptoAtivos.length === 0) return;

    const idsUnicos = [...new Set(
        cryptoAtivos.map((a) => {
            const tickerUpper = a.ticker.toUpperCase().trim();
            return MAPA_CRIPTO[tickerUpper] || tickerUpper.toLowerCase();
        })
    )];

    try {
        const resposta = await axios.get(
            "https://api.coingecko.com/api/v3/simple/price",
            {
                params: { ids: idsUnicos.join(","), vs_currencies: "brl" },
                headers: COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {},
                httpsAgent,
                timeout: 8000
            }
        );

        for (const ativo of cryptoAtivos) {
            const tickerUpper = ativo.ticker.toUpperCase().trim();
            const idCoinGecko = MAPA_CRIPTO[tickerUpper] || tickerUpper.toLowerCase();
            const precoBrl = resposta?.data?.[idCoinGecko]?.brl;

            if (precoBrl) {
                priceCache.set(`${tickerUpper}_CRIPTO`, {
                    price: parseFloat(precoBrl),
                    timestamp: Date.now()
                });
            }
        }
    } catch (err) {
        console.warn("[COTAÇÃO AVISO] Falha ao pré-buscar preços de cripto em lote:", err.message);
    }
}

async function obterPrecoAtivo(ticker, tipo) {
    if (!ticker) return null;

    const tickerUpper = ticker.toUpperCase().trim();
    const tipoUpper = (tipo || "").toUpperCase().trim();
    const ehCripto = tipoUpper.includes("CRIPTO") || Boolean(MAPA_CRIPTO[tickerUpper]);
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

        if (ehCripto) {
            // CoinGecko: usa a chave Demo gratuita quando configurada, pra evitar
            // o limite de 5-15 chamadas/min do endpoint totalmente público.
            const idCoinGecko = MAPA_CRIPTO[tickerUpper] || tickerUpper.toLowerCase();

            const resposta = await axios.get(
                "https://api.coingecko.com/api/v3/simple/price",
                {
                    params: { ids: idCoinGecko, vs_currencies: "brl" },
                    headers: COINGECKO_API_KEY ? { "x-cg-demo-api-key": COINGECKO_API_KEY } : {},
                    httpsAgent,
                    timeout: 5000
                }
            ).catch(() => null);

            const precoBrl = resposta?.data?.[idCoinGecko]?.brl;
            if (precoBrl) {
                price = parseFloat(precoBrl);
            }
        } else {
            // brapi.dev (API v2): feito especificamente para ações e FIIs da B3.
            // PETR4, VALE3, MGLU3 e ITUB4 funcionam sem token; qualquer
            // outro ticker exige o token gratuito em BRAPI_TOKEN.
            const url = "https://brapi.dev/api/v2/stocks/quote";
            const resposta = await axios.get(url, {
                params: {
                    symbols: tickerUpper,
                    ...(BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {})
                },
                httpsAgent,
                timeout: 5000
            }).catch((err) => {
                if (err?.response?.status === 401 && !BRAPI_TOKEN) {
                    console.warn(`[COTAÇÃO AVISO] ${tickerUpper} exige token da brapi.dev. Configure BRAPI_TOKEN no ambiente.`);
                }
                return null;
            });

            const precoAtual = resposta?.data?.results?.[0]?.data?.regularMarketPrice;
            if (precoAtual) {
                price = parseFloat(precoAtual);
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
app.get("/favicon.ico", (req, res) => res.status(204).end());
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
// ESTATÍSTICAS (gastos agrupados por categoria — alimenta o gráfico de pizza do Dashboard)
// =====================
app.get("/estatisticas/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const { mes, ano, mesInicio, mesFim } = req.query;

    let filtro = "";
    let params = [req.uid];

    if (ano) {
        filtro = `AND strftime('%Y', created_at) = ?`;
        params = [req.uid, String(ano)];
    } else if (mesInicio && mesFim) {
        filtro = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        params = [req.uid, mesInicio, mesFim];
    } else {
        filtro = `AND strftime('%Y-%m', created_at) = ?`;
        params = [req.uid, mes || mesAtual];
    }

    try {
        const rows = await dbAll(
            `SELECT categoria, SUM(valor) AS total
             FROM gastos
             WHERE user_id = ? ${filtro}
             GROUP BY categoria
             ORDER BY total DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar estatísticas de gastos:", err.message);
        res.status(500).json([]);
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
// AGENDAMENTOS
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

app.patch("/agendamentos/:id/pago", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const ag = await dbGet("SELECT * FROM agendamentos WHERE id = ? AND user_id = ?", [id, req.uid]);
        if (!ag) return res.status(404).json({ success: false, error: "Agendamento não encontrado." });
        if (ag.status === "lancado") {
            return res.json({ success: true, jaEstavaLancado: true });
        }

        if (ag.tipo === "gasto") {
            await dbRun(
                `INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, ?, ?, ?)`,
                [req.uid, ag.descricao, ag.valor, ag.categoria || "Geral"]
            );
        } else if (ag.tipo === "receita") {
            await dbRun(
                `INSERT INTO receitas (user_id, descricao, valor) VALUES (?, ?, ?)`,
                [req.uid, ag.descricao, ag.valor]
            );
        } else if (ag.tipo === "meta") {
            await dbRun(
                `INSERT INTO metas (user_id, nome, valor_objetivo, prazo) VALUES (?, ?, ?, ?)`,
                [req.uid, ag.descricao, ag.valor, ag.prazo || 12]
            );
        }

        await dbRun("UPDATE agendamentos SET status = 'lancado' WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao marcar agendamento como pago:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.patch("/agendamentos/:id/pendente", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos." });
    }
    try {
        const result = await dbRun(
            "UPDATE agendamentos SET status = 'pendente' WHERE id = ? AND user_id = ?",
            [id, req.uid]
        );
        if (result.changes === 0) return res.status(404).json({ success: false, error: "Agendamento não encontrado." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao atualizar status." });
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

        await dbRun(
            `INSERT INTO aportes (user_id, ticker, tipo, quantidade, preco_unitario, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, tickerFinal, tipo, qtdNova, precoNovo, dataFinal]
        );

        const existente = await dbGet(
            "SELECT * FROM investimentos WHERE user_id = ? AND ticker = ? LIMIT 1",
            [userId, tickerFinal]
        );

        if (existente) {
            const qtdAtual = parseFloat(existente.quantidade) || 0;
            const pmAtual = parseFloat(existente.preco_medio) || 0;

            const qtdTotal = qtdAtual + qtdNova;
            const custoTotal = (qtdAtual * pmAtual) + (qtdNova * precoNovo);
            const novoPrecoMedio = qtdTotal > 0 ? custoTotal / qtdTotal : precoNovo;

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

app.get("/api/investimentos/cotacoes/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    const userId = req.uid;

    try {
        // Não zera o cache aqui: o TTL de 10 minutos (CACHE_TTL) já cuida de
        // expirar preços antigos. Limpar tudo a cada reload forçava chamadas
        // novas à brapi/CoinGecko com muita frequência, esbarrando nos limites
        // de requisições dessas APIs gratuitas.

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

        // Busca todas as criptos da carteira numa única chamada, evitando
        // que a CoinGecko bloqueie por chamadas simultâneas.
        await prefetchPrecosCripto(ativos);

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
// IA / OLLAMA
// =====================
app.post("/api/ia/chat", async (req, res) => {
    const userId = req.uid;
    const { prompt, modelo } = req.body;

    if (!prompt) {
        return res.status(400).json({ success: false, error: "O campo 'prompt' é obrigatório." });
    }

    try {
        const resumo = await dbGet(
            `SELECT 
                (SELECT IFNULL(SUM(valor),0) FROM receitas WHERE user_id = ?) AS receitas,
                (SELECT IFNULL(SUM(valor),0) FROM gastos WHERE user_id = ?) AS gastos`,
            [userId, userId]
        );

        const totalReceitas = resumo?.receitas || 0;
        const totalGastos = resumo?.gastos || 0;
        const saldoAtual = totalReceitas - totalGastos;

        const systemPrompt = `Você é a LumuzIA, assistente virtual de finanças pessoais do app LumuzIA.
Responda sempre em português brasileiro de forma amigável, clara e direta.

Dados financeiros atuais do usuário:
- Receitas: R$ ${totalReceitas.toFixed(2)}
- Gastos: R$ ${totalGastos.toFixed(2)}
- Saldo Disponível: R$ ${saldoAtual.toFixed(2)}`;

        const baseUrl = (process.env.OLLAMA_URL || "https://ra.projetoscti.com.br/2557068").replace(/\/$/, "");
        
        // Chamada enviando action = 'generate' exigida pelo PHP
        const response = await axios.post(
            `${baseUrl}/index.php`,
            {
                action: "generate",
                model: modelo || "qwen2.5:3b",
                prompt: prompt,
                system: systemPrompt,
                stream: false
            },
            {
                headers: { "Content-Type": "application/json" },
                httpsAgent,
                timeout: 120000 // Aumentado para 120s para acompanhar o tempo de resposta do PHP/Ollama
            }
        );

        // O PHP retorna a resposta dentro do campo 'resposta'
        if (response.data?.success) {
            return res.json({ success: true, resposta: response.data.resposta });
        }

        // Se o PHP retornar erro (ex: Ollama offline)
        return res.status(500).json({ 
            success: false, 
            error: response.data?.error || "Erro ao obter resposta da IA." 
        });

    } catch (err) {
        console.error("Erro na integração com Ollama/IA:", err.message);
        return res.status(500).json({ 
            success: false, 
            error: "Falha ao processar a requisição com a IA." 
        });
    }
});
// =====================
// DASHBOARD & ESTATÍSTICAS
// =====================
app.get("/dashboard/:userId", async (req, res) => {
    if (req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }

    const userId = req.uid;

    // Parâmetros de período. Modos:
    //   ?mes=2026-09             → mês específico
    //   ?ano=2026                → ano inteiro
    //   ?mesInicio=2026-07&mesFim=2026-09 → período (conjunto de meses)
    // Sem parâmetros → mês atual do servidor
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const { mes, ano, mesInicio, mesFim } = req.query;

    let filtroReceitas = "";
    let filtroGastos  = "";
    let params = [userId];

    if (ano) {
        // Ano inteiro
        filtroReceitas = `AND strftime('%Y', created_at) = ?`;
        filtroGastos   = `AND strftime('%Y', created_at) = ?`;
        params = [userId, String(ano)];
    } else if (mesInicio && mesFim) {
        // Período (conjunto de meses)
        filtroReceitas = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        filtroGastos   = `AND strftime('%Y-%m', created_at) >= ? AND strftime('%Y-%m', created_at) <= ?`;
        params = [userId, mesInicio, mesFim];
    } else {
        // Mês específico ou mês atual
        const mesFiltro = mes || mesAtual;
        filtroReceitas = `AND strftime('%Y-%m', created_at) = ?`;
        filtroGastos   = `AND strftime('%Y-%m', created_at) = ?`;
        params = [userId, mesFiltro];
    }

    try {
        const user = await dbGet("SELECT * FROM users WHERE id = ?", [userId]);

        const totalReceitasRow = await dbGet(
            `SELECT IFNULL(SUM(valor), 0) AS total FROM receitas WHERE user_id = ? ${filtroReceitas}`,
            params
        );
        const totalGastosRow = await dbGet(
            `SELECT IFNULL(SUM(valor), 0) AS total FROM gastos WHERE user_id = ? ${filtroGastos}`,
            params
        );

        const totalReceitas = totalReceitasRow?.total || 0;
        const totalGastos   = totalGastosRow?.total  || 0;
        const saldo = totalReceitas - totalGastos;

        res.json({
            user: user || { id: userId, nome: "", salario: 0, meta: "", valor_meta: 0 },
            receitas: totalReceitas,
            gastos: totalGastos,
            saldo
        });
    } catch (err) {
        console.error("Erro ao carregar dashboard:", err.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});
// =====================
// INICIALIZAÇÃO
// =====================
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});