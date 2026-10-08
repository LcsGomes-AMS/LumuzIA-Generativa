const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const frontend = path.join(__dirname, "../frontend");
const flush = () => new Promise(resolve => setImmediate(resolve));

// Executa os módulos reais com Firebase, DOM e rede simulados.
function harness({ signOutError, importError } = {}) {
    const auth = { currentUser: null };
    const observers = new Set();
    const attributes = new Map();
    const events = new Map();
    const redirects = [], requests = [], responses = [], tokenRequests = [];
    let signOutCalls = 0, reloadCalls = 0;
    const root = {
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        hasAttribute: name => attributes.has(name)
    };
    const context = vm.createContext({
        Headers, console: { error() {} },
        document: { documentElement: root },
        window: {
            location: { replace: url => redirects.push(url), reload: () => { reloadCalls++; } },
            addEventListener: (name, callback) => events.set(name, callback)
        },
        fetch: async (url, options) => {
            requests.push({ url, ...options });
            assert.ok(responses.length, "Requisição inesperada");
            const response = responses.shift();
            if (response instanceof Error) throw response;
            return response;
        }
    });
    const onAuthStateChanged = (_auth, next, error) => {
        const observer = { next, error };
        observers.add(observer);
        return () => observers.delete(observer);
    };
    const signOut = async () => {
        signOutCalls++;
        if (signOutError) throw signOutError;
        auth.currentUser = null;
    };
    const modules = new Map();
    const synthetic = (name, exports) => modules.set(name, new vm.SyntheticModule(
        Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, { context }
    ));
    synthetic("config", { auth });
    synthetic("firebase", { onAuthStateChanged, signOut });
    function getModule(name) {
        if (!modules.has(name)) modules.set(name, new vm.SourceTextModule(
            fs.readFileSync(path.join(frontend, "js", name), "utf8"), { context, identifier: name }
        ));
        return modules.get(name);
    }
    function linker(specifier) {
        if (specifier === "./config.js") return modules.get("config");
        if (specifier.startsWith("https://www.gstatic.com/")) return modules.get("firebase");
        return getModule(specifier.replace("./", ""));
    }
    async function load(name) {
        const module = getModule(name);
        if (module.status === "unlinked") await module.link(linker);
        if (module.status === "linked") await module.evaluate();
        return module.namespace;
    }
    return {
        auth, root, observers, redirects, requests, responses, tokenRequests, load,
        get signOutCalls() { return signOutCalls; },
        get reloadCalls() { return reloadCalls; },
        user(overrides = {}) {
            return {
                uid: "sec_test_user", isAnonymous: false,
                async getIdToken(refresh = false) {
                    tokenRequests.push(refresh);
                    return refresh ? "refreshed-token" : "initial-token";
                }, ...overrides
            };
        },
        async emit(user) {
            auth.currentUser = user;
            await Promise.resolve();
            for (const observer of [...observers]) observer.next(user);
            await flush();
        },
        async guard() {
            new vm.Script(fs.readFileSync(path.join(frontend, "js/auth-guard.js"), "utf8"), {
                importModuleDynamically: async () => {
                    if (importError) throw importError;
                    await load("session.js");
                    return getModule("session.js");
                }
            }).runInContext(context);
            await flush();
        },
        async event(name, data = {}) {
            events.get(name)?.(data);
            await flush();
        }
    };
}

test("a API aguarda a restauração da sessão antes de enviar dados", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    h.responses.push({ status: 200 });
    const pending = api.apiFetch("/receitas/sec_test_user");
    await flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.redirects.length, 0);
    await h.emit(h.user());
    assert.equal((await pending).status, 200);
    assert.equal(h.observers.size, 0);
});

for (const account of ["ausente", "anônima"]) {
    test(`conta ${account} não pode enviar requisições`, async () => {
        const h = harness();
        const api = await h.load("apiClient.js");
        const pending = assert.rejects(api.apiFetch("/gastos"));
        await h.emit(account === "anônima" ? h.user({ isAnonymous: true }) : null);
        await pending;
        assert.equal(h.requests.length, 0);
        assert.equal(h.redirects.at(-1), "./cad.html");
        assert.ok(h.root.hasAttribute("data-auth-pending"));
    });
}

