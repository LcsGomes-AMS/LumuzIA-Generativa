const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : require(require("path").join(__dirname, "serviceAccountKey.json"));

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const authAdmin = getAuth();

// Middleware: valida o Firebase ID token enviado no header Authorization.
// Se válido, define req.uid com o UID real do usuário autenticado.
async function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!token) {
        return res.status(401).json({ success: false, error: "Token não fornecido." });
    }

    try {
        const decoded = await authAdmin.verifyIdToken(token);
        req.uid = decoded.uid;
        next();
    } catch (err) {
        console.error("Erro ao verificar token:", err.message);
        return res.status(401).json({ success: false, error: "Token inválido ou expirado." });
    }
}

module.exports = { verificarAutenticacao };