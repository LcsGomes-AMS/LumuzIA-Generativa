const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const SECRET = "sec_test_bridge_secret_0123456789_abcdef";
const php = process.env.PHP_BINARY || (process.platform === "win32" && fs.existsSync("C:/xampp/php/php.exe") ? "C:/xampp/php/php.exe" : "php");
const available = spawnSync(php, ["--version"], { windowsHide: true, encoding: "utf8" });

async function close(server) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
}
async function startBridge(t, secret = SECRET) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sec_test_bridge_"));
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
    const port = probe.address().port;
    await close(probe);
    const env = { OLLAMA_BRIDGE_SECRET: secret, OLLAMA_MODEL: "llama3.2:1b" };
    for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env[key] = process.env[key];
    env.TEMP = env.TMP = temp;
    const child = spawn(php, ["-d", "display_errors=0", "-d", "sys_temp_dir=" + JSON.stringify(temp), "-S", "127.0.0.1:" + port, path.join(root, "index.php")], { cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let diagnostics = ""; child.stderr.on("data", chunk => { diagnostics += chunk; });
    t.after(async () => {
        if (child.exitCode === null) {
            const exited = new Promise(resolve => child.once("exit", resolve));
            child.kill();
            await exited;
        }
        assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temp).startsWith("sec_test_bridge_"));
        fs.rmSync(temp, { recursive: true, force: true });
    });
    const url = "http://127.0.0.1:" + port + "/index.php";
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) break;
        try { await fetch(url); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, "Servidor PHP local iniciou");
    return async function request(data, { method = "POST", headers = {}, raw } = {}) {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", "X-Lumuz-Bridge-Secret": SECRET, ...headers },
            ...(method !== "GET" && method !== "HEAD" ? { body: raw ?? JSON.stringify(data) } : {})
        });
        const body = await response.json();
        return { response, body, diagnostics };
    };
}

