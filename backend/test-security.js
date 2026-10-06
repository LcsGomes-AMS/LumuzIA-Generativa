/**
 * LumuzIA - Suíte de Testes Automatizados de Segurança (AppSec / DAST + SAST leve) - v2
 *
 * Uso:
 *   node seguranca.test.js                 -> roda tudo
 *   node seguranca.test.js --json          -> também grava security-report.json
 *   node seguranca.test.js --audit         -> inclui `npm audit` (precisa de rede)
 *   node seguranca.test.js --only=idor,sqli -> roda só alguns blocos
 *
 * Blocos: cabecalhos, acesso, tokens, idor, sqli, entrada, exposicao, estatica, ratelimit
 *
 * Severidades: critica | alta | media | baixa
 *   - "baixa" gera AVISO e não derruba o exit code.
 *   - qualquer falha critica/alta/media => exit code 1 (bom para CI).
 *
 * Cobertura (OWASP Top 10):
 *  A01 Broken Access Control / IDOR (leitura, escrita, exclusão, mass assignment, path tricks)
 *  A02 Falhas criptográficas (JWT alg=none, segredos fracos, HSTS)
 *  A03 Injeção (SQLi em query/path/body, XSS armazenado, prototype pollution)
 *  A04/A05 Má configuração (headers, CORS, métodos HTTP, arquivos sensíveis, stack trace)
 *  A06 Componentes vulneráveis (npm audit opcional)
 *  A07 Falhas de autenticação (token vazio, esquema errado, token em query string)
 *  A09/A10 Vazamento de erros e DoS (payload gigante, JSON profundo, header gigante, rate limit)
 */

