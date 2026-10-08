const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const code = fs.readFileSync(path.join(__dirname, "firebaseAdmin.js"), "utf8");
const TOKEN = "e30.c2VjX3Rlc3Q.c2ln";

function harness({ env = {}, verify } = {}) {
    const calls = [];
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, __dirname, process: { env: { NODE_ENV: "test", ...env }, cwd: () => __dirname },
        require(name) {
            if (name === "firebase-admin/app") return { getApps: () => [{}] };
            if (name === "firebase-admin/auth") return { getAuth: () => ({
                async verifyIdToken(token, checkRevoked) {
                    calls.push({ token, checkRevoked });
                    if (verify) return verify(token, checkRevoked);
                    return { uid: "sec_test_owner", email: "sec_test_owner@example.invalid", firebase: { sign_in_provider: "password" } };
                }
            }) };
            if (name === "fs") return { existsSync: () => false };
            if (name === "path") return path;
            throw new Error("Dependência inesperada: " + name);
        }
    });
    return {
        calls,
        async request(headers = {}) {
            const req = { headers }, res = { statusCode: 0, body: null, status(value) { this.statusCode = value; return this; }, json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; } };
            let passed = false;
            await module.exports.verificarAutenticacao(req, res, () => { passed = true; });
            return { req, res, passed };
        }
    };
}

test("identidade de teste não é aceita pelo middleware real, inclusive em NODE_ENV=test", async () => {
    for (const NODE_ENV of ["test", "production", "development"]) {
        const h = harness({ env: { NODE_ENV } });
        const out = await h.request({ "x-test-uid": "sec_test_forged" });
        assert.equal(out.res.statusCode, 401);
        assert.equal(out.req.uid, undefined);
        assert.equal(h.calls.length, 0);
    }
});

test("tokens ausentes, malformados, esquema errado e headers excessivos não chegam ao Firebase", async () => {
    const h = harness();
    for (const authorization of [undefined, "", "Bearer opaque", "Bearer a.b", "Bearer a.b.c.d", "Basic " + TOKEN, "Bearer " + TOKEN + " extra", "Bearer " + TOKEN + ", Bearer " + TOKEN, ["Bearer " + TOKEN], "Bearer " + "a".repeat(8193)]) {
        const out = await h.request({ authorization });
        assert.equal(out.res.statusCode, 401);
        assert.equal(out.passed, false);
        assert.deepEqual(out.res.body, { success: false, error: "Autenticação necessária." });
    }
    assert.equal(h.calls.length, 0);
});

test("sessão válida usa UID verificado e consulta revogação", async () => {
    const h = harness();
    const out = await h.request({ authorization: "Bearer " + TOKEN, "x-test-uid": "sec_test_forged" });
    assert.equal(out.passed, true);
    assert.equal(out.req.uid, "sec_test_owner");
    assert.deepEqual(h.calls, [{ token: TOKEN, checkRevoked: true }]);
});

test("contas anônimas, UID inválido e tokens revogados recebem falha uniforme", async () => {
    for (const verify of [
        () => ({ uid: "sec_test_anonymous", firebase: { sign_in_provider: "anonymous" } }),
        () => ({ uid: "" }),
        () => ({ uid: "a".repeat(129) }),
        () => ({ uid: "sec_test_\nowner" }),
        () => { throw Object.assign(new Error("sec_test_revoked_sensitive_detail"), { code: "auth/id-token-revoked" }); },
        () => { throw Object.assign(new Error("sec_test_disabled_sensitive_detail"), { code: "auth/user-disabled" }); }
    ]) {
        const out = await harness({ verify }).request({ authorization: "Bearer " + TOKEN });
        assert.equal(out.res.statusCode, 401);
        assert.equal(out.passed, false);
        assert.equal(out.req.uid, undefined);
        assert.deepEqual(out.res.body, { success: false, error: "Autenticação necessária." });
    }
});

test("emulador de autenticação é proibido no servidor fora de testes isolados", () => {
    for (const NODE_ENV of ["production", "development", undefined]) {
        assert.throws(() => harness({ env: { NODE_ENV, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" } }), /testes isolados/);
    }
    assert.doesNotThrow(() => harness({ env: { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" } }));
});

test("credencial JSON malformada falha sem expor seu conteúdo", () => {
    assert.throws(() => harness({ env: { FIREBASE_SERVICE_ACCOUNT_JSON: "sec_test_invalid_secret" } }), error =>
        error.message === "Configuração de credenciais Firebase inválida.");
});

test("middleware legado usa o mesmo verificador de autenticação", () => {
    const verifier = () => {};
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "middleware", "auth.js"), "utf8"), {
        module,
        require(name) { assert.equal(name, "../firebaseAdmin"); return { verificarAutenticacao: verifier }; }
    });
    assert.equal(module.exports.requireAuth, verifier);
});