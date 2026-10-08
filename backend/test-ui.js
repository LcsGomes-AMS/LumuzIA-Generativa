"use strict";
// Testes de cliques no Chrome real; Firebase, banco, IA e cotações simulados.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const express = require("express");
const helmet = require("helmet");
const QUOTE = `D'Ávila "Especial"`;
const today = new Date().toISOString().slice(0, 10);
const state = {
    receitas: [{ id: 201, descricao: QUOTE, valor: 1500, created_at: today }],
    gastos: [{ id: 401, descricao: "Mercado", valor: 90, categoria: "Alimentação", created_at: today }],
    metas: [{ id: 301, nome: QUOTE, valor_objetivo: 1000, valor_atual: 100, prazo: 6, created_at: today }],
    investimentos: [], agendamentos: [], conversas: [], mensagens: {}
};
let nextId = 1000;
const requests = [];
const app = express();
app.use(express.json());
app.use(helmet(require("./security-headers")));
app.get("/favicon.ico", (_req, res) => res.status(204).end());
app.use((req, res, next) => {
    const route = req.path, collection = route.split("/")[1], body = req.body || {};
    const api = ["receitas", "gastos", "metas", "investimentos", "agendamentos"].includes(collection)
        || route.startsWith("/api/") || route.startsWith("/dashboard/") || route.startsWith("/estatisticas/");
    if (!api) return next();
    requests.push({ route, method: req.method, body });
    if (req.headers.authorization !== "Bearer ui-test-token") return res.status(401).json({ success: false });
    const id = Number(route.split("/").at(-1));
    if (route.startsWith("/metas/estimativa/")) return res.json({ mediaMensal: 300, baseMeses: 3 });
    if (route.startsWith("/api/investimentos/historico/")) return res.json([]);
    if (route.startsWith("/api/investimentos/cotacoes/")) {
        const detalhes = state.investimentos.map(i => ({ ...i, precoAtual: i.precoMedio, valorTotalAtual: i.precoMedio * i.quantidade, lucroOuPrejuizo: 0 }));
        return res.json({ detalhes, valorAtual: detalhes.reduce((s, i) => s + i.valorTotalAtual, 0), rendimento: 0, crescimentoPercentual: 0 });
    }
    if (route.startsWith("/api/chat/conversas")) {
        if (req.method === "POST") {
            const conversa = { id: ++nextId, titulo: body.titulo, created_at: today };
            state.conversas.unshift(conversa); state.mensagens[conversa.id] = [];
            return res.json({ success: true, conversa });
        }
        if (route.endsWith("/mensagens")) return res.json(state.mensagens[Number(route.split("/").at(-2))] || []);
        if (req.method === "DELETE") {
            state.conversas = state.conversas.filter(c => c.id !== id);
            return res.json({ success: true });
        }
        return res.json(state.conversas);
    }
    if (route === "/api/ia/chat") {
        const resposta = "Resposta simulada para o teste dos botões.";
        (state.mensagens[body.conversaId] ||= []).push({ role: "user", conteudo: body.prompt }, { role: "assistant", conteudo: resposta });
        return res.json({ success: true, resposta });
    }
    if (route.startsWith("/dashboard/")) return res.json({ receitas: 1500, gastos: 90, saldo: 1410 });
    if (route.startsWith("/estatisticas/")) return res.json([{ categoria: "Alimentação", total: 90 }]);
    if (req.method === "PATCH" && collection === "agendamentos") {
        const item = state.agendamentos.find(item => item.id === Number(route.split("/")[2]));
        if (!item) return res.status(404).json({ success: false });
        item.status = route.endsWith("/pago") ? "lancado" : "pendente";
        return res.json({ success: true });
    }
    if (!Object.hasOwn(state, collection)) return res.status(404).json({ error: "API sem mock: " + route });
    if (req.method === "GET") return res.json(state[collection]);
    const mapped = collection === "metas" ? {
        nome: body.nome, valor_objetivo: Number(body.valorObjetivo), valor_atual: Number(body.valorAtual || 0), prazo: Number(body.prazo)
    } : collection === "agendamentos" ? { ...body, data_agendada: body.dataAgendada, status: "pendente" } : { ...body };
    if (req.method === "POST") { state[collection].push({ ...mapped, id: ++nextId, created_at: today }); return res.json({ success: true, id: nextId }); }
    if (req.method === "PUT") { Object.assign(state[collection].find(i => i.id === id), mapped); return res.json({ success: true }); }
    if (req.method === "DELETE") { state[collection] = state[collection].filter(i => i.id !== id); return res.json({ success: true }); }
    return res.status(405).end();
});
app.use(express.static(path.join(__dirname, "../frontend")));
const server = http.createServer(app);

