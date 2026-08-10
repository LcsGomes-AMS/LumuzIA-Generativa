const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Coloque o JSON da Service Account na raiz do backend
// e adicione "serviceAccountKey.json" ao seu .gitignore.
const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

const app = initializeApp({
    credential: cert(serviceAccount)
});

const auth = getAuth(app);

/**
 * Middleware que verifica o token do Firebase enviado pelo frontend
 * no header "Authorization: Bearer <token>".
 *
 * Em caso de sucesso, define req.uid com o UID REAL do usuário autenticado.
 * A partir daqui, NUNCA confie em userId vindo de req.params/req.body/req.query —
 * use sempre req.uid.
 */
async function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    if (!token) {
        return res.status(401).json({ success: false, error: "Token de autenticação ausente." });
    }

    try {
        const decoded = await auth.verifyIdToken(token);
        req.uid = decoded.uid;
        next();
    } catch (err) {
        console.error("Erro ao verificar token Firebase:", err.message);
        return res.status(401).json({ success: false, error: "Token inválido ou expirado." });
    }
}

module.exports = { auth, verificarAutenticacao };