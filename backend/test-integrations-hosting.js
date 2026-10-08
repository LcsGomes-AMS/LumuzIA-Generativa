const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const httpd = process.env.HTTPD_BINARY || (process.platform === "win32" ? "C:/xampp/apache/bin/httpd.exe" : "");
test("Apache aplica default-deny na raiz do bridge", { skip: !httpd || !fs.existsSync(httpd) ? "Defina HTTPD_BINARY para validar Apache local" : false }, async t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sec_test_apache_"));
    const web = path.join(temp, "public");
    fs.mkdirSync(web);
    fs.copyFileSync(path.join(root, ".htaccess"), path.join(web, ".htaccess"));
    fs.writeFileSync(path.join(web, "index.php"), "sec_test_bridge");
    const blocked = [".env", ".env.production", ".git/config", "backend/server.js", "backend/serviceAccountKey.json", "lumuzia.db", "backup-v0.88.zip", "backup-v0.93.zip", "package.json", "firestore.rules", "frontend/cad.html"];
    for (const name of blocked) {
        const destination = path.join(web, name);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, "sec_test_marker");
    }
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const apacheRoot = path.resolve(path.dirname(httpd), "..").replaceAll("\\", "/");
    const safe = value => value.replaceAll("\\", "/");
    const config = [
        'ServerRoot "' + apacheRoot + '"',
        "Listen 127.0.0.1:" + port,
        "ServerName 127.0.0.1",
        'PidFile "' + safe(path.join(temp, "httpd.pid")) + '"',
        'ErrorLog "' + safe(path.join(temp, "error.log")) + '"',
        'LoadModule authz_core_module modules/mod_authz_core.so',
        'LoadModule authz_host_module modules/mod_authz_host.so',
        'LoadModule dir_module modules/mod_dir.so',
        'LoadModule rewrite_module modules/mod_rewrite.so',
        'DocumentRoot "' + safe(web) + '"',
        '<Directory "' + safe(web) + '">',
        "AllowOverride All",
        "Require all granted",
        "</Directory>"
    ].join("\n");
    const configPath = path.join(temp, "httpd.conf");
    fs.writeFileSync(configPath, config);
    const syntax = spawnSync(httpd, ["-t", "-f", configPath], { windowsHide: true, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stdout + syntax.stderr);
    const child = spawn(httpd, ["-X", "-f", configPath], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let diagnostics = "";
    child.stderr.on("data", chunk => { diagnostics = (diagnostics + chunk).slice(-10000); });
    t.after(async () => {
        if (child.exitCode === null) {
            const exited = new Promise(resolve => child.once("exit", resolve));
            child.kill();
            await exited;
        }
        assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temp).startsWith("sec_test_apache_"));
        fs.rmSync(temp, { recursive: true, force: true });
    });
    const base = "http://127.0.0.1:" + port;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) break;
        try { await fetch(base); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.ok(ready, diagnostics + (fs.existsSync(path.join(temp, "error.log")) ? fs.readFileSync(path.join(temp, "error.log"), "utf8") : ""));
    const bridge = await fetch(base + "/index.php");
    assert.equal(bridge.status, 200);
    assert.equal(await bridge.text(), "sec_test_bridge");
    for (const name of blocked) {
        const denied = await fetch(base + "/" + name);
        assert.equal(denied.status, 403, name);
        assert.doesNotMatch(await denied.text(), /sec_test_marker/);
    }
});