const admin = require("firebase-admin");
const path = require("path");

// =====================================================================
// Inicialização do Firebase Admin SDK
// =====================================================================
// Baixe a chave de serviço em:
// Firebase Console > Configurações do projeto > Contas de serviço > Gerar nova chave privada
//
// NUNCA coloque esse arquivo no git. Adicione ao .gitignore:
//   serviceAccountKey.json
//
const rawPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";

// Resolve relativo à pasta onde o processo Node foi iniciado (ex: backend/,
// se você roda "node server.js" de dentro dela) — e não relativo a este
// arquivo, que fica em backend/middleware/.
const serviceAccountPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
    });
}

// =====================================================================
// Middleware: exige um token Firebase válido em todas as rotas
// =====================================================================
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            success: false,
            error: "Token de autenticação ausente. Envie o header Authorization: Bearer <idToken>.",
        });
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.uid = decoded.uid;
        req.userEmail = decoded.email || null;
        next();
    } catch (err) {
        console.error("Falha ao verificar token Firebase:", err.message);
        return res.status(401).json({
            success: false,
            error: "Token inválido ou expirado.",
        });
    }
}

// =====================================================================
// Middleware opcional: valida que :userId na URL bate com o token
// =====================================================================
function ensureOwnUserId(req, res, next) {
    const paramUserId = req.params.userId;
    if (paramUserId && paramUserId !== req.uid) {
        return res.status(403).json({
            success: false,
            error: "Acesso negado: você só pode acessar seus próprios dados.",
        });
    }
    next();
}

module.exports = { requireAuth, ensureOwnUserId };