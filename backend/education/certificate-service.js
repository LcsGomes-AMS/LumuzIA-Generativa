"use strict";
const { randomBytes, randomUUID } = require("node:crypto");
const path = require("node:path");
const service = require("./education-service");
const db = require("../database");

async function issue(uid, resolveDisplayName = async id => {
    const { getAuth } = require("firebase-admin/auth");
    return (await getAuth().getUser(id)).displayName;
}) {
    await service.initialize();
    if (!(await service.progress(uid)).complete) service.fail(403, "Conclua toda a trilha para emitir seu certificado.");
    const existing = await db.dbGet("SELECT * FROM education_certificates WHERE user_id = ?", [uid]);
    if (existing) return existing;
    const profile = await db.dbGet("SELECT nome FROM users WHERE id = ?", [uid]);
    const name = (profile?.nome?.trim() || await resolveDisplayName(uid) || "").trim().normalize("NFC");
    if (!name || name.length > 100 || /[\x00-\x1f\x7f]/u.test(name)) service.fail(409, "Atualize seu nome no perfil antes de emitir o certificado.");
    return service.mutation(uid, async tx => {
        const saved = await tx.dbGet("SELECT * FROM education_certificates WHERE user_id = ?", [uid]);
        if (saved) return saved;
        if (!(await service.progress(uid, tx)).complete) service.fail(403, "Conclua toda a trilha.");
        const now = new Date().toISOString();
        const last = await tx.dbGet("SELECT MAX(completed_at) AS completed_at FROM education_progress WHERE user_id = ?", [uid]);
        const certificate = { id: randomUUID(), user_id: uid, certificate_code: `LUMUZ-EF-${randomBytes(12).toString("hex").toUpperCase()}`,
            name, completed_at: last.completed_at, issued_at: now };
        await tx.dbRun("INSERT INTO education_certificates (id,user_id,certificate_code,name,completed_at,issued_at) VALUES (?,?,?,?,?,?)",
            Object.values(certificate));
        return certificate;
    });
}

function pdf(certificate) {
    const PDFDocument = require("pdfkit");
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 50,
            info: { Title: "LumuzIA Educação Financeira - Certificado de Conclusão", Author: "LumuzIA" } });
        const chunks = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("error", reject);
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#101c29");
        doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(2).stroke("#6FE7A0");
        doc.image(path.join(__dirname, "../../frontend/img/LumuzIA.png"), 55, 45, { fit: [100, 60] });
        const font = process.platform === "win32" ? "C:/Windows/Fonts/arial.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
        if (require("node:fs").existsSync(font)) doc.font(font);
        const line = (text, y, size, color = "#FFFFFF") => doc.fillColor(color).fontSize(size).text(text, 60, y, { width: doc.page.width - 120, align: "center" });
        line("LumuzIA", 67, 22, "#6FE7A0");
        line("Certificado de Conclusão", 145, 30);
        line("Certificamos que", 205, 15);
        line(certificate.name, 240, certificate.name.length > 50 ? 20 : 27, "#6FE7A0");
        line("concluiu com sucesso a trilha", 315, 15);
        line("LumuzIA Educação Financeira", 348, 23);
        line("demonstrando conhecimento nos fundamentos de organização financeira,", 395, 12);
        line("orçamento, planejamento e investimentos.", 415, 12);
        line(`Conclusão: ${new Date(certificate.completed_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 465, 12);
        line(`Código: ${certificate.certificate_code}`, 490, 10);
        doc.end();
    });
}
module.exports = { issue, pdf };
