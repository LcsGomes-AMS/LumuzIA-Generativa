const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Middleware: valida o Firebase ID token enviado no header Authorization.
// Se válido, define req.uid com o UID real do usuário autenticado.
async function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!token) {
        return res.status(401).json({ success: false, error: "Token não fornecido." });
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.uid = decoded.uid;
        next();
    } catch (err) {
        console.error("Erro ao verificar token:", err.message);
        return res.status(401).json({ success: false, error: "Token inválido ou expirado." });
    }
}

module.exports = { verificarAutenticacao, admin };