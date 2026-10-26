"use strict";
const router = require("express").Router();
const service = require("./education-service");
const certificates = require("./certificate-service");
const db = require("../database");
const handle = fn => async (req, res, next) => {
    try { await service.initialize(); await fn(req, res); }
    catch (error) {
        if (error.education) return res.status(error.status).json({ success: false, error: error.message });
        next(error);
    }
};
function body(req, allowed = []) {
    if (Object.keys(req.body).some(key => !allowed.includes(key))) service.fail(400, "Campos não permitidos.");
}
router.get("/trilha", handle(async (req, res) => {
    res.json({ modules: service.modules, progress: await service.progress(req.uid), recommendations: await service.recommendations(req.uid) });
}));
router.get("/progresso", handle(async (req, res) => res.json(await service.progress(req.uid))));
router.get("/task/:id", handle(async (req, res) => res.json(service.publicTask(await service.unlocked(req.uid, req.params.id)))));
router.post("/task/:id/responder", handle(async (req, res) => {
    body(req, ["answer"]);
    res.json(await service.answer(req.uid, req.params.id, req.body.answer));
}));
router.post("/task/:id/concluir", handle(async (req, res) => {
    body(req);
    res.json(await service.complete(req.uid, req.params.id));
}));
router.post("/certificado", handle(async (req, res) => {
    body(req);
    const certificate = await certificates.issue(req.uid);
    res.json({ name: certificate.name, code: certificate.certificate_code, completedAt: certificate.completed_at });
}));
router.get("/certificado/pdf", handle(async (req, res) => {
    const certificate = await db.dbGet("SELECT * FROM education_certificates WHERE user_id = ?", [req.uid]);
    if (!certificate) service.fail(404, "Emita seu certificado antes de baixar o PDF.");
    const buffer = await certificates.pdf(certificate);
    res.type("application/pdf").attachment(`${certificate.certificate_code}.pdf`).send(buffer);
}));
// A verificação continua autenticada e não divulga nome ou código de outras contas.
router.get("/certificado/:codigo", handle(async (req, res) => {
    if (!/^LUMUZ-EF-[A-F0-9]{24}$/.test(req.params.codigo)) service.fail(400, "Código inválido.");
    const certificate = await db.dbGet("SELECT * FROM education_certificates WHERE certificate_code = ? AND user_id = ?", [req.params.codigo, req.uid]);
    if (!certificate) service.fail(404, "Certificado não encontrado.");
    res.json({ valid: true, name: certificate.name, completedAt: certificate.completed_at, course: "LumuzIA Educação Financeira" });
}));
module.exports = router;