process.env.NODE_ENV = "test";

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { execSync } = require("child_process");
const app = require("./server");
const { dbRun, dbGet, dbAll } = require("./database");

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
const ARGS = process.argv.slice(2);
const MODO_JSON = ARGS.includes("--json");
const MODO_AUDIT = ARGS.includes("--audit");
const SO = ((ARGS.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "")
    .split(",")
    .filter(Boolean);

const LIMITE_PAYLOAD_BYTES = 200 * 1024; // limite configurado no backend
const MAX_REQ_ATE_BLOQUEAR = 30; // rate limit deve disparar até esta requisição

const RUN = crypto.randomBytes(4).toString("hex");
const PREFIXO = "sec_test_";
const UID_VITIMA = `${PREFIXO}vitima_${RUN}`;
const UID_ATACANTE = `${PREFIXO}atacante_${RUN}`;

const CORES = {
    reset: "\x1b[0m",
    verde: "\x1b[32m",
    vermelho: "\x1b[31m",
    amarelo: "\x1b[33m",
    azul: "\x1b[36m",
    cinza: "\x1b[90m",
    negrito: "\x1b[1m"
};

let serverInstance;
let baseUrl = "";
let categoriaAtual = "";
const resultados = [];

// ---------------------------------------------------------------------------
// Infra de testes
// ---------------------------------------------------------------------------
function deveRodar(bloco) {
    return SO.length === 0 || SO.includes(bloco);
}

function cabecalhoBloco(titulo) {
    console.log(`\n${CORES.negrito}${titulo}${CORES.reset}`);
}

/**
 * Registra um teste. `fn` retorna boolean ou { ok, detalhe }.
 * Exceções viram FAIL (nunca derrubam a suíte).
 */
async function teste(titulo, severidade, fn) {
    let ok = false;
    let detalhe = "";
    try {
        const r = await fn();
        if (typeof r === "boolean") ok = r;
        else {
            ok = Boolean(r && r.ok);
            detalhe = (r && r.detalhe) || "";
        }
    } catch (err) {
        ok = false;
        detalhe = `exceção: ${err.message}`;
    }

    resultados.push({ categoria: categoriaAtual, titulo, severidade, ok, detalhe });

    if (ok) {
        console.log(`  ${CORES.verde}✔ [PASS]${CORES.reset} ${titulo}`);
    } else if (severidade === "baixa") {
        console.log(`  ${CORES.amarelo}⚠ [WARN]${CORES.reset} ${titulo} ${CORES.cinza}${detalhe ? `(${detalhe})` : ""}${CORES.reset}`);
    } else {
        console.log(`  ${CORES.vermelho}✖ [FAIL:${severidade}]${CORES.reset} ${titulo} ${detalhe ? `(${detalhe})` : ""}`);
    }
}

async function requisicao(rota, options = {}) {
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body !== undefined && body !== null && typeof body === "object") {
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}${rota}`, {
        method: options.method || "GET",
        headers,
        body,
        signal: AbortSignal.timeout(options.timeout || 10000)
    });

    let texto = "";
    try {
        texto = await res.text();
    } catch {
        texto = "";
    }
    let data = null;
    try {
        data = JSON.parse(texto);
    } catch {
        data = null;
    }

    return { status: res.status, headers: res.headers, data, texto };
}

/** Requisição crua (permite métodos/headers que o fetch bloqueia, ex.: TRACE). */
function requisicaoRaw({ method = "GET", path: p = "/", headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(baseUrl);
        const req = http.request(
            { host: u.hostname, port: u.port, method, path: p, headers, timeout: 10000 },
            (res) => {
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () =>
                    resolve({ status: res.statusCode, headers: res.headers, texto: Buffer.concat(chunks).toString("utf8") })
                );
            }
        );
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

const como = (uid) => ({ "x-test-uid": uid });
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function jwtHS256(payload, segredo) {
    const h = b64url({ alg: "HS256", typ: "JWT" });
    const p = b64url(payload);
    const sig = crypto.createHmac("sha256", segredo).update(`${h}.${p}`).digest("base64url");
    return `${h}.${p}.${sig}`;
}

const REGEX_VAZAMENTO_ERRO =
    /node_modules|\bat\s+[\w.<>$]+\s+\(|SQLITE_|SqliteError|SequelizeDatabaseError|ER_PARSE_ERROR|syntax error at or near|ENOENT|[A-Z]:\\\\|\/home\/|\/usr\/|\/app\/|\/var\/www/i;
const vazouErroInterno = (res) => REGEX_VAZAMENTO_ERRO.test(res.texto || "");
const vazouDadosDaVitima = (res) => /Confidencial|Vitima Teste/i.test(res.texto || "");

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------
const TABELAS_COM_USER_ID = ["receitas", "gastos", "metas", "agendamentos", "chat_conversas"];

async function limparDadosDeTeste() {
    for (const tabela of TABELAS_COM_USER_ID) {
        try {
            await dbRun(`DELETE FROM ${tabela} WHERE user_id LIKE ?`, [`${PREFIXO}%`]);
        } catch (err) {
            console.warn(`${CORES.amarelo}Aviso ao limpar ${tabela}:${CORES.reset} ${err.message}`);
        }
    }
    try {
        await dbRun("DELETE FROM users WHERE id LIKE ?", [`${PREFIXO}%`]);
    } catch (err) {
        console.warn(`${CORES.amarelo}Aviso ao limpar users:${CORES.reset} ${err.message}`);
    }
}

async function prepararDados() {
    await dbRun("INSERT INTO users (id, nome, salario) VALUES (?, 'Vitima Teste', 10000)", [UID_VITIMA]);
    await dbRun("INSERT INTO receitas (user_id, descricao, valor) VALUES (?, 'Salario Confidencial Vitima', 10000)", [UID_VITIMA]);
    await dbRun(
        "INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, 'Gasto Confidencial Vitima', 500, 'Alimentação')",
        [UID_VITIMA]
    );
}

// ---------------------------------------------------------------------------
// BLOCOS
// ---------------------------------------------------------------------------
async function blocoCabecalhos() {
    categoriaAtual = "cabecalhos";
    cabecalhoBloco("[1] Cabeçalhos HTTP de proteção, CORS e cache (A05):");

    const res = await requisicao("/");
    const h = res.headers;

    await teste("X-Content-Type-Options: nosniff", "media", () => h.get("x-content-type-options") === "nosniff");
    await teste("X-DNS-Prefetch-Control: off", "baixa", () => h.get("x-dns-prefetch-control") === "off");
    await teste("X-Powered-By ocultado (sem fingerprint do Express)", "media", () => ({
        ok: h.get("x-powered-by") === null,
        detalhe: h.get("x-powered-by")
    }));
    await teste("Proteção contra clickjacking (X-Frame-Options ou CSP frame-ancestors)", "media", () => {
        const xfo = h.get("x-frame-options");
        const csp = h.get("content-security-policy") || "";
        return Boolean(xfo) || /frame-ancestors/i.test(csp);
    });
    await teste("Content-Security-Policy presente", "media", () => Boolean(h.get("content-security-policy")));
    await teste("Referrer-Policy presente", "baixa", () => Boolean(h.get("referrer-policy")));
    await teste("Strict-Transport-Security (HSTS) presente", "baixa", () => Boolean(h.get("strict-transport-security")));

    await teste("CORS: origem maliciosa não é refletida nem recebe '*' com credenciais", "alta", async () => {
        const r = await requisicao("/receitas/qualquer", { headers: { Origin: "https://evil.example" } });
        const allow = r.headers.get("access-control-allow-origin");
        const cred = r.headers.get("access-control-allow-credentials");
        const refletiu = allow === "https://evil.example";
        const curinga = allow === "*" && cred === "true";
        return { ok: !refletiu && !curinga, detalhe: `ACAO=${allow}, ACAC=${cred}` };
    });

    await teste("CORS preflight de origem maliciosa não autoriza métodos", "media", async () => {
        const r = await requisicaoRaw({
            method: "OPTIONS",
            path: "/receitas",
            headers: {
                Origin: "https://evil.example",
                "Access-Control-Request-Method": "DELETE"
            }
        });
        const allow = r.headers["access-control-allow-origin"];
        return { ok: allow !== "https://evil.example" && allow !== "*", detalhe: `ACAO=${allow}` };
    });

    await teste("Respostas autenticadas não são cacheáveis publicamente", "media", async () => {
        const r = await requisicao(`/receitas/${UID_ATACANTE}`, { headers: como(UID_ATACANTE) });
        const cc = (r.headers.get("cache-control") || "").toLowerCase();
        return { ok: !/\bpublic\b/.test(cc), detalhe: `Cache-Control=${cc || "(vazio)"}` };
    });
}

async function blocoAcessoAnonimo() {
    categoriaAtual = "acesso";
    cabecalhoBloco("[2] Broken Access Control - requisições anônimas (A01):");

    const rotas = [
        { path: `/receitas/${UID_VITIMA}`, method: "GET" },
        { path: `/gastos/${UID_VITIMA}`, method: "GET" },
        { path: `/metas/${UID_VITIMA}`, method: "GET" },
        { path: `/dashboard/${UID_VITIMA}`, method: "GET" },
        { path: `/api/investimentos/cotacoes/${UID_VITIMA}`, method: "GET" },
        { path: `/api/chat/conversas/${UID_VITIMA}`, method: "GET" },
        { path: "/receitas", method: "POST", body: { descricao: "Teste", valor: 10 } },
        { path: "/gastos", method: "POST", body: { descricao: "Teste", valor: 10, categoria: "Outros" } },
        { path: "/receitas/1", method: "DELETE" },
        { path: "/gastos/1", method: "DELETE" },
        { path: "/receitas/1", method: "PUT", body: { descricao: "x", valor: 1 } },
        { path: "/api/ia/chat", method: "POST", body: { prompt: "oi" } }
    ];

    for (const rota of rotas) {
        await teste(`${rota.method} ${rota.path} sem token => 401`, "critica", async () => {
            const r = await requisicao(rota.path, { method: rota.method, body: rota.body });
            return { ok: r.status === 401 && r.data?.success === false, detalhe: `Status ${r.status}` };
        });
    }
}

async function blocoTokens() {
    categoriaAtual = "tokens";
    cabecalhoBloco("[3] Autenticação e tokens forjados (A02/A07):");

    const alvo = `/receitas/${UID_VITIMA}`;
    const esperar401 = async (headers, rota = alvo) => {
        const r = await requisicao(rota, { headers });
        return { ok: r.status === 401 && !vazouDadosDaVitima(r), detalhe: `Status ${r.status}` };
    };

    await teste("JWT com assinatura falsa é rejeitado", "critica", () =>
        esperar401({ Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature" })
    );

    const payloadVitima = { sub: UID_VITIMA, uid: UID_VITIMA, user_id: UID_VITIMA, exp: 9999999999 };

    await teste("JWT com alg=none (sem assinatura) é rejeitado", "critica", () =>
        esperar401({ Authorization: `Bearer ${b64url({ alg: "none", typ: "JWT" })}.${b64url(payloadVitima)}.` })
    );

    await teste("JWT com alg=NoNe (variação de caixa) é rejeitado", "critica", () =>
        esperar401({ Authorization: `Bearer ${b64url({ alg: "NoNe", typ: "JWT" })}.${b64url(payloadVitima)}.` })
    );

    await teste("JWT assinado com segredos fracos comuns é rejeitado", "critica", async () => {
        const fracos = ["secret", "changeme", "jwt_secret", "password", "123456", "lumuzia", "supersecret", "your-256-bit-secret"];
        for (const segredo of fracos) {
            const r = await requisicao(alvo, { headers: { Authorization: `Bearer ${jwtHS256(payloadVitima, segredo)}` } });
            if (r.status !== 401 || vazouDadosDaVitima(r)) {
                return { ok: false, detalhe: `aceitou segredo fraco "${segredo}" (status ${r.status})` };
            }
        }
        return true;
    });

    await teste("JWT expirado é rejeitado", "alta", () =>
        esperar401({ Authorization: `Bearer ${jwtHS256({ ...payloadVitima, exp: 1000 }, "qualquer")}` })
    );

    await teste("'Bearer' sem token é rejeitado", "alta", () => esperar401({ Authorization: "Bearer " }));
    await teste("Esquema errado (Basic) é rejeitado", "alta", () => esperar401({ Authorization: "Basic dXNlcjpwYXNz" }));
    await teste("Authorization vazio é rejeitado", "alta", () => esperar401({ Authorization: "" }));
    await teste("Token gigante (10KB) é rejeitado sem erro 500", "media", () =>
        esperar401({ Authorization: `Bearer ${"A".repeat(10 * 1024)}` })
    );
    await teste("Token enviado via query string NÃO autentica", "alta", async () => {
        const t = jwtHS256(payloadVitima, "x");
        const r = await requisicao(`${alvo}?token=${t}&access_token=${t}`);
        return { ok: r.status === 401, detalhe: `Status ${r.status}` };
    });
}

async function blocoIdor() {
    categoriaAtual = "idor";
    cabecalhoBloco("[4] Isolamento multi-tenant e IDOR (A01):");

    const atacante = { headers: como(UID_ATACANTE) };

    const leituras = [
        `/receitas/${UID_VITIMA}`,
        `/gastos/${UID_VITIMA}`,
        `/metas/${UID_VITIMA}`,
        `/dashboard/${UID_VITIMA}`,
        `/api/investimentos/cotacoes/${UID_VITIMA}`,
        `/api/chat/conversas/${UID_VITIMA}`
    ];
    for (const rota of leituras) {
        await teste(`Atacante não lê ${rota} (403 e sem vazamento)`, "critica", async () => {
            const r = await requisicao(rota, atacante);
            return { ok: r.status === 403 && !vazouDadosDaVitima(r), detalhe: `Status ${r.status}` };
        });
    }

    await teste("Truque de caixa alta no UID da vítima não burla a checagem", "alta", async () => {
        const r = await requisicao(`/receitas/${UID_VITIMA.toUpperCase()}`, atacante);
        return { ok: r.status !== 200 || !vazouDadosDaVitima(r), detalhe: `Status ${r.status}` };
    });

    await teste("Path traversal / encoding no UID não expõe dados da vítima", "alta", async () => {
        const variantes = [
            `/receitas/${UID_ATACANTE}/../${UID_VITIMA}`,
            `/receitas/..%2F${UID_VITIMA}`,
            `/receitas/${UID_ATACANTE}%2F..%2F${UID_VITIMA}`,
            `/receitas/${encodeURIComponent(UID_VITIMA)}%00`,
            `/receitas//${UID_VITIMA}`
        ];
        for (const v of variantes) {
            const r = await requisicao(v, atacante);
            if (vazouDadosDaVitima(r)) return { ok: false, detalhe: `vazou em ${v}` };
        }
        return true;
    });

    const receitaVitima = await dbGet("SELECT id FROM receitas WHERE user_id = ? LIMIT 1", [UID_VITIMA]);
    const gastoVitima = await dbGet("SELECT id FROM gastos WHERE user_id = ? LIMIT 1", [UID_VITIMA]);

    await teste("DELETE IDOR: atacante não apaga receita da vítima", "critica", async () => {
        if (!receitaVitima) return { ok: false, detalhe: "receita da vítima não encontrada" };
        const r = await requisicao(`/receitas/${receitaVitima.id}`, { method: "DELETE", ...atacante });
        const aindaExiste = await dbGet("SELECT id FROM receitas WHERE id = ?", [receitaVitima.id]);
        return { ok: [403, 404].includes(r.status) && Boolean(aindaExiste), detalhe: `Status ${r.status}` };
    });

    await teste("DELETE IDOR: atacante não apaga gasto da vítima", "critica", async () => {
        if (!gastoVitima) return { ok: false, detalhe: "gasto da vítima não encontrado" };
        const r = await requisicao(`/gastos/${gastoVitima.id}`, { method: "DELETE", ...atacante });
        const aindaExiste = await dbGet("SELECT id FROM gastos WHERE id = ?", [gastoVitima.id]);
        return { ok: [403, 404].includes(r.status) && Boolean(aindaExiste), detalhe: `Status ${r.status}` };
    });

    await teste("PUT IDOR: atacante não altera receita da vítima", "critica", async () => {
        if (!receitaVitima) return { ok: false, detalhe: "receita da vítima não encontrada" };
        const r = await requisicao(`/receitas/${receitaVitima.id}`, {
            method: "PUT",
            ...atacante,
            body: { descricao: "ADULTERADO PELO ATACANTE", valor: 1 }
        });
        const linha = await dbGet("SELECT descricao, valor FROM receitas WHERE id = ?", [receitaVitima.id]);
        const intacta = linha && linha.descricao === "Salario Confidencial Vitima" && Number(linha.valor) === 10000;
        return { ok: r.status !== 200 && Boolean(intacta), detalhe: `Status ${r.status}` };
    });

    await teste("Mass assignment: atacante não cria registro em nome da vítima via 'user_id' no corpo", "critica", async () => {
        const marca = `mass_assign_${RUN}`;
        await requisicao("/receitas", {
            method: "POST",
            ...atacante,
            body: { descricao: marca, valor: 1, user_id: UID_VITIMA, userId: UID_VITIMA, id: 999999 }
        });
        const naVitima = await dbGet("SELECT id FROM receitas WHERE user_id = ? AND descricao = ?", [UID_VITIMA, marca]);
        return { ok: !naVitima, detalhe: naVitima ? "registro criado na conta da vítima" : "" };
    });

    await teste("Mass assignment em gastos: 'user_id' do corpo é ignorado", "critica", async () => {
        const marca = `mass_assign_gasto_${RUN}`;
        await requisicao("/gastos", {
            method: "POST",
            ...atacante,
            body: { descricao: marca, valor: 1, categoria: "Outros", user_id: UID_VITIMA }
        });
        const naVitima = await dbGet("SELECT id FROM gastos WHERE user_id = ? AND descricao = ?", [UID_VITIMA, marca]);
        return { ok: !naVitima };
    });

    await teste("Os dados da vítima permaneceram intactos ao final do bloco", "alta", async () => {
        const rec = await dbAll("SELECT descricao, valor FROM receitas WHERE user_id = ?", [UID_VITIMA]);
        const gas = await dbAll("SELECT descricao FROM gastos WHERE user_id = ?", [UID_VITIMA]);
        return { ok: rec.length === 1 && gas.length === 1, detalhe: `receitas=${rec.length}, gastos=${gas.length}` };
    });
}