const authMock = `
const makeUser=()=>({uid:"ui-user",email:"teste@example.com",displayName:localStorage.getItem("ui-name")||"Pessoa Teste",isAnonymous:false,providerData:[{providerId:"password"}],metadata:{creationTime:"2026-01-01T12:00:00Z"},getIdToken:async()=>"ui-test-token"});
const listeners=new Set();
const auth=globalThis.__uiAuth ||= {currentUser:localStorage.getItem("ui-auth")==="off"?null:makeUser()};
const emit=()=>{for(const cb of listeners)queueMicrotask(()=>{if(listeners.has(cb))cb(auth.currentUser)})};
export const getAuth=()=>auth;
export function onAuthStateChanged(_a,cb){listeners.add(cb);queueMicrotask(()=>{if(listeners.has(cb))cb(auth.currentUser)});return()=>listeners.delete(cb)}
async function login(){localStorage.setItem("ui-auth","on");auth.currentUser=makeUser();emit();return{user:auth.currentUser}}
export const signInWithEmailAndPassword=login,createUserWithEmailAndPassword=login,signInWithRedirect=login;
export async function signInWithPopup(){if(globalThis.__uiGoogleCancel)throw Object.assign(new Error("cancelled"),{code:"auth/popup-closed-by-user"});return login()}
export const getRedirectResult=async()=>null;
export class GoogleAuthProvider{}
export async function signOut(){localStorage.setItem("ui-auth","off");auth.currentUser=null;emit()}
export async function updateProfile(user,data){Object.assign(user,data);localStorage.setItem("ui-name",user.displayName||"")}
export async function sendPasswordResetEmail(_a,email){globalThis.__uiResetEmail=email}
export const verifyPasswordResetCode=async()=>"teste@example.com";
export async function confirmPasswordReset(){globalThis.__uiPasswordReset=true}
`;
const firestoreMock = `
export const getFirestore=()=>({});
export const doc=(_db,...parts)=>parts.join("/");
export async function getDoc(ref){const data=JSON.parse(localStorage.getItem("ui-doc-"+ref)||"null");return{exists:()=>!!data,data:()=>data}}
export async function setDoc(ref,data,opts){const old=opts?.merge?JSON.parse(localStorage.getItem("ui-doc-"+ref)||"{}"):{};localStorage.setItem("ui-doc-"+ref,JSON.stringify({...old,...data}))}
`;
const pdfMock = `window.jspdf={jsPDF:class{
constructor(){this.lastAutoTable={finalY:100};this.internal={getNumberOfPages:()=>1,pageSize:{getHeight:()=>842}}}
addImage(){}setFont(){}setFontSize(){}setTextColor(){}text(){}addPage(){}setPage(){}
autoTable(o){this.lastAutoTable={finalY:(o.startY||0)+40}}save(name){window.__uiPdfSaved=name}
}};`;
const pdfSources = {}, errors = [], pending = new Map();
let browser, socket, profile, session, origin, serial = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(check, label, timeout = 6000) {
    const end = Date.now() + timeout; let last;
    while (Date.now() < end) { try { if (await check()) return; } catch (error) { last = error; } await delay(40); }
    throw new Error("Tempo esgotado: " + label + (last ? " — " + last.message : ""));
}
function command(method, params = {}, sessionId = session) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
}
async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}
const waitDOM = (expression, label) => poll(() => evaluate(expression), label);
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))})()`);
const button = (text, parent = "body") => evaluate(`(()=>{const b=[...document.querySelector(${JSON.stringify(parent)}).querySelectorAll("button")].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error("Botão ausente: "+${JSON.stringify(text)});b.click()})()`);
async function goto(file, ready = "true") {
    await evaluate("window.__uiDocumentReady=0");
    await command("Page.navigate", { url: origin + "/" + file });
    await waitDOM(`window.__uiDocumentReady===1&&location.pathname.endsWith(${JSON.stringify(file.split("?")[0])})&&document.readyState==="complete"&&(${ready})`, file);
}
async function intercept(params, sessionId) {
    const url = params.request.url; let source = "";
    if (/firebase-app\.js/.test(url)) source = "export const initializeApp=()=>({});";
    else if (/firebase-auth\.js/.test(url)) source = authMock;
    else if (/firebase-firestore\.js/.test(url)) source = firestoreMock;
    else if (/\/npm\/chart\.js/.test(url)) source = "window.Chart=class{constructor(c,o){this.data=o.data;this.options=o.options}destroy(){}update(){}};";
    else if (/jspdf-autotable/.test(url)) source = pdfSources.autotable || "";
    else if (/jspdf/.test(url)) source = pdfSources.jspdf || pdfMock;
    await command("Fetch.fulfillRequest", {
        requestId: params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: params.resourceType === "Stylesheet" ? "text/css" : "application/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }],
        body: Buffer.from(source).toString("base64")
    }, sessionId);
}
async function startBrowser() {
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "lumuzia-ui-"));
    browser = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
        "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
        "--disable-component-update", "--disable-extensions", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--window-size=1365,900", "about:blank"
    ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let endpoint = "", stderr = "";
    browser.on("error", error => { stderr += error.message; });
    browser.stderr.on("data", bytes => { stderr += bytes; endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1] || ""; });
    await poll(() => endpoint, "iniciar Chrome " + stderr, 12000);
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    socket.addEventListener("message", event => {
        const m = JSON.parse(event.data);
        if (m.id) {
            const waiter = pending.get(m.id); if (!waiter) return;
            clearTimeout(waiter.timer); pending.delete(m.id);
            if (m.error) waiter.reject(new Error(m.error.message)); else waiter.resolve(m.result);
        } else if (m.method === "Fetch.requestPaused") intercept(m.params, m.sessionId).catch(e => { if (!e.message.includes("Invalid InterceptionId")) errors.push(e.message); });
        else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
            const text = m.params.args.map(a => a.description || a.value).join(" ");
            if (!text.includes("cancelled")) errors.push(text);
        } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && m.params.entry.source === "security") errors.push(m.params.entry.text);
        else if (m.method === "Page.javascriptDialogOpening") command("Page.handleJavaScriptDialog", { accept: true }, m.sessionId).catch(() => {});
    });
    const target = await command("Target.createTarget", { url: "about:blank" }, null);
    session = (await command("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null)).sessionId;
    for (const method of ["Runtime.enable", "Page.enable", "Log.enable"]) await command(method);
    await command("Fetch.enable", { patterns: [{ urlPattern: "https://*" }] });
    await command("Page.addScriptToEvaluateOnNewDocument", { source: 'window.__uiDocumentReady=1;window.__uiAlerts=[];window.alert=m=>__uiAlerts.push(String(m));window.confirm=()=>true;' });
}
const cases = [
    ["Segurança: CSP estrita e nenhum evento inline nas páginas", async () => {
        const response = await fetch(origin + "/receitas.html");
        const policy = response.headers.get("content-security-policy");
        assert.match(policy, /script-src-attr 'none'/);
        assert.ok(!policy.match(/script-src\s[^;]*'unsafe-inline'/));
        const frontend = path.join(__dirname, "../frontend");
        for (const name of fs.readdirSync(frontend).filter(name => name.endsWith(".html"))) {
            const html = fs.readFileSync(path.join(frontend, name), "utf8");
            assert.ok(!/\son[a-z]+\s*=/i.test(html), name + ": evento inline");
            assert.ok(!/href\s*=\s*["']\s*javascript:/i.test(html), name + ": URL executável");
            assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>\s*[^<]/i.test(html), name + ": script inline");
            if (html.includes("js/auth-guard.js")) assert.match(html, /<html[^>]*data-auth-pending/);
        }
    }],
    ["Receitas: editar, cancelar, salvar e filtrar com aspas", async () => {
        await goto("receitas.html", "document.querySelector('#linha-receita-201 button')");
        await click("#linha-receita-201 button");
        assert.equal(await evaluate("document.querySelector('#editDesc-201').value"), QUOTE);
        await button("Cancelar", "#linha-receita-201");
        await waitDOM("!document.querySelector('#editDesc-201')", "cancelar edição");
        await click("#linha-receita-201 button"); await fill("#editDesc-201", QUOTE + " editada"); await fill("#editValor-201", "1600");
        await button("Salvar", "#linha-receita-201");
        await waitDOM("!document.querySelector('#editDesc-201')", "salvar receita");
        assert.equal(state.receitas[0].valor, 1600); assert.equal(state.receitas[0].descricao, QUOTE + " editada");
        await fill("#filtroReceitaDescricao", "inexistente"); await button("Filtrar");
        await waitDOM("document.querySelector('#contagemReceitas').textContent.startsWith('0 de')", "filtrar receita");
        await button("Limpar filtros"); await waitDOM("document.querySelector('#linha-receita-201')", "limpar receita");
    }],
    ["Metas: guardar, retirar, cancelar e filtrar com aspas", async () => {
        await goto("metas.html", "document.querySelector('.btn-guardar')");
        await click(".btn-guardar");
        assert.ok((await evaluate("document.querySelector('#modalMetaTitulo').textContent")).includes(QUOTE));
        await fill("#modalMetaValor", "50"); await click("#modalMetaConfirmar"); await poll(() => state.metas[0].valor_atual === 150, "guardar");
        await waitDOM("getComputedStyle(document.querySelector('#modalMetaOverlay')).display==='none'", "fechar meta");
        await click(".btn-retirar"); await fill("#modalMetaValor", "25"); await click("#modalMetaConfirmar");
        await poll(() => state.metas[0].valor_atual === 125, "retirar");
        await waitDOM("getComputedStyle(document.querySelector('#modalMetaOverlay')).display==='none'", "fechar retirada");
        await click(".btn-guardar"); await button("Cancelar", "#modalMetaOverlay");
        await waitDOM("getComputedStyle(document.querySelector('#modalMetaOverlay')).display==='none'", "cancelar");
        await fill("#filtroMetaNome", "inexistente"); await button("Filtrar");
        await waitDOM("document.querySelector('#contagemMetas').textContent.startsWith('0 de')", "filtrar metas");
        await button("Limpar filtros"); await waitDOM("document.querySelector('.btn-guardar')", "limpar metas");
    }],
    ["Gastos: salvar, calendário, parcelar e filtros", async () => {
        await goto("gastos.html", "document.querySelector('#calendarioGrid [data-data]')");
        const before = await evaluate("document.querySelector('#calSelectMes').value");
        await click("#calMesProximo"); assert.equal(await evaluate("document.querySelector('#calSelectMes').value"), String((Number(before) + 1) % 12));
        await click("#calMesAnterior"); assert.equal(await evaluate("document.querySelector('#calSelectMes').value"), before);
        await click("#calMesProximo"); await click("#calHoje");
        assert.equal(await evaluate("document.querySelector('#calSelectMes').value"), await evaluate("String(new Date().getMonth())"));
        await click("#calendarioGrid [data-data]"); await waitDOM("getComputedStyle(document.querySelector('#calFormAgendamento')).display!=='none'", "selecionar dia");
        await fill("#descricao", "Gasto de teste"); await fill("#valor", "25"); await click('button[data-action="salvarGasto"]');
        await poll(() => state.gastos.length === 2, "salvar gasto");
        await fill("#filtroGastoDescricao", "inexistente"); await button("Filtrar");
        await waitDOM("document.querySelector('#contagemGastos').textContent.startsWith('0 de')", "filtrar gasto");
        await button("Limpar filtros"); await waitDOM("document.querySelector('#contagemGastos').textContent.startsWith('2 de')", "limpar gasto");
        await fill("#pcDescricao", "Compra teste"); await fill("#pcValorTotal", "100"); await fill("#pcParcelas", "3"); await fill("#pcDataPrimeira", "2030-01-31");
        await button("Parcelar"); await poll(() => state.agendamentos.length === 3, "parcelar");
        assert.equal(state.agendamentos[1].data_agendada, "2030-02-28");
        assert.equal(Math.round(state.agendamentos.reduce((s, a) => s + a.valor, 0) * 100), 10000);
    }],
    ["Investimentos: adicionar, filtrar, limpar e excluir", async () => {
        await goto("investimentos.html", "typeof window.deletarInvestimento==='function'");
        for (const [selector, value] of Object.entries({ "#ticker": "PETR4", "#tipo": "Ação", "#quantidade": "2", "#precoMedio": "30", "#dataCompra": today })) await fill(selector, value);
        await click("#formInvestimento button[type=submit]");
        await waitDOM("document.querySelector('#tabelaInvestimentos').textContent.includes('PETR4')", "adicionar ativo");
        await fill("#filtroInvTicker", "inexistente"); await button("Filtrar");
        await waitDOM("document.querySelector('#contagemInvestimentos').textContent.startsWith('0 de')", "filtrar ativos");
        await button("Limpar filtros"); await waitDOM("document.querySelector('#tabelaInvestimentos button')", "limpar ativos");
        await click("#tabelaInvestimentos button"); await poll(() => state.investimentos.length === 0, "excluir ativo");
    }],
    ["Relatório: aplicar, limpar e gerar PDF", async () => {
        await goto("relatorio.html", "document.querySelector('#tabelaReceitasRel tbody').textContent.includes('Especial')");
        await fill("#filtroInicio", "2000-01-01"); await fill("#filtroFim", "2000-12-31"); await click("#btnAplicarFiltro");
        await waitDOM("document.querySelector('#tabelaReceitasRel tbody').textContent.includes('Nenhuma')", "filtrar relatório");
        await click("#btnLimparFiltro"); await waitDOM("document.querySelector('#tabelaReceitasRel tbody').textContent.includes('Especial')", "limpar relatório");
        if (process.env.UI_REAL_PDF === "1") await evaluate("(()=>{const Original=window.jspdf.jsPDF;window.jspdf.jsPDF=function(...args){const doc=new Original(...args);doc.save=function(name){window.__uiPdfSaved=name;window.__uiPdfBytes=this.output('arraybuffer').byteLength};return doc}})()");
        await click("#btnGerarPdf"); await waitDOM("window.__uiPdfSaved?.endsWith('.pdf')", "PDF");
        if (process.env.UI_REAL_PDF === "1") assert.ok(await evaluate("window.__uiPdfBytes>1000"));
        assert.equal(await evaluate("document.querySelector('#btnGerarPdf').disabled"), false);
    }],
    ["Dashboard: filtros e menu móvel", async () => {
        await goto("dashboard.html", "document.querySelector('#saldo').textContent.includes('1.410')");
        const count = requests.filter(r => r.route.startsWith("/dashboard/")).length;
        await click("#btnFiltrar"); await poll(() => requests.filter(r => r.route.startsWith("/dashboard/")).length > count, "filtrar dashboard");
        await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await click("#hamburger"); assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), true);
        await click("#sidebar-overlay"); assert.equal(await evaluate("document.querySelector('.sidebar').classList.contains('open')"), false);
        await command("Emulation.clearDeviceMetricsOverride");
    }],
    ["Chat: histórico, nova conversa, enviar, abrir e excluir", async () => {
        await goto("chat.html", "document.querySelector('#conversaList').textContent.includes('Nenhuma')");
        await click("#btnOpenHistory"); assert.equal(await evaluate("document.querySelector('#chatHistoryDrawer').classList.contains('open')"), true);
        await click("#btnCloseHistory"); assert.equal(await evaluate("document.querySelector('#chatHistoryDrawer').classList.contains('open')"), false);
        await click("#btnNovaConversa"); await fill("#userInput", "Quero economizar"); await click("#chatForm button[type=submit]");
        await waitDOM("document.querySelector('#chatContainer').textContent.includes('Resposta simulada')", "enviar chat");
        await click("#btnOpenHistory"); await waitDOM("document.querySelector('.conversa-item')", "histórico");
        await click(".conversa-item"); await waitDOM("document.querySelector('#chatContainer').textContent.includes('Quero economizar')", "abrir conversa");
        await click("#btnOpenHistory"); await click(".conversa-item-delete"); await poll(() => state.conversas.length === 0, "excluir conversa");
    }],
    ["Como Usar: configurar, salvar, assistir, fechar e persistir vídeo", async () => {
        await goto("como-usar.html", "document.querySelector('.btn-video-config')");
        await click(".btn-video-config"); await waitDOM("document.querySelector('#configUrlModal').classList.contains('active')", "configurar vídeo");
        await fill("#inputVideoUrl", "https://youtu.be/aqz-KE-bpKQ"); await button("Salvar Vídeo", "#configUrlModal");
        await waitDOM("document.querySelector('#video-container-plataforma iframe')", "salvar vídeo");
        await click('.card-link[data-action="abrirVideoModal"]');
        await waitDOM("document.querySelector('#videoModal').classList.contains('active')", "assistir vídeo");
        assert.ok((await evaluate("document.querySelector('#modalVideoIframe').src")).includes("youtube-nocookie.com/embed/aqz-KE-bpKQ"));
        await button("Fechar", "#videoModal"); await goto("como-usar.html", "document.querySelector('#video-container-plataforma iframe')");
        await click(".btn-video-config"); await button("Cancelar", "#configUrlModal");
        assert.equal(await evaluate("document.querySelector('#configUrlModal').classList.contains('active')"), false);
    }],
    ["Ações delegadas: salvar, agendar, pagar, desmarcar e excluir", async () => {
        const saved = structuredClone(state);
        try {
            await goto("receitas.html", "document.querySelector('#tabelaReceitas button')");
            await fill("#descricao", "sec_test_Receita"); await fill("#valor", "70");
            await click('[data-action="salvarReceita"]');
            await poll(() => state.receitas.some(item => item.descricao === "sec_test_Receita"), "salvar receita");
            const receitaId = state.receitas.find(item => item.descricao === "sec_test_Receita").id;
            const excluirReceita = '[data-action="excluirReceita"][data-id="' + receitaId + '"]';
            await waitDOM("document.querySelector(" + JSON.stringify(excluirReceita) + ")", "render receita");
            await click(excluirReceita); await poll(() => !state.receitas.some(item => item.id === receitaId), "excluir receita");
            await fill("#arDescricao", "sec_test_A receber"); await fill("#arValor", "50"); await fill("#arDias", "3");
            await click('[data-action="salvarAReceber"]');
            await waitDOM("document.querySelector('#tabelaAReceber button')", "agendar recebimento");
            await click('#tabelaAReceber [data-action="excluirAReceber"]');
            await poll(() => !state.agendamentos.some(item => item.descricao === "sec_test_A receber"), "cancelar recebimento");
            await goto("metas.html", "document.querySelector('.btn-guardar')");
            await fill("#nome", "sec_test_Meta"); await fill("#valorObjetivo", "300"); await fill("#prazo", "5");
            await click('[data-action="salvarMeta"]');
            await poll(() => state.metas.some(item => item.nome === "sec_test_Meta"), "criar meta");
            const metaId = state.metas.find(item => item.nome === "sec_test_Meta").id;
            const excluirMeta = '[data-action="excluirMeta"][data-id="' + metaId + '"]';
            await waitDOM("document.querySelector(" + JSON.stringify(excluirMeta) + ")", "render meta");
            await click(excluirMeta); await poll(() => !state.metas.some(item => item.id === metaId), "excluir meta");
            state.agendamentos.push({ id: 777, tipo: "gasto", descricao: "sec_test_Parcela (1/2)", valor: 10, status: "pendente", data_agendada: "2030-01-01" });
            await goto("gastos.html", "document.querySelector('#tabelaParcelas button[data-id=\"777\"]')");
            await click('#tabelaParcelas [data-action="marcarPago"][data-id="777"]');
            await waitDOM("document.querySelector('#tabelaParcelas [data-action=\"desmarcarPago\"][data-id=\"777\"]')", "marcar pago");
            await click('#tabelaParcelas [data-action="desmarcarPago"][data-id="777"]');
            await waitDOM("document.querySelector('#tabelaParcelas [data-action=\"excluirParcela\"][data-id=\"777\"]')", "desmarcar pago");
            await click('#tabelaParcelas [data-action="excluirParcela"][data-id="777"]');
            await poll(() => !state.agendamentos.some(item => item.id === 777), "excluir parcela");
            await click("#calendarioGrid [data-data]"); await fill("#calDescricao", "sec_test_Agendamento"); await fill("#calValor", "15");
            await click('[data-action="salvarAgendamento"]');
            await waitDOM("document.querySelector('#listaAgendamentosDia button')", "agendar dia");
            await click('#listaAgendamentosDia [data-action="deletarAgendamento"]');
            await poll(() => !state.agendamentos.some(item => item.descricao === "sec_test_Agendamento"), "excluir agendamento");
            const gastoId = state.gastos[0].id;
            await click('#tabelaGastos [data-action="excluirGasto"][data-id="' + gastoId + '"]');
            await poll(() => !state.gastos.some(item => item.id === gastoId), "excluir gasto");
        } finally { Object.assign(state, saved); }
    }],
    ["Perfil: upload raster e remoção preservados; SVG rejeitado", async () => {
        await goto("perfil.html", "getComputedStyle(document.querySelector('#lzProfile')).display!=='none'");
        await evaluate(`(async()=>{
            const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            const files=new DataTransfer();files.items.add(new File([blob],'sec_test_avatar.png',{type:'image/png'}));
            const input=document.querySelector('#lzAvatarInput');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
        })()`);
        await waitDOM("document.querySelector('#lzAvatar img')?.src.startsWith('data:image/jpeg;base64,')", "upload perfil");
        await click("#lzAvatarRemoveBtn"); await waitDOM("!document.querySelector('#lzAvatar img')", "remover foto");
        await evaluate(`(()=>{
            const files=new DataTransfer();files.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'sec_test_avatar.svg',{type:'image/svg+xml'}));
            const input=document.querySelector('#lzAvatarInput');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
        })()`);
        assert.equal(await evaluate("document.querySelector('#lzAvatar img')===null"), true);
        assert.ok(await evaluate("document.querySelector('#lzMsg').classList.contains('error')"));
    }],
    ["Perfil e perfil antigo: salvar e sair", async () => {
        await goto("prof.html", "getComputedStyle(document.querySelector('#profileContent')).display!=='none'");
        await fill("#editName", "Nome antigo"); await click("#saveBtn"); await waitDOM("document.querySelector('#profileName').textContent==='Nome antigo'", "salvar perfil antigo");
        await goto("perfil.html", "getComputedStyle(document.querySelector('#lzProfile')).display!=='none'");
        await fill("#lzEditName", QUOTE); await click("#lzSaveBtn"); await waitDOM(`document.querySelector('#lzName').textContent===${JSON.stringify(QUOTE)}`, "salvar perfil");
        await click("#lzLogoutBtn"); await waitDOM("location.pathname.endsWith('/cad.html')&&document.readyState==='complete'", "sair");
    }],
    ["Autenticação: recuperar, voltar, alternar abas e cadastrar", async () => {
        await goto("cad.html", "document.querySelector('#submitBtn')");
        await click('[data-tab="signup"]'); await click("#forgotLink"); await fill("#forgotEmail", "teste@example.com"); await click("#forgotSubmitBtn");
        await waitDOM("window.__uiResetEmail==='teste@example.com'", "recuperar");
        await click("#backToLoginLink"); assert.equal(await evaluate("document.querySelector('#submitBtn').textContent.trim()"), "Entrar");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('#nameField')).display"), "none");
        await click("#forgotLink"); await click('[data-tab="signup"]'); assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#authForm')).display"), "none");
        await fill("#name", "Conta Teste"); await fill("#email", "teste@example.com"); await fill("#password", "senha123"); await click("#submitBtn");
        await waitDOM("location.pathname.endsWith('/como-usar.html')", "cadastro"); assert.equal(await evaluate("localStorage.getItem('ui-name')"), "Conta Teste");
    }],
    ["Autenticação: e-mail, cancelar Google, tentar de novo e redefinir senha", async () => {
        await evaluate("localStorage.setItem('ui-auth','off')"); await goto("cad.html", "document.querySelector('#submitBtn')");
        await fill("#email", "teste@example.com"); await fill("#password", "senha123"); await click("#submitBtn"); await waitDOM("location.pathname.endsWith('/como-usar.html')", "login");
        await evaluate("localStorage.setItem('ui-auth','off')"); await goto("cad.html", "document.querySelector('#googleBtn')");
        await evaluate("window.__uiGoogleCancel=true"); await click("#googleBtn"); await waitDOM("!document.querySelector('#googleBtn').disabled", "cancelar Google");
        assert.ok(await evaluate("location.pathname.endsWith('/cad.html')"));
        await evaluate("window.__uiGoogleCancel=false"); await click("#googleBtn"); await waitDOM("location.pathname.endsWith('/como-usar.html')", "login Google");
        await goto("reset-password.html?mode=resetPassword&oobCode=test", "document.querySelector('#resetBtn')");
        await fill("#newPassword", "senha123"); await fill("#confirmPassword", "senha123"); await click("#resetBtn");
        await waitDOM("window.__uiPasswordReset===true", "redefinir senha");
    }],
    ["Segurança: texto, atributos, datas, IDs e foto com payload XSS", async () => {
        const payload = '\" autofocus onfocus=\"window.__xss=true\"><img src=x onerror=\"window.__xss=true\">';
        const saved = structuredClone(state);
        try {
            state.receitas = [{ id: '201\" data-payload=\"injetado', descricao: payload, valor: 50, created_at: today }];
            await goto("receitas.html", "document.querySelector('#tabelaReceitas button')");
            assert.equal(await evaluate("document.querySelectorAll('#tabelaReceitas img,#tabelaReceitas [data-payload]').length"), 0);
            const before = requests.length;
            await click("#tabelaReceitas button");
            await delay(80);
            assert.equal(requests.length, before, "ID malformado não pode acionar a API");
            assert.ok(await evaluate("document.querySelector('#tabelaReceitas').textContent.includes(" + JSON.stringify(payload) + ")"));
            state.agendamentos = [{ id: 501, tipo: payload, descricao: payload, valor: 5, status: "pendente", data_agendada: '2099-12-' + payload }];
            await goto("gastos.html", "document.querySelector('#tabelaAgendamentosFuturos button')");
            assert.equal(await evaluate("document.querySelectorAll('#tabelaAgendamentosFuturos img').length"), 0);
            state.conversas = [{ id: 601, titulo: payload, created_at: today }];
            state.mensagens[601] = [{ role: "assistant", conteudo: payload }];
            await goto("chat.html", "document.querySelector('.conversa-item')");
            assert.equal(await evaluate("document.querySelector('.conversa-titulo').title"), payload);
            assert.equal(await evaluate("document.querySelectorAll('.conversa-item img,.conversa-item [autofocus]').length"), 0);
            await click(".conversa-item");
            await waitDOM("document.querySelector('#chatContainer .message')", "resposta IA escapada");
            assert.equal(await evaluate("document.querySelectorAll('#chatContainer img').length"), 0);
            await evaluate("localStorage.setItem('ui-doc-usuarios/ui-user'," + JSON.stringify(JSON.stringify({ photoURL: payload })) + ")");
            await goto("perfil.html", "getComputedStyle(document.querySelector('#lzProfile')).display!=='none'");
            await delay(50);
            assert.equal(await evaluate("document.querySelector('#lzAvatar').childElementCount"), 0);
            assert.equal(await evaluate("window.__xss === true"), false);
        } finally {
            Object.assign(state, saved);
            await evaluate("localStorage.removeItem('ui-doc-usuarios/ui-user')");
        }
    }],
    ["Segurança: tokens ficam na origem local e respostas respeitam troca de conta", async () => {
        await goto("receitas.html", "document.querySelector('#tabelaReceitas button')");
        const result = await evaluate(`(async()=>{
            const {apiFetch}=await import('./js/apiClient.js');
            const {auth}=await import('./js/session.js');
            let blocked=0;
            for(const path of ['https://example.com/collect','//example.com/collect','/\\\\example.com/collect']){
                try{await apiFetch(path)}catch{blocked++}
            }
            const previous=auth.currentUser;
            const getToken=previous.getIdToken;
            previous.getIdToken=async()=>{auth.currentUser={...previous,uid:'sec_test_other'};return 'ui-test-token'};
            try{await apiFetch('/gastos/ui-user')}catch{blocked++}finally{auth.currentUser=previous;previous.getIdToken=getToken}
            return blocked;
        })()`);
        assert.equal(result, 4);
    }],
    ["Acesso sem sessão continua bloqueado", async () => {
        await evaluate("localStorage.setItem('ui-auth','off')");
        await command("Page.navigate", { url: origin + "/dashboard.html" });
        await waitDOM("location.pathname.endsWith('/cad.html')&&document.readyState==='complete'", "bloquear acesso");
    }]
];
(async () => {
    let failures = 0, passed = 0;
    try {
        if (process.env.UI_REAL_PDF === "1") {
            for (const [key, url] of Object.entries({
                jspdf: "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
                autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.8/dist/jspdf.plugin.autotable.min.js"
            })) { const response = await fetch(url); if (!response.ok) throw new Error("CDN PDF " + response.status); pdfSources[key] = await response.text(); }
        }
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        origin = "http://127.0.0.1:" + server.address().port;
        await startBrowser();
        for (const [name, run] of cases) {
            try { await run(); passed++; console.log("OK " + name); }
            catch (error) { failures++; console.error("FALHOU " + name + "\n" + error.stack); }
        }
        if (errors.length) { failures++; console.error("Erros JS/CSP:", [...new Set(errors)]); }
        console.log(`${passed}/${cases.length} cenários; PDF ${process.env.UI_REAL_PDF === "1" ? "real" : "simulado"}.`);
        process.exitCode = failures ? 1 : 0;
    } catch (error) { process.exitCode = 1; console.error(error.stack); }
    finally {
        if (socket?.readyState === WebSocket.OPEN) { try { await command("Browser.close", {}, null); } catch {} socket.close(); }
        if (browser && browser.exitCode === null) {
            await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(1500)]);
            if (browser.exitCode === null) { browser.kill(); await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(1500)]); }
        }
        await new Promise(resolve => server.close(resolve));
        if (profile && path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith("lumuzia-ui-")) {
            fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    }
})();