test("a identidade Firebase prevalece sobre headers fornecidos pela chamada", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    await h.emit(h.user());
    h.responses.push({ status: 200 });
    await api.apiFetch("/metas/1", {
        method: "DELETE",
        headers: new Headers({ Authorization: "Bearer forged", "X-App": "test" })
    });
    assert.equal(h.requests[0].method, "DELETE");
    assert.equal(h.requests[0].headers.get("Authorization"), "Bearer initial-token");
    assert.equal(h.requests[0].headers.get("X-App"), "test");
});

test("401 renova o token uma vez e preserva corpo e método", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    await h.emit(h.user());
    h.responses.push({ status: 401 }, { status: 200 });
    assert.equal((await api.apiFetch("/gastos/1", { method: "PUT", body: "{}" })).status, 200);
    assert.deepEqual(h.tokenRequests, [false, true]);
    assert.equal(h.requests[1].headers.get("Authorization"), "Bearer refreshed-token");
    assert.equal(h.requests[1].method, "PUT");
    assert.equal(h.requests[1].body, "{}");
    assert.equal(h.signOutCalls, 0);
});

test("um segundo 401 encerra a sessão e bloqueia o conteúdo", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    await h.emit(h.user());
    h.responses.push({ status: 401 }, { status: 401 });
    await assert.rejects(api.apiFetch("/gastos"));
    assert.equal(h.requests.length, 2);
    assert.equal(h.signOutCalls, 1);
    assert.equal(h.auth.currentUser, null);
    assert.equal(h.redirects.at(-1), "./cad.html");
    assert.ok(h.root.hasAttribute("data-auth-pending"));
});

test("falha de rede ou falta de permissão não apaga uma sessão válida", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    await h.emit(h.user());
    h.responses.push({ status: 403 }, new Error("offline"));
    assert.equal((await api.apiFetch("/gastos")).status, 403);
    await assert.rejects(api.apiFetch("/gastos"), /offline/);
    assert.equal(h.signOutCalls, 0);
    assert.equal(h.redirects.length, 0);
});

test("erro de token revogado encerra a sessão", async () => {
    const h = harness();
    const api = await h.load("apiClient.js");
    await h.emit(h.user({
        getIdToken: async () => { throw Object.assign(new Error("expired"), { code: "auth/user-token-expired" }); }
    }));
    await assert.rejects(api.apiFetch("/gastos"));
    assert.equal(h.signOutCalls, 1);
    assert.equal(h.requests.length, 0);
});

test("saída redireciona mesmo se o Firebase não conseguir encerrar a sessão", async () => {
    const h = harness({ signOutError: new Error("offline") });
    const session = await h.load("session.js");
    await session.endSession();
    assert.equal(h.signOutCalls, 1);
    assert.equal(h.redirects.at(-1), "./cad.html");
    assert.ok(h.root.hasAttribute("data-auth-pending"));
});

test("páginas ficam ocultas até autenticar e voltam a bloquear após sair", async () => {
    const h = harness();
    await h.guard();
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    await h.emit(h.user());
    assert.equal(h.root.hasAttribute("data-auth-pending"), false);
    await h.emit(null);
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    assert.equal(h.redirects.at(-1), "./cad.html");
});

test("voltar pelo histórico após logout não revela o conteúdo", async () => {
    const h = harness();
    await h.guard();
    await h.emit(h.user());
    await h.event("pagehide");
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    h.auth.currentUser = null;
    await h.event("pageshow", { persisted: true });
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    assert.equal(h.reloadCalls, 1);
});

test("histórico com sessão válida recarrega o DOM para evitar dados de outra conta", async () => {
    const h = harness();
    await h.guard();
    await h.emit(h.user());
    await h.event("pagehide");
    await h.event("pageshow", { persisted: true });
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    assert.equal(h.reloadCalls, 1);
});

test("falha ao carregar Firebase mantém a página bloqueada", async () => {
    const h = harness({ importError: new Error("offline") });
    await h.guard();
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    assert.equal(h.redirects.at(-1), "./cad.html");
});

test("o guard recusa sessão anônima e encerra o acesso", async () => {
    const h = harness();
    await h.guard();
    await h.emit(h.user({ isAnonymous: true }));
    assert.equal(h.signOutCalls, 1);
    assert.ok(h.root.hasAttribute("data-auth-pending"));
    assert.equal(h.redirects.at(-1), "./cad.html");
});