async function blocoSqli() {
    categoriaAtual = "sqli";
    cabecalhoBloco("[5] Injeção de SQL e XSS armazenado (A03):");

    const atacante = { headers: como(UID_ATACANTE) };

    const filtros = [
        "2026' OR '1'='1",
        "2026; DROP TABLE receitas; --",
        "1 UNION SELECT id,nome,salario FROM users",
        "' OR 1=1 --",
        "2026' AND (SELECT COUNT(*) FROM users)>0 --",
        "1;SELECT sqlite_version()",
        "\\' OR \\'1\\'=\\'1"
    ];
    for (const f of filtros) {
        await teste(`Query string maliciosa neutralizada: ano=${f.slice(0, 40)}`, "critica", async () => {
            const r = await requisicao(`/dashboard/${UID_ATACANTE}?ano=${encodeURIComponent(f)}&mes=${encodeURIComponent(f)}`, atacante);
            const ok = r.status !== 500 && !vazouErroInterno(r) && !vazouDadosDaVitima(r);
            return { ok, detalhe: `Status ${r.status}` };
        });
    }

    await teste("Parâmetro de rota (UID) com SQLi não vaza nem gera 500", "critica", async () => {
        const maliciosos = ["x' OR '1'='1", "x'; DROP TABLE users; --", "x' UNION SELECT * FROM users --"];
        for (const m of maliciosos) {
            const r = await requisicao(`/receitas/${encodeURIComponent(m)}`, atacante);
            if (r.status === 500 || vazouErroInterno(r) || vazouDadosDaVitima(r)) {
                return { ok: false, detalhe: `payload "${m}" => ${r.status}` };
            }
        }
        return true;
    });

    const payloadsTexto = [
        "Salario Invasor'; DROP TABLE receitas; --",
        "x' OR '1'='1",
        "x'); DELETE FROM users; --",
        "x\" OR \"\"=\"",
        "x' UNION SELECT id, nome, salario FROM users --"
    ];
    for (const p of payloadsTexto) {
        await teste(`Corpo com SQLi é salvo como texto literal: ${p.slice(0, 35)}`, "critica", async () => {
            const r = await requisicao("/receitas", { method: "POST", ...atacante, body: { descricao: p, valor: 300 } });
            const salva = await dbGet("SELECT descricao FROM receitas WHERE user_id = ? AND descricao = ?", [UID_ATACANTE, p]);
            const tabelas = await dbGet("SELECT count(*) AS total FROM receitas");
            const usuarios = await dbGet("SELECT count(*) AS total FROM users WHERE id = ?", [UID_VITIMA]);
            return {
                ok: r.status === 200 && Boolean(salva) && Boolean(tabelas) && usuarios.total === 1,
                detalhe: `Status ${r.status}`
            };
        });
    }

    const valoresInvalidos = [
        ["string com injeção", "100; DROP TABLE receitas;"],
        ["tautologia numérica", "1 OR 1=1"],
        ["objeto NoSQL-style", { $gt: 0 }],
        ["array", [1, 2, 3]],
        ["null", null],
        ["texto não numérico", "abc"],
        ["string vazia", ""],
        ["NaN em texto", "NaN"],
        ["Infinity em texto", "Infinity"],
        ["notação científica absurda", "1e999"]
    ];
    for (const [nome, valor] of valoresInvalidos) {
        await teste(`Campo 'valor' inválido rejeitado com 400: ${nome}`, "alta", async () => {
            const r = await requisicao("/receitas", {
                method: "POST",
                ...atacante,
                body: { descricao: "Teste valor inválido", valor }
            });
            return { ok: r.status === 400 && !vazouErroInterno(r), detalhe: `Status ${r.status}` };
        });
    }

    await teste("Número gigante em JSON (1e309 => Infinity) é rejeitado sem 500", "media", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "Content-Type": "application/json" },
            body: '{"descricao":"inf","valor":1e309}'
        });
        return { ok: [400, 413, 422].includes(r.status), detalhe: `Status ${r.status}` };
    });

    await teste("Valor negativo em receita é rejeitado (regra de negócio)", "baixa", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            ...atacante,
            body: { descricao: "Negativo", valor: -500 }
        });
        return { ok: r.status === 400, detalhe: `Status ${r.status}` };
    });

    await teste("XSS armazenado: payload é devolvido como JSON (não como HTML) e com nosniff", "alta", async () => {
        const xss = `<img src=x onerror=alert('${RUN}')>`;
        await requisicao("/receitas", { method: "POST", ...atacante, body: { descricao: xss, valor: 5 } });
        const r = await requisicao(`/receitas/${UID_ATACANTE}`, atacante);
        const ct = r.headers.get("content-type") || "";
        return {
            ok: ct.includes("application/json") && r.headers.get("x-content-type-options") === "nosniff",
            detalhe: `Content-Type=${ct}`
        };
    });
}

