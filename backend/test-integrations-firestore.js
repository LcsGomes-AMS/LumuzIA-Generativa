const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const java = process.env.JAVA_BINARY;
const jar = process.env.FIRESTORE_EMULATOR_JAR;
const project = "demo-lumuz-security";
const owner = "sec_test_owner";
const other = "sec_test_other";
const email = "sec_test_owner@example.invalid";

function token(uid = owner, provider = "password") {
    const now = Math.floor(Date.now() / 1000);
    const b64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    return b64({ alg: "none", typ: "JWT" }) + "." + b64({
        iss: "https://securetoken.google.com/" + project, aud: project,
        sub: uid, user_id: uid, email: uid === owner ? email : "sec_test_other@example.invalid",
        iat: now, exp: now + 3600,
        firebase: { sign_in_provider: provider, identities: {} }
    }) + ".";
}
const document = fields => ({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key, value === null ? { nullValue: null } : typeof value === "boolean" ? { booleanValue: value } : { stringValue: value }
])) });

test("regras Firestore isolam perfis no emulador oficial, sem Firebase real", {
    skip: !java || !jar ? "Defina JAVA_BINARY (Java 21+) e FIRESTORE_EMULATOR_JAR para executar o emulador local" : false,
    timeout: 120000
}, async t => {
    assert.ok(fs.existsSync(java), "Binário Java existe");
    assert.ok(fs.existsSync(jar), "Emulador Firestore existe");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sec_test_firestore_"));
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const env = { GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project };
    for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
    const child = spawn(java, ["-Duser.language=en", "-jar", jar, "--host", "127.0.0.1", "--port", String(port),
        "--project_id", project, "--single_project_mode", "true", "--rules", path.join(root, "firestore.rules")], {
        cwd: temp, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
    });
    let diagnostics = "";
    const capture = chunk => { diagnostics = (diagnostics + chunk).slice(-20000); };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    t.after(async () => {
        if (child.exitCode === null) {
            const exited = new Promise(resolve => child.once("exit", resolve));
            child.kill();
            await exited;
        }
        assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temp).startsWith("sec_test_firestore_"));
        fs.rmSync(temp, { recursive: true, force: true });
    });
    const base = "http://127.0.0.1:" + port;
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
        if (child.exitCode !== null) break;
        try { await fetch(base + "/"); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, "Emulador iniciou: " + diagnostics);
    const compiled = await fetch(base + "/emulator/v1/projects/" + project + ":securityRules", {
        method: "PUT", body: JSON.stringify({ rules: { files: [{ content: fs.readFileSync(path.join(root, "firestore.rules"), "utf8") }] } })
    });
    assert.equal(compiled.status, 200, await compiled.text());

    async function request(collection, uid, { method = "GET", auth = token(), fields, list = false } = {}) {
        const response = await fetch(base + "/v1/projects/" + project + "/databases/(default)/documents/" + collection +
            (list ? "" : "/" + uid), {
            method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + auth } : {}) },
            ...(fields ? { body: JSON.stringify(document(fields)) } : {})
        });
        const body = await response.json();
        return { status: response.status, body };
    }
    for (const collection of ["users", "usuarios"]) {
        await t.test(collection + ": dono cria, lê e atualiza nome/foto", async () => {
            assert.equal((await request(collection, owner, { method: "PATCH", fields: { name: "sec_test_name", email } })).status, 200);
            const own = await request(collection, owner);
            assert.equal(own.status, 200);
            assert.equal(own.body.fields.name.stringValue, "sec_test_name");
            assert.equal((await request(collection, owner, { method: "PATCH", fields: {
                displayName: "sec_test_display", email, photoURL: "data:image/jpeg;base64,c2VjX3Rlc3Q="
            } })).status, 200);
            assert.equal((await request(collection, owner, { method: "PATCH", fields: { photoURL: null } })).status, 200);
        });
        await t.test(collection + ": outra conta, anônimo e ausência de token não leem nem alteram", async () => {
            for (const auth of [token(other), token(owner, "anonymous"), null]) {
                for (const method of ["GET", "PATCH", "DELETE"]) {
                    const out = await request(collection, owner, { method, auth, ...(method === "PATCH" ? { fields: { name: "sec_test_forged" } } : {}) });
                    assert.equal(out.status, 403, JSON.stringify(out.body));
                }
            }
            assert.equal((await request(collection, other, { method: "PATCH", fields: { name: "sec_test_foreign" } })).status, 403);
        });
        await t.test(collection + ": listagem, campos extras, email divergente, imagens e nomes inválidos são negados", async () => {
            assert.equal((await request(collection, owner, { list: true })).status, 403);
            for (const fields of [
                { name: "sec_test_name", admin: true },
                { email: "sec_test_forged@example.invalid" },
                { name: "a".repeat(121) },
                { displayName: "a".repeat(121) },
                { photoURL: "javascript:sec_test()" },
                { photoURL: "https://sec-test.invalid/photo.svg" },
                { photoURL: "data:image/svg+xml;base64,c2VjX3Rlc3Q=" },
                { photoURL: "data:image/jpeg;base64," + "a".repeat(200001) }
            ]) {
                const out = await request(collection, owner, { method: "PATCH", fields });
                assert.equal(out.status, 403, JSON.stringify(out.body));
            }
        });
        await t.test(collection + ": dono pode excluir apenas seu documento", async () => {
            assert.equal((await request(collection, owner, { method: "DELETE" })).status, 200);
            assert.equal((await request(collection, owner)).status, 404);
        });
    }
    await t.test("coleções não declaradas e subcoleções seguem negadas", async () => {
        assert.equal((await request("admin", owner, { method: "PATCH", fields: { name: "sec_test_blocked" } })).status, 403);
        assert.equal((await request("users/" + owner + "/private", owner, { method: "PATCH", fields: { name: "sec_test_blocked" } })).status, 403);
    });
});