test("ponte PHP recusa acessos indevidos e limita o serviço de IA", { skip: available.error ? "PHP não disponível; defina PHP_BINARY para validar a ponte" : false }, async t => {
    const lint = spawnSync(php, ["-l", path.join(root, "index.php")], { encoding: "utf8", windowsHide: true });
    assert.equal(lint.status, 0, lint.stdout + lint.stderr);
    const request = await startBridge(t);

    await t.test("somente POST; preflight e GET não liberam CORS", async () => {
        for (const method of ["GET", "OPTIONS", "PUT", "DELETE"]) {
            const { response } = await request({}, { method });
            assert.equal(response.status, 405);
            assert.equal(response.headers.get("access-control-allow-origin"), null);
            assert.equal(response.headers.get("allow"), "POST");
        }
    });
    await t.test("sem segredo correto e com Origin de navegador não acessa a IA", async () => {
        for (const value of ["", "sec_test_wrong_secret"]) {
            const { response, body } = await request({ action: "generate", prompt: "sec_test_prompt" }, { headers: { "X-Lumuz-Bridge-Secret": value } });
            assert.equal(response.status, 401);
            assert.deepEqual(body, { success: false, error: "Autenticação necessária." });
            assert.equal(response.headers.get("cache-control"), "no-store");
            assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        }
        assert.equal((await request({}, { headers: { Origin: "https://sec-test.invalid" } })).response.status, 403);
    });
    await t.test("configuração ausente ou segredo fraco falha fechada", async () => {
        for (const secret of ["", "sec_test_short"]) {
            const unconfigured = await startBridge(t, secret);
            assert.equal((await unconfigured({ action: "check_status" })).response.status, 503);
        }
    });
    await t.test("JSON, tipos, profundidade, tamanho, modelo e ações têm limites no servidor", async () => {
        for (const [data, options, expected] of [
            [{}, { headers: { "Content-Type": "text/plain" } }, 415],
            [{}, { raw: "{" }, 400],
            [[], {}, 400],
            [{ action: "clear_cache", force: true }, {}, 400],
            [{ action: "generate", prompt: 123 }, {}, 400],
            [{ action: "generate", prompt: "sec_test_prompt", system: {} }, {}, 400],
            [{ action: "generate", prompt: "a".repeat(12001) }, {}, 400],
            [{ action: "generate", prompt: "sec_test_prompt", system: "a".repeat(8001) }, {}, 400],
            [{ action: "generate", prompt: "sec_test_prompt", model: "sec_test_unapproved" }, {}, 400],
            [{ action: "generate", prompt: "sec_test_prompt", host: "http://169.254.169.254" }, {}, 400],
            [{ action: "generate", prompt: "a".repeat(33000) }, {}, 413],
            [{}, { raw: '{"action":"generate","prompt":' + "[".repeat(12) + '"sec_test"' + "]".repeat(12) + "}" }, 400]
        ]) {
            assert.equal((await request(data, options)).response.status, expected);
        }
    });

    const received = [];
    const upstream = http.createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const input = raw ? JSON.parse(raw) : null;
        received.push({ path: req.url, input });
        res.setHeader("Content-Type", "application/json");
        if (input?.prompt === "sec_test_huge") return res.end(JSON.stringify({ response: "a".repeat(17000) }));
        if (input?.prompt === "sec_test_redirect") { res.writeHead(302, { Location: "http://169.254.169.254/" }); return res.end(); }
        if (input?.prompt === "sec_test_error") { res.writeHead(500); return res.end('{"error":"sec_test_private_path"}'); }
        res.end(JSON.stringify(req.url === "/api/tags" ? { models: [{ name: "sec_test_private_model" }] } : { response: "sec_test_resposta", context: ["sec_test_internal"], private: "sec_test_private" }));
    });
    const stubbed = await new Promise(resolve => {
        upstream.once("error", error => { if (error.code === "EADDRINUSE") resolve(false); else throw error; });
        upstream.listen(11434, "127.0.0.1", () => resolve(true));
    });
    if (!stubbed) {
        await t.test("fluxo com upstream sintético", { skip: "Porta 11434 ocupada; nenhum serviço existente foi acessado" }, () => {});
        return;
    }
    t.after(() => close(upstream));

    await t.test("fluxo legítimo mantém destino e modelo fixos sem expor internals", async () => {
        const generated = await request({ action: "generate", model: "llama3.2:1b", prompt: "sec_test_prompt", system: "sec_test_system" });
        assert.equal(generated.response.status, 200, generated.diagnostics);
        assert.deepEqual(generated.body, { success: true, resposta: "sec_test_resposta" });
        assert.equal(received[0].path, "/api/generate");
        assert.deepEqual(received[0].input.options, { num_predict: 1024, num_ctx: 4096 });
        assert.equal(received[0].input.stream, false);
        assert.equal(received[0].input.model, "llama3.2:1b");
        const status = await request({ action: "check_status" });
        assert.equal(status.response.status, 200);
        assert.deepEqual(status.body, { success: true, online: true });
    });
    await t.test("saída excessiva, erros e redirects do upstream são rejeitados sem detalhes", async () => {
        for (const prompt of ["sec_test_huge", "sec_test_redirect", "sec_test_error"]) {
            const { response, body } = await request({ action: "generate", prompt });
            assert.equal(response.status, 502);
            assert.equal(body.success, false);
            assert.doesNotMatch(JSON.stringify(body), /169\.254|sec_test_private/);
        }
    });
    await t.test("orçamento global devolve 429 e Retry-After", async () => {
        let limited;
        for (let attempt = 0; attempt < 31; attempt++) {
            const result = await request({ action: "check_status" });
            if (result.response.status === 429) { limited = result; break; }
            assert.equal(result.response.status, 200);
        }
        assert.ok(limited, "Limite de 30/min alcançado");
        assert.ok(Number(limited.response.headers.get("retry-after")) >= 1);
    });
});