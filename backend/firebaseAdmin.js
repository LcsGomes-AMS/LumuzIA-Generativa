const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// O emulador aceita tokens sem assinatura e nunca deve autenticar o servidor real.
if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== "test") {
    throw new Error("O emulador Firebase de autenticação só pode ser usado em testes isolados.");
}

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
        throw new Error("Configuração de credenciais Firebase inválida.");
    }
} else {
    const fs = require("fs");
    const path = require("path");
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const keyPath = configuredPath
        ? path.resolve(process.cwd(), configuredPath)
        : path.join(__dirname, "serviceAccountKey.json");
    if (configuredPath || fs.existsSync(keyPath)) {
        try {
            serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
        } catch {
            throw new Error("Não foi possível carregar as credenciais Firebase configuradas.");
        }
    }
}

if (!getApps().length) {
    const options = {
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || "lumuz-e2f23"
    };
    if (serviceAccount) {
        try {
            options.credential = cert(serviceAccount);
        } catch {
            throw new Error("Configuração de credenciais Firebase inválida.");
        }
    }
    // Sem chave explícita, o SDK usa Application Default Credentials do ambiente.
    // A consulta de revogação também exige credenciais de serviço válidas.
    initializeApp(options);
}

const authAdmin = getAuth();
const AUTH_ERROR = { success: false, error: "Autenticação necessária." };

// A identidade sempre vem de um ID token assinado, ativo e pertencente ao projeto.
async function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.length <= 8192
        ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authHeader)?.[1]
        : null;
    if (!token) return res.status(401).json(AUTH_ERROR);

    try {
        // true verifica também revogação e conta desativada, além da assinatura/expiração.
        const decoded = await authAdmin.verifyIdToken(token, true);
        if (decoded.firebase?.sign_in_provider === "anonymous" ||
            typeof decoded.uid !== "string" || !decoded.uid.length || decoded.uid.length > 128 ||
            /[\x00-\x1f\x7f]/.test(decoded.uid)) {
            return res.status(401).json(AUTH_ERROR);
        }
        req.uid = decoded.uid;
        req.userEmail = typeof decoded.email === "string" ? decoded.email : null;
        return next();
    } catch {
        return res.status(401).json(AUTH_ERROR);
    }
}

module.exports = { verificarAutenticacao };