async function blocoEntrada() {
    categoriaAtual = "entrada";
    cabecalhoBloco("[6] Robustez de entrada, DoS e vazamento de erros (A04/A09/A10):");

    const atacante = { headers: como(UID_ATACANTE) };

    await teste("Payload > 200KB em /receitas => 413", "alta", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            ...atacante,
            body: { descricao: "A".repeat(260 * 1024), valor: 10 }
        });
        return { ok: r.status === 413, detalhe: `Status ${r.status}` };
    });

    await teste("Payload > 200KB em /gastos => 413", "alta", async () => {
        const r = await requisicao("/gastos", {
            method: "POST",
            ...atacante,
            body: { descricao: "A".repeat(260 * 1024), valor: 10, categoria: "Outros" }
        });
        return { ok: r.status === 413, detalhe: `Status ${r.status}` };
    });

    await teste("Payload > 200KB em /api/ia/chat => 413", "alta", async () => {
        const r = await requisicao("/api/ia/chat", {
            method: "POST",
            ...atacante,
            body: { prompt: "A".repeat(260 * 1024), modelo: "teste" }
        });
        return { ok: r.status === 413, detalhe: `Status ${r.status}` };
    });

    await teste("Payload exatamente no limite não derruba o servidor (sem 500)", "media", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            ...atacante,
            body: { descricao: "B".repeat(LIMITE_PAYLOAD_BYTES - 200), valor: 1 }
        });
        return { ok: r.status !== 500, detalhe: `Status ${r.status}` };
    });

    await teste("JSON malformado => 400 sem stack trace", "alta", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "Content-Type": "application/json" },
            body: '{"descricao": "quebrado", "valor": '
        });
        return { ok: r.status === 400 && !vazouErroInterno(r), detalhe: `Status ${r.status}` };
    });

    await teste("JSON com aninhamento profundo (50k níveis) não causa 500/travamento", "media", async () => {
        const profundo = "[".repeat(50000) + "]".repeat(50000);
        const r = await requisicao("/receitas", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "Content-Type": "application/json" },
            body: profundo,
            timeout: 15000
        });
        return { ok: [400, 413, 422].includes(r.status) && !vazouErroInterno(r), detalhe: `Status ${r.status}` };
    });

    await teste("Prototype pollution via __proto__ / constructor não contamina Object.prototype", "alta", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "Content-Type": "application/json" },
            body: `{"descricao":"proto","valor":1,"__proto__":{"polluido":"sim"},"constructor":{"prototype":{"polluido2":"sim"}}}`
        });
        const limpo = ({}).polluido === undefined && ({}).polluido2 === undefined;
        return { ok: limpo && r.status !== 500, detalhe: `Status ${r.status}` };
    });

    await teste("Content-Type text/plain com corpo JSON não é aceito como válido", "media", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "Content-Type": "text/plain" },
            body: '{"descricao":"ct-confusion","valor":10}'
        });
        const criou = await dbGet("SELECT id FROM receitas WHERE user_id = ? AND descricao = 'ct-confusion'", [UID_ATACANTE]);
        return { ok: !criou && r.status !== 500, detalhe: `Status ${r.status}` };
    });

    await teste("Caracteres de controle / byte nulo no texto não geram 500", "media", async () => {
        const r = await requisicao("/receitas", {
            method: "POST",
            ...atacante,
            body: { descricao: "a\u0000b\u0007c\u202Ed", valor: 1 }
        });
        return { ok: r.status !== 500 && !vazouErroInterno(r), detalhe: `Status ${r.status}` };
    });

    await teste("HTTP Parameter Pollution (?ano=2026&ano=2027) não gera 500", "media", async () => {
        const r = await requisicao(`/dashboard/${UID_ATACANTE}?ano=2026&ano=2027&ano[]=1&ano[a]=b`, atacante);
        return { ok: r.status !== 500 && !vazouErroInterno(r), detalhe: `Status ${r.status}` };
    });

    await teste("URL gigante (8KB) é tratada sem 500", "media", async () => {
        try {
            const r = await requisicaoRaw({ path: `/receitas/${"a".repeat(8000)}`, headers: como(UID_ATACANTE) });
            return { ok: r.status !== 500, detalhe: `Status ${r.status}` };
        } catch {
            return true; // conexão recusada/encerrada também é defesa válida
        }
    });

    await teste("Header gigante (40KB) é recusado (431/400) ou conexão encerrada", "media", async () => {
        try {
            const r = await requisicaoRaw({ headers: { "X-Lixo": "A".repeat(40 * 1024) } });
            return { ok: [400, 413, 431].includes(r.status), detalhe: `Status ${r.status}` };
        } catch {
            return true;
        }
    });

    await teste("Requisição com muitos campos no corpo (5k chaves) não derruba o servidor", "baixa", async () => {
        const corpo = { descricao: "many", valor: 1 };
        for (let i = 0; i < 5000; i++) corpo[`k${i}`] = i;
        const r = await requisicao("/receitas", { method: "POST", ...atacante, body: corpo });
        return { ok: r.status !== 500, detalhe: `Status ${r.status}` };
    });
}