// Middleware real, com verificador Firebase simulado e sem credenciais ou rede.
function middleware() {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "firebaseAdmin.js"), "utf8"), {
        module, __dirname, console: { error() {}, warn() {} },
        process: { env: { NODE_ENV: "production" }, cwd: () => __dirname },
        require(name) {
            if (name === "firebase-admin/app") return { getApps: () => [{}] };
            if (name === "firebase-admin/auth") return { getAuth: () => ({
                async verifyIdToken(token) {
                    if (token === "registered") return { uid: "sec_test_user", firebase: { sign_in_provider: "password" } };
                    if (token === "anonymous") return { uid: "sec_test_guest", firebase: { sign_in_provider: "anonymous" } };
                    throw new Error("invalid token");
                }
            }) };
            if (name === "fs") return { existsSync: () => false };
            if (name === "path") return path;
            throw new Error(`Dependência inesperada: ${name}`);
        }
    });
    return module.exports;
}

test("servidor exige conta em todas as funcionalidades sem acessar banco real", async t => {
    const dbPath = require.resolve("./database");
    const authPath = require.resolve("./firebaseAdmin");
    const savedDb = require.cache[dbPath], savedAuth = require.cache[authPath];
    let queries = 0;
    const db = {
        db: null, isPostgres: false,
        dbGet: async () => { queries++; return { total: 0 }; },
        dbAll: async () => { queries++; return []; },
        dbRun: async () => { throw new Error("Este teste não deve gravar no banco"); }
    };
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: middleware() };
    let app;
    try { app = require("./server"); }
    finally {
        if (savedDb) require.cache[dbPath] = savedDb; else delete require.cache[dbPath];
        if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
    }
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (route, options) => fetch(base + route, options);

    const root = await request("/", { redirect: "manual" });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/cad.html");

    for (const file of ["cad.html", "reset-password.html"]) {
        assert.equal((await request("/" + file)).status, 200);
    }
    const protectedPages = fs.readdirSync(frontend)
        .filter(file => file.endsWith(".html") && !["cad.html", "reset-password.html", "index.html"].includes(file));
    for (const file of protectedPages) {
        const response = await request("/" + file);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /<html[^>]*data-auth-pending/);
        assert.match(html, /html\[data-auth-pending\] body\s*\{\s*display:\s*none !important/);
        assert.match(html, /<script[^>]+src="\.\/js\/auth-guard.js"/);
        assert.match(html, /<noscript><meta[^>]+cad.html/);
    }

    const routes = [
        ["GET", "/api/db-status"], ["GET", "/dashboard/sec_test_user"],
        ["GET", "/receitas/sec_test_user"], ["POST", "/receitas"],
        ["GET", "/gastos/sec_test_user"], ["POST", "/gastos"],
        ["GET", "/metas/sec_test_user"], ["DELETE", "/metas/1"],
        ["GET", "/estatisticas/sec_test_user"], ["POST", "/perfil"],
        ["GET", "/agendamentos/sec_test_user"], ["POST", "/agendamentos"],
        ["GET", "/investimentos/sec_test_user"], ["POST", "/investimentos"],
        ["GET", "/api/cotacao/PETR4"], ["GET", "/api/investimentos/cotacoes/sec_test_user"],
        ["GET", "/api/investimentos/historico/sec_test_user"],
        ["GET", "/api/chat/conversas/sec_test_user"], ["POST", "/api/ia/chat"]
    ];
    for (const [method, route] of routes) {
        const response = await request(route, { method });
        assert.equal(response.status, 401, `${method} ${route}`);
        assert.equal((await response.json()).success, false);
    }
    for (const headers of [
        { Authorization: "Bearer invalid" },
        { Authorization: "Bearer anonymous" },
        { Authorization: "Basic registered" },
        { Authorization: "Bearer registered extra" },
        { "x-test-uid": "sec_test_user" }
    ]) {
        assert.equal((await request("/api/db-status", { headers })).status, 401);
    }
    assert.equal(queries, 0, "Acesso recusado não deve consultar o banco");

    const valid = await request("/api/db-status", { headers: { Authorization: "Bearer registered" } });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).status, "online");
    assert.equal(queries, 4);
    const wrongUser = await request("/receitas/another-user", { headers: { Authorization: "Bearer registered" } });
    assert.equal(wrongUser.status, 403);
});
