/**
 * LumuzIA - Suíte de Testes Automatizados de Segurança Cibernética (AppSec / DAST Defensivo)
 *
 * Simula de forma segura e controlada as principais táticas de invasão e abusos (OWASP Top 10):
 * 1. Broken Access Control (Acesso sem autenticação)
 * 2. Token Forjado / Malformado
 * 3. IDOR (Tentativa de acesso/manipulação de dados de outros usuários)
 * 4. Injeção de SQL (SQL Injection em parâmetros e corpo)
 * 5. Proteção contra Excesso de Carga / DoS de Memória (Payload Too Large)
 * 6. Rate Limiting / Força Bruta (Bloqueio após flood de requisições)
 * 7. Cabeçalhos HTTP de Proteção (Helmet / Omissão de Fingerprint Express)
 * 8. Limpeza Total de Dados de Teste ao Final (Garante integridade do banco)
 */

process.env.NODE_ENV = "test";

const http = require("http");
const app = require("./server");
const { dbRun, dbGet, dbAll } = require("./database");

const CORES = {
    reset: "\x1b[0m",
    verde: "\x1b[32m",
    vermelho: "\x1b[31m",
    amarelo: "\x1b[33m",
    azul: "\x1b[36m",
    negrito: "\x1b[1m"
};

let serverInstance;
let baseUrl = "";
const UID_VITIMA = "sec_test_vitima_safe";
const UID_ATACANTE = "sec_test_atacante_safe";

let totalTestes = 0;
let testesPassaram = 0;
let testesFalharam = 0;

function registrarResultado(titulo, passou, detalhe = "") {
    totalTestes++;
    if (passou) {
        testesPassaram++;
        console.log(`  ${CORES.verde}✔ [PASS]${CORES.reset} ${titulo}`);
    } else {
        testesFalharam++;
        console.log(`  ${CORES.vermelho}✖ [FAIL]${CORES.reset} ${titulo} ${detalhe ? `(${detalhe})` : ""}`);
    }
}

async function requisicao(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === "object" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const fetchOptions = {
        method: options.method || "GET",
        headers,
        body: options.body && typeof options.body === "object" ? JSON.stringify(options.body) : options.body
    };

    const res = await fetch(url, fetchOptions);
    let data = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            data = await res.json();
        } catch {
            data = null;
        }
    } else {
        try {
            data = await res.text();
        } catch {
            data = null;
        }
    }

    return {
        status: res.status,
        headers: res.headers,
        data
    };
}

