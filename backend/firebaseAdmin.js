const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
        console.warn("[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON inválido:", e.message);
    }
} else {
    const fs = require("fs");
    const keyPath = require("path").join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
        try {
            serviceAccount = require(keyPath);
        } catch (e) {
            console.warn("[FirebaseAdmin] Erro ao ler serviceAccountKey.json:", e.message);
        }
    }
}

if (!getApps().length) {
    if (serviceAccount) {
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        // A verificação de ID tokens usa as chaves públicas do projeto Firebase.
        initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "lumuz-e2f23" });
    }
}

const authAdmin = getAuth();

// Middleware: valida o Firebase ID token enviado no header Authorization.
// Se válido, define req.uid com o UID real do usuário autenticado.
async function verificarAutenticacao(req, res, next) {
    // Permite simulação segura de identidade nos testes automatizados de segurança
    if (process.env.NODE_ENV === "test" && req.headers["x-test-uid"]) {
        req.uid = String(req.headers["x-test-uid"]);
        return next();
    }

    const authHeader = req.headers.authorization || "";
    const token = /^Bearer (\S+)$/.exec(authHeader)?.[1];

    if (!token) {
        return res.status(401).json({ success: false, error: "Token não fornecido." });
    }

    try {
        const decoded = await authAdmin.verifyIdToken(token);
        if (decoded.firebase?.sign_in_provider === "anonymous") {
            return res.status(401).json({ success: false, error: "Faça login ou crie uma conta para continuar." });
        }
        req.uid = decoded.uid;
        next();
    } catch (err) {
        console.error("Erro ao verificar token:", err.message);
        return res.status(401).json({ success: false, error: "Token inválido ou expirado." });
    }
}

module.exports = { verificarAutenticacao };