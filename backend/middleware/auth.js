// Todas as rotas usam o mesmo verificador, inclusive as rotas legadas.
const { verificarAutenticacao } = require("../firebaseAdmin");

function ensureOwnUserId(req, res, next) {
    if (req.params.userId && req.params.userId !== req.uid) {
        return res.status(403).json({ success: false, error: "Acesso negado." });
    }
    return next();
}

module.exports = { requireAuth: verificarAutenticacao, ensureOwnUserId };