async function blocoExposicao() {
    categoriaAtual = "exposicao";
    cabecalhoBloco("[7] Exposição de arquivos, métodos HTTP e vazamento de informações (A05):");

    const sensiveis = [
        "/.env",
        "/.env.local",
        "/.git/config",
        "/.git/HEAD",
        "/package.json",
        "/package-lock.json",
        "/server.js",
        "/database.js",
        "/database.sqlite",
        "/database.db",
        "/db.sqlite",
        "/backup.sql",
        "/.DS_Store",
        "/node_modules/.package-lock.json",
        "/seguranca.test.js"
    ];
    const REGEX_CONTEUDO_SENSIVEL =
        /DB_PASSWORD|SECRET|API_KEY|"dependencies"|require\(|module\.exports|SQLite format 3|\[core\]|ref: refs\//i;

    for (const p of sensiveis) {
        await teste(`Arquivo sensível não acessível: ${p}`, "alta", async () => {
            const r = await requisicao(p);
            const exposto = r.status === 200 && REGEX_CONTEUDO_SENSIVEL.test(r.texto);
            return { ok: !exposto, detalhe: `Status ${r.status}` };
        });
    }

    await teste("Rota inexistente não vaza stack trace nem caminhos internos", "media", async () => {
        const r = await requisicao(`/rota-que-nao-existe-${RUN}`);
        return { ok: !vazouErroInterno(r) && r.status < 500, detalhe: `Status ${r.status}` };
    });

    await teste("Erro de rota autenticada com ID inválido não vaza detalhes internos", "media", async () => {
        const r = await requisicao("/receitas/abc'\"<>", { method: "DELETE", headers: como(UID_ATACANTE) });
        return { ok: !vazouErroInterno(r) && r.status !== 500, detalhe: `Status ${r.status}` };
    });

    await teste("Método TRACE desabilitado", "media", async () => {
        try {
            const r = await requisicaoRaw({ method: "TRACE", path: "/", headers: { "X-Marca": RUN } });
            const refletiu = r.status === 200 && r.texto.includes(RUN);
            return { ok: !refletiu, detalhe: `Status ${r.status}` };
        } catch {
            return true;
        }
    });

    await teste("Método arbitrário (FOOBAR) não gera 500", "baixa", async () => {
        try {
            const r = await requisicaoRaw({ method: "FOOBAR", path: "/receitas" });
            return { ok: r.status !== 500, detalhe: `Status ${r.status}` };
        } catch {
            return true;
        }
    });

    await teste("Override de método (X-HTTP-Method-Override: DELETE) não é honrado", "media", async () => {
        const receita = await dbGet("SELECT id FROM receitas WHERE user_id = ? LIMIT 1", [UID_VITIMA]);
        if (!receita) return { ok: false, detalhe: "receita da vítima não encontrada" };
        await requisicao(`/receitas/${receita.id}`, {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "X-HTTP-Method-Override": "DELETE" },
            body: {}
        });
        const aindaExiste = await dbGet("SELECT id FROM receitas WHERE id = ?", [receita.id]);
        return { ok: Boolean(aindaExiste) };
    });

    await teste("Host header forjado não quebra a aplicação (sem 500)", "baixa", async () => {
        try {
            const r = await requisicaoRaw({ path: "/", headers: { Host: "evil.example" } });
            return { ok: r.status !== 500, detalhe: `Status ${r.status}` };
        } catch {
            return true;
        }
    });
}