async function limparDadosDeTeste() {
    try {
        await dbRun("DELETE FROM receitas WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
        await dbRun("DELETE FROM gastos WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
        await dbRun("DELETE FROM metas WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
        await dbRun("DELETE FROM agendamentos WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
        await dbRun("DELETE FROM chat_conversas WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
        await dbRun("DELETE FROM users WHERE id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);
    } catch (err) {
        console.warn("Aviso ao limpar dados de teste:", err.message);
    }
}

async function executarSuiteSeguranca() {
    console.log(`\n${CORES.negrito}${CORES.azul}================================================================${CORES.reset}`);
    console.log(`${CORES.negrito}${CORES.azul}  INICIANDO SUÍTE DE TESTES DEFENSIVOS DE SEGURANÇA (AppSec/DAST)${CORES.reset}`);
    console.log(`${CORES.negrito}${CORES.azul}================================================================${CORES.reset}\n`);

    // Iniciar servidor em porta livre aleatória (evita conflitos de porta)
    await new Promise((resolve) => {
        serverInstance = app.listen(0, () => {
            const port = serverInstance.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    try {
        await limparDadosDeTeste();

        // -------------------------------------------------------------
        // BLOCO 1: Cabeçalhos HTTP de Proteção (Helmet / OWASP A04)
        // -------------------------------------------------------------
        console.log(`${CORES.negrito}[1] Teste de Proteção de Cabeçalhos HTTP (Helmet):${CORES.reset}`);
        const resHeaders = await requisicao("/");
        const nosniff = resHeaders.headers.get("x-content-type-options");
        const dnsPrefetch = resHeaders.headers.get("x-dns-prefetch-control");
        const poweredBy = resHeaders.headers.get("x-powered-by");

        registrarResultado("X-Content-Type-Options: nosniff ativo", nosniff === "nosniff", nosniff);
        registrarResultado("X-DNS-Prefetch-Control: off ativo", dnsPrefetch === "off", dnsPrefetch);
        registrarResultado("X-Powered-By ocultado (não expõe Express)", poweredBy === null, poweredBy);

        // -------------------------------------------------------------
        // BLOCO 2: Tentativas de Acesso Sem Autenticação (OWASP A01)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[2] Teste de Broken Access Control (Requisições Anônimas):${CORES.reset}`);
        const rotasProtegidas = [
            { path: `/receitas/${UID_VITIMA}`, method: "GET" },
            { path: `/gastos/${UID_VITIMA}`, method: "GET" },
            { path: `/metas/${UID_VITIMA}`, method: "GET" },
            { path: `/dashboard/${UID_VITIMA}`, method: "GET" },
            { path: `/api/investimentos/cotacoes/${UID_VITIMA}`, method: "GET" },
            { path: `/api/chat/conversas/${UID_VITIMA}`, method: "GET" },
            { path: "/receitas", method: "POST", body: { descricao: "Teste", valor: 10 } }
        ];

        for (const rota of rotasProtegidas) {
            const res = await requisicao(rota.path, { method: rota.method, body: rota.body });
            const bloqueado = res.status === 401 && res.data && res.data.success === false;
            registrarResultado(`Bloqueio de ${rota.method} ${rota.path} sem token (401)`, bloqueado, `Status ${res.status}`);
        }

        // -------------------------------------------------------------
        // BLOCO 3: Tentativas com Token Falso / Forjado (OWASP A07)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[3] Teste com Token Falso / Forjado:${CORES.reset}`);
        const resTokenFalso = await requisicao(`/receitas/${UID_VITIMA}`, {
            headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature" }
        });
        const tokenRejeitado = resTokenFalso.status === 401 && resTokenFalso.data?.success === false;
        registrarResultado("Rejeição imediata de token JWT forjado (401)", tokenRejeitado, `Status ${resTokenFalso.status}`);

        // -------------------------------------------------------------
        // BLOCO 4: Tentativa de IDOR (Invasor acessando dados de outro usuário)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[4] Teste de Isolamento Multi-Tenant e IDOR (OWASP A01):${CORES.reset}`);
        // Criar usuário e dados da vítima no banco
        await dbRun("INSERT INTO users (id, nome, salario) VALUES (?, 'Vitima Teste', 10000)", [UID_VITIMA]);
        await dbRun("INSERT INTO receitas (user_id, descricao, valor) VALUES (?, 'Salario Confidencial Vitima', 10000)", [UID_VITIMA]);
        await dbRun("INSERT INTO gastos (user_id, descricao, valor, categoria) VALUES (?, 'Gasto Confidencial Vitima', 500, 'Alimentação')", [UID_VITIMA]);

        // Atacante tenta ler dados da vítima enviando seu próprio token/uid
        const resIdorReceitas = await requisicao(`/receitas/${UID_VITIMA}`, {
            headers: { "x-test-uid": UID_ATACANTE }
        });
        registrarResultado("Atacante bloqueado ao tentar ler receitas da vítima (403)", resIdorReceitas.status === 403, `Status ${resIdorReceitas.status}`);

        const resIdorGastos = await requisicao(`/gastos/${UID_VITIMA}`, {
            headers: { "x-test-uid": UID_ATACANTE }
        });
        registrarResultado("Atacante bloqueado ao tentar ler gastos da vítima (403)", resIdorGastos.status === 403, `Status ${resIdorGastos.status}`);

        const resIdorDashboard = await requisicao(`/dashboard/${UID_VITIMA}`, {
            headers: { "x-test-uid": UID_ATACANTE }
        });
        registrarResultado("Atacante bloqueado ao tentar ler dashboard da vítima (403)", resIdorDashboard.status === 403, `Status ${resIdorDashboard.status}`);

        // Tentativa de IDOR destrutivo: Atacante tentando apagar a receita da vítima
        const receitaVitima = await dbGet("SELECT id FROM receitas WHERE user_id = ? LIMIT 1", [UID_VITIMA]);
        if (receitaVitima) {
            const resDeleteIdor = await requisicao(`/receitas/${receitaVitima.id}`, {
                method: "DELETE",
                headers: { "x-test-uid": UID_ATACANTE }
            });
            const protegido = resDeleteIdor.status === 404; // 404 porque não pertence ao atacante
            const aindaExiste = await dbGet("SELECT id FROM receitas WHERE id = ?", [receitaVitima.id]);
            registrarResultado("Atacante impedido de apagar registro financeiro da vítima (DELETE IDOR)", protegido && Boolean(aindaExiste), `Status ${resDeleteIdor.status}`);
        }

        // -------------------------------------------------------------
        // BLOCO 5: Injeção de SQL (SQL Injection - OWASP A03)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[5] Teste de Proteção contra Injeção de SQL (SQLi):${CORES.reset}`);
        // Injeção via parâmetro de filtro em dashboard
        const resSqliFiltro = await requisicao(`/dashboard/${UID_ATACANTE}?ano=2026' OR '1'='1`, {
            headers: { "x-test-uid": UID_ATACANTE }
        });
        registrarResultado("Filtro malicioso com SQL injection neutralizado com segurança", resSqliFiltro.status === 200, `Status ${resSqliFiltro.status}`);

        // Injeção via payload no corpo da receita
        const payloadSqliDescricao = "Salario Invasor'; DROP TABLE receitas; --";
        const resSqliInsert = await requisicao("/receitas", {
            method: "POST",
            headers: { "x-test-uid": UID_ATACANTE },
            body: { descricao: payloadSqliDescricao, valor: 300 }
        });

        // Verificar se a tabela receitas continuou intacta e o payload foi tratado como texto puro
        const receitaSalva = await dbGet("SELECT descricao FROM receitas WHERE user_id = ? AND descricao = ?", [UID_ATACANTE, payloadSqliDescricao]);
        const tabelaAindaExiste = await dbGet("SELECT count(*) as total FROM receitas");

        registrarResultado(
            "Payload SQL tratado como texto literal sem executar comando malicioso",
            resSqliInsert.status === 200 && Boolean(receitaSalva) && Boolean(tabelaAindaExiste),
            `Status ${resSqliInsert.status}`
        );

        // Tentativa de injetar string maliciosa em campo numérico
        const resSqliValor = await requisicao("/receitas", {
            method: "POST",
            headers: { "x-test-uid": UID_ATACANTE },
            body: { descricao: "Teste Injeção Valor", valor: "100; DROP TABLE receitas;" }
        });
        registrarResultado(
            "Rejeição de valor numérico malicioso ou com injeção (400 Bad Request)",
            resSqliValor.status === 400,
            `Status ${resSqliValor.status}`
        );

        // -------------------------------------------------------------
        // BLOCO 6: Proteção contra Esgotamento de Memória / DoS (Payload Limit)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[6] Teste de Limite de Carga Útil (Payload Limit / DoS):${CORES.reset}`);
        // Gerar corpo com mais de 250 KB (limite configurado no backend é 200 KB)
        const payloadGigante = "A".repeat(260 * 1024);
        const resPayloadGrande = await requisicao("/receitas", {
            method: "POST",
            headers: { "x-test-uid": UID_ATACANTE },
            body: { descricao: payloadGigante, valor: 10 }
        });
        registrarResultado(
            "Requisição excessiva (>200KB) rejeitada com HTTP 413 (Payload Too Large)",
            resPayloadGrande.status === 413,
            `Status ${resPayloadGrande.status}`
        );

        // -------------------------------------------------------------
        // BLOCO 7: Rate Limiting / Força Bruta no Chat da IA (OWASP A06)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[7] Teste de Rate Limiting e Força Bruta (/api/ia/chat):${CORES.reset}`);
        console.log("  Disparando 16 requisições sucessivas para verificar bloqueio por Rate Limit...");
        let bloqueouCom429 = false;
        let requisicoesFeitas = 0;

        for (let i = 1; i <= 16; i++) {
            const res = await requisicao("/api/ia/chat", {
                method: "POST",
                headers: { "x-test-uid": UID_ATACANTE },
                body: { prompt: `Ping de teste ${i}`, modelo: "teste" }
            });
            requisicoesFeitas++;
            if (res.status === 429) {
                bloqueouCom429 = true;
                break;
            }
        }
        registrarResultado(
            `Rate Limiter ativado com sucesso: Bloqueou flood com HTTP 429 na ${requisicoesFeitas}ª requisição`,
            bloqueouCom429,
            `Total requisições: ${requisicoesFeitas}`
        );

    } finally {
        // -------------------------------------------------------------
        // LIMPEZA / ARRUMAR A BAGUNÇA (Garante que nada sobra)
        // -------------------------------------------------------------
        console.log(`\n${CORES.negrito}[8] Limpeza e Restauração de Ambiente:${CORES.reset}`);
        await limparDadosDeTeste();

        const vitimaSobrou = await dbGet("SELECT id FROM users WHERE id = ?", [UID_VITIMA]);
        const atacanteSobrou = await dbGet("SELECT id FROM users WHERE id = ?", [UID_ATACANTE]);
        const receitasSobraram = await dbGet("SELECT id FROM receitas WHERE user_id IN (?, ?)", [UID_VITIMA, UID_ATACANTE]);

        const limpo = !vitimaSobrou && !atacanteSobrou && !receitasSobraram;
        registrarResultado("Limpeza completa: Todos os registros de teste foram removidos do banco", limpo);

        if (serverInstance) {
            serverInstance.close();
        }
    }

    // -------------------------------------------------------------
    // RELATÓRIO FINAL
    // -------------------------------------------------------------
    console.log(`\n${CORES.negrito}${CORES.azul}================================================================${CORES.reset}`);
    console.log(`${CORES.negrito}RELATÓRIO FINAL DE SEGURANÇA E DEFESA DA APLICAÇÃO:${CORES.reset}`);
    console.log(`  Total de Verificações : ${totalTestes}`);
    console.log(`  ${CORES.verde}Aprovados (Seguro)    : ${testesPassaram}${CORES.reset}`);
    console.log(`  ${testesFalharam > 0 ? CORES.vermelho : CORES.verde}Reprovados (Falhas)   : ${testesFalharam}${CORES.reset}`);
    console.log(`${CORES.negrito}${CORES.azul}================================================================${CORES.reset}\n`);

    if (testesFalharam > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

executarSuiteSeguranca().catch((err) => {
    console.error("Erro fatal ao executar suíte de segurança:", err);
    if (serverInstance) serverInstance.close();
    process.exit(1);
});
