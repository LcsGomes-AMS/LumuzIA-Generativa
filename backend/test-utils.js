"use strict";

// Só testes importam este módulo. Não há cabeçalho de bypass no middleware real.
exports.installTestAuth = function installTestAuth() {
    if (process.env.NODE_ENV !== "test") throw new Error("Mock exclusivo dos testes isolados.");
    const filename = require.resolve("./firebaseAdmin");
    require.cache[filename] = { id: filename, filename, loaded: true, exports: { verificarAutenticacao(req, res, next) {
        const uid = req.headers["x-test-uid"];
        if (typeof uid === "string" && /^sec_test_[A-Za-z0-9_-]{1,100}$/.test(uid)) {
            req.uid = uid;
            return next();
        }
        res.status(401).json({ success: false, error: "Autenticação necessária." });
    } } };
    require("axios").defaults.adapter = async () => { throw new Error("Rede externa bloqueada nos testes."); };
};