function listarArquivosFonte(dir, acc = []) {
    const IGNORAR = new Set(["node_modules", ".git", "coverage", "dist", "build", "public", "uploads"]);
    for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORAR.has(nome.name)) continue;
        const completo = path.join(dir, nome.name);
        if (nome.isDirectory()) listarArquivosFonte(completo, acc);
        else if (/\.(js|cjs|mjs)$/.test(nome.name) && !/\.test\.js$/.test(nome.name) && !/^test-/.test(nome.name)) acc.push(completo);
    }
    return acc;
}

async function blocoEstatico() {
    categoriaAtual = "estatica";
    cabecalhoBloco("[8] Análise estática leve do código-fonte (SAST) e dependências (A03/A06):");

    let arquivos = [];
    try {
        arquivos = listarArquivosFonte(__dirname);
    } catch (err) {
        await teste("Leitura dos arquivos-fonte para análise estática", "baixa", () => ({ ok: false, detalhe: err.message }));
        return;
    }

    const linhasComPadrao = (regex) => {
        const achados = [];
        for (const arq of arquivos) {
            const linhas = fs.readFileSync(arq, "utf8").split("\n");
            linhas.forEach((linha, i) => {
                if (regex.test(linha)) achados.push(`${path.relative(__dirname, arq)}:${i + 1}`);
            });
        }
        return achados;
    };

    await teste("SQL montado com template string/concatenação (risco de SQLi)", "alta", () => {
        const achados = [
            ...linhasComPadrao(/db(?:Run|Get|All)\(\s*`[^`]*\$\{(?!\s*tabela\s*\})/),
            ...linhasComPadrao(/db(?:Run|Get|All)\(\s*["'][^"']*["']\s*\+/)
        ];
        return { ok: achados.length === 0, detalhe: achados.slice(0, 5).join(", ") };
    });

    await teste("Sem segredos/chaves hardcoded no código", "critica", () => {
        const achados = linhasComPadrao(
            /(api[_-]?key|secret|password|senha|token|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-\/+=]{16,}["']/i
        );
        return { ok: achados.length === 0, detalhe: achados.slice(0, 5).join(", ") }; // mostra só local, nunca o valor
    });

    await teste("Backdoor de teste 'x-test-uid' só existe protegido por NODE_ENV === 'test'", "critica", () => {
        const arquivosComBackdoor = arquivos.filter((a) => fs.readFileSync(a, "utf8").includes("x-test-uid"));
        const desprotegidos = arquivosComBackdoor.filter((a) => {
            const src = fs.readFileSync(a, "utf8");
            return !/NODE_ENV\s*===?\s*["']test["']/.test(src);
        });
        return {
            ok: desprotegidos.length === 0,
            detalhe: desprotegidos.map((a) => path.relative(__dirname, a)).join(", ")
        };
    });

    await teste("Sem uso de eval / new Function / child_process com entrada dinâmica", "alta", () => {
        const achados = linhasComPadrao(/\beval\s*\(|new Function\s*\(|child_process/);
        return { ok: achados.length === 0, detalhe: achados.slice(0, 5).join(", ") };
    });

    await teste("CORS não configurado com origin '*' + credentials no código", "media", () => {
        const achados = linhasComPadrao(/origin\s*:\s*["']\*["']/);
        return { ok: achados.length === 0, detalhe: achados.slice(0, 5).join(", ") };
    });

    await teste("Comparação de segredos/tokens com === (prefira crypto.timingSafeEqual)", "baixa", () => {
        const achados = linhasComPadrao(/(secret|token|apikey|api_key)\w*\s*===?\s*(req\.|header)/i);
        return { ok: achados.length === 0, detalhe: achados.slice(0, 5).join(", ") };
    });

    await teste("Arquivo .env está no .gitignore", "alta", () => {
        const gi = fs.existsSync(path.join(__dirname, ".gitignore"))
            ? path.join(__dirname, ".gitignore")
            : path.join(__dirname, "..", ".gitignore");
        if (!fs.existsSync(gi)) return { ok: false, detalhe: ".gitignore ausente" };
        return /^\.env/m.test(fs.readFileSync(gi, "utf8"));
    });

    if (MODO_AUDIT) {
        await teste("npm audit: sem vulnerabilidades altas/críticas em dependências de produção", "alta", () => {
            let saida = "";
            try {
                saida = execSync("npm audit --omit=dev --json", { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
            } catch (err) {
                saida = err.stdout ? err.stdout.toString() : "";
            }
            try {
                const v = JSON.parse(saida).metadata.vulnerabilities;
                const graves = (v.high || 0) + (v.critical || 0);
                return { ok: graves === 0, detalhe: `alta=${v.high || 0}, crítica=${v.critical || 0}, moderada=${v.moderate || 0}` };
            } catch {
                return { ok: false, detalhe: "não foi possível interpretar a saída do npm audit (sem rede?)" };
            }
        });
    }
}

async function blocoRateLimit() {
    categoriaAtual = "ratelimit";
    cabecalhoBloco("[9] Rate limiting e força bruta (A04/A07) - roda por último para não afetar os demais:");

    const atacante = { headers: como(UID_ATACANTE) };
    let bloqueouNaN = 0;
    let ultimaResposta = null;

    for (let i = 1; i <= MAX_REQ_ATE_BLOQUEAR; i++) {
        const r = await requisicao("/api/ia/chat", {
            method: "POST",
            ...atacante,
            body: { prompt: `Ping de teste ${i}`, modelo: "teste" }
        });
        if (r.status === 429) {
            bloqueouNaN = i;
            ultimaResposta = r;
            break;
        }
    }

    await teste(
        `Flood em /api/ia/chat é bloqueado com 429 (até ${MAX_REQ_ATE_BLOQUEAR} requisições)`,
        "alta",
        () => ({ ok: bloqueouNaN > 0, detalhe: bloqueouNaN ? `bloqueou na ${bloqueouNaN}ª` : `não bloqueou em ${MAX_REQ_ATE_BLOQUEAR}` })
    );

    if (!ultimaResposta) return;

    await teste("Resposta 429 informa Retry-After / RateLimit headers", "baixa", () => {
        const h = ultimaResposta.headers;
        return Boolean(h.get("retry-after") || h.get("ratelimit-reset") || h.get("x-ratelimit-reset") || h.get("ratelimit"));
    });

    await teste("Resposta 429 não vaza detalhes internos", "media", () => !vazouErroInterno(ultimaResposta));

    await teste("Bloqueio não é burlado com X-Forwarded-For forjado", "alta", async () => {
        const r = await requisicao("/api/ia/chat", {
            method: "POST",
            headers: { ...como(UID_ATACANTE), "X-Forwarded-For": `10.${Math.floor(Math.random() * 255)}.1.1`, "X-Real-IP": "1.2.3.4" },
            body: { prompt: "bypass", modelo: "teste" }
        });
        return { ok: r.status === 429, detalhe: `Status ${r.status}` };
    });
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
function imprimirRelatorio() {
    const total = resultados.length;
    const passaram = resultados.filter((r) => r.ok).length;
    const falhas = resultados.filter((r) => !r.ok && r.severidade !== "baixa");
    const avisos = resultados.filter((r) => !r.ok && r.severidade === "baixa");

    console.log(`\n${CORES.negrito}${CORES.azul}================================================================${CORES.reset}`);
    console.log(`${CORES.negrito}RELATÓRIO FINAL DE SEGURANÇA E DEFESA DA APLICAÇÃO:${CORES.reset}`);
    console.log(`  Total de verificações : ${total}`);
    console.log(`  ${CORES.verde}Aprovadas             : ${passaram}${CORES.reset}`);
    console.log(`  ${falhas.length ? CORES.vermelho : CORES.verde}Falhas (bloqueantes)  : ${falhas.length}${CORES.reset}`);
    console.log(`  ${avisos.length ? CORES.amarelo : CORES.verde}Avisos (baixa)        : ${avisos.length}${CORES.reset}`);

    const porCategoria = {};
    for (const r of resultados) {
        porCategoria[r.categoria] = porCategoria[r.categoria] || { ok: 0, total: 0 };
        porCategoria[r.categoria].total++;
        if (r.ok) porCategoria[r.categoria].ok++;
    }
    console.log(`\n  ${CORES.negrito}Por bloco:${CORES.reset}`);
    for (const [cat, v] of Object.entries(porCategoria)) {
        console.log(`    ${cat.padEnd(12)} ${v.ok}/${v.total}`);
    }

    if (falhas.length) {
        const ordem = { critica: 0, alta: 1, media: 2 };
        falhas.sort((a, b) => (ordem[a.severidade] ?? 9) - (ordem[b.severidade] ?? 9));
        console.log(`\n  ${CORES.negrito}${CORES.vermelho}Falhas por prioridade:${CORES.reset}`);
        for (const f of falhas) {
            console.log(`    [${f.severidade.toUpperCase()}] (${f.categoria}) ${f.titulo}${f.detalhe ? ` - ${f.detalhe}` : ""}`);
        }
    }
    console.log(`${CORES.negrito}${CORES.azul}================================================================${CORES.reset}\n`);

    if (MODO_JSON) {
        const arquivo = path.join(__dirname, "security-report.json");
        fs.writeFileSync(
            arquivo,
            JSON.stringify({ geradoEm: new Date().toISOString(), total, passaram, falhas: falhas.length, avisos: avisos.length, resultados }, null, 2)
        );
        console.log(`Relatório JSON salvo em ${path.relative(process.cwd(), arquivo)}`);
    }

    return falhas.length;
}

async function executarSuiteSeguranca() {
    console.log(`\n${CORES.negrito}${CORES.azul}================================================================${CORES.reset}`);
    console.log(`${CORES.negrito}${CORES.azul}  SUÍTE DEFENSIVA DE SEGURANÇA v2 (AppSec / DAST + SAST leve)${CORES.reset}`);
    console.log(`${CORES.negrito}${CORES.azul}================================================================${CORES.reset}`);

    await new Promise((resolve, reject) => {
        serverInstance = app.listen(0, "127.0.0.1", () => {
            baseUrl = `http://127.0.0.1:${serverInstance.address().port}`;
            resolve();
        });
        serverInstance.on("error", reject);
    });

    try {
        await limparDadosDeTeste(); // remove sobras de execuções anteriores que travaram
        await prepararDados();

        if (deveRodar("cabecalhos")) await blocoCabecalhos();
        if (deveRodar("acesso")) await blocoAcessoAnonimo();
        if (deveRodar("tokens")) await blocoTokens();
        if (deveRodar("idor")) await blocoIdor();
        if (deveRodar("sqli")) await blocoSqli();
        if (deveRodar("entrada")) await blocoEntrada();
        if (deveRodar("exposicao")) await blocoExposicao();
        if (deveRodar("estatica")) await blocoEstatico();
        if (deveRodar("ratelimit")) await blocoRateLimit(); // sempre por último
    } finally {
        categoriaAtual = "limpeza";
        cabecalhoBloco("[10] Limpeza e restauração do ambiente:");
        await limparDadosDeTeste();

        await teste("Nenhum registro de teste restou no banco", "alta", async () => {
            let sobras = 0;
            for (const tabela of TABELAS_COM_USER_ID) {
                try {
                    const r = await dbGet(`SELECT count(*) AS total FROM ${tabela} WHERE user_id LIKE ?`, [`${PREFIXO}%`]);
                    sobras += r.total;
                } catch {
                    /* tabela pode não existir em todos os ambientes */
                }
            }
            const u = await dbGet("SELECT count(*) AS total FROM users WHERE id LIKE ?", [`${PREFIXO}%`]);
            sobras += u.total;
            return { ok: sobras === 0, detalhe: `${sobras} registro(s) restante(s)` };
        });

        if (serverInstance) await new Promise((r) => serverInstance.close(r));
    }

    const falhas = imprimirRelatorio();
    process.exitCode = falhas > 0 ? 1 : 0;
    // O rate limiter/db podem manter handles abertos; encerra explicitamente.
    setTimeout(() => process.exit(process.exitCode), 200).unref();
}

executarSuiteSeguranca().catch(async (err) => {
    console.error("Erro fatal ao executar suíte de segurança:", err);
    try {
        await limparDadosDeTeste();
    } catch {
        /* ignora */
    }
    if (serverInstance) serverInstance.close();
    process.exit(1);
});