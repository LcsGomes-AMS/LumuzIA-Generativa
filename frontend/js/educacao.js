import { educationApi, downloadCertificate } from "./education-api.js";
const refs = {
    streakSymbol: document.getElementById("streakSymbol"),
    streakDays: document.getElementById("streakDays"),
    bestStreak: document.getElementById("bestStreak"),
    progressPercent: document.getElementById("progressPercent"),
    progressFill: document.getElementById("progressFill"),
    tasksCompleted: document.getElementById("tasksCompleted"),
    totalXp: document.getElementById("totalXp"),
    currentModule: document.getElementById("currentModule"),
    learningPath: document.getElementById("learningPath"),
    taskEmptyState: document.getElementById("taskEmptyState"),
    taskContent: document.getElementById("taskContent"),
    taskModule: document.getElementById("taskModule"),
    taskReward: document.getElementById("taskReward"),
    taskTitle: document.getElementById("taskTitle"),
    taskLesson: document.getElementById("taskLesson"),
    taskQuestion: document.getElementById("taskQuestion"),
    taskOptions: document.getElementById("taskOptions"),
    taskForm: document.getElementById("taskForm"),
    taskFeedback: document.getElementById("taskFeedback")
};

let selectedTask = null;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function mixColor(start, end, t) {
    const a = hexToRgb(start);
    const b = hexToRgb(end);
    return rgbToHex({
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
    });
}

function streakColor(days) {
    const stops = [
        [1, "#7CE7A9"],
        [7, "#43CD82"],
        [14, "#18966F"],
        [30, "#168B91"],
        [60, "#3974B8"],
        [100, "#8B4AC6"]
    ];

    if (days <= stops[0][0]) return stops[0][1];
    if (days >= stops.at(-1)[0]) return stops.at(-1)[1];

    for (let i = 0; i < stops.length - 1; i++) {
        const [startDay, startColor] = stops[i];
        const [endDay, endColor] = stops[i + 1];
        if (days >= startDay && days <= endDay) {
            const t = (days - startDay) / (endDay - startDay);
            return mixColor(startColor, endColor, t);
        }
    }
    return stops[0][1];
}

let journey;
let busy = false;
let selection = 0;
const notice = document.getElementById("educationNotice");
const retry = document.getElementById("educationRetry");
const continueButton = document.getElementById("continueButton");
const answerButton = document.getElementById("answerButton");
const closeButton = document.getElementById("closeTask");
const panel = document.querySelector(".task-panel");

function message(text, error = false) {
    notice.textContent = text;
    notice.classList.toggle("is-wrong", error);
    retry.hidden = !error;
}
function feedback(text, correct = false) {
    refs.taskFeedback.hidden = false;
    refs.taskFeedback.className = `task-feedback ${correct ? "is-correct" : "is-wrong"}`;
    refs.taskFeedback.textContent = text;
}
function setBusy(value) {
    busy = value;
    answerButton.disabled = value;
    continueButton.disabled = value;
    document.getElementById("certificateButton").disabled = value;
    refs.taskForm.querySelector("fieldset").disabled = value;
    refs.learningPath.setAttribute("aria-busy", String(value));
}
function renderSummary() {
    const p = journey.progress;
    refs.streakDays.textContent = `${p.currentStreak} dias`;
    refs.bestStreak.textContent = `${p.bestStreak} dias`;
    refs.tasksCompleted.textContent = `${p.completedTasks} / ${p.totalTasks}`;
    refs.totalXp.textContent = `${p.xp} XP`;
    refs.currentModule.textContent = p.currentModule;
    refs.progressPercent.textContent = `${p.percent}%`;
    refs.progressFill.style.width = `${clamp(p.percent, 0, 100)}%`;
    refs.progressFill.parentElement.setAttribute("aria-valuenow", String(p.percent));
    document.getElementById("educationLevel").textContent = `Nível ${p.level} · ${p.levelName}`;
    refs.streakSymbol.style.setProperty("--streak-color", streakColor(p.currentStreak));
    refs.streakSymbol.style.setProperty("--streak-glow", p.currentStreak < 7 ? "0px" : p.currentStreak < 30 ? "8px" : "20px");
    refs.streakSymbol.dataset.tier = p.currentStreak >= 100 ? "special" : p.currentStreak >= 60 ? "high" : "normal";
    document.getElementById("educationComplete").hidden = !p.complete;
    document.getElementById("completionStats").textContent = `${p.completedTasks} tasks · ${p.xp} XP · ${p.currentStreak} dias de ofensiva · Melhor: ${p.bestStreak} dias`;
}
function renderPath() {
    refs.learningPath.replaceChildren();
    journey.modules.forEach(module => {
        const heading = document.createElement("h3");
        heading.textContent = `${module.order}. ${module.title}${journey.progress.completedModules.includes(module.id) ? " · Concluído" : ""}`;
        refs.learningPath.append(heading);
        journey.progress.tasks.filter(task => task.moduleId === module.id).forEach(task => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `path-node is-${task.status}`;
            button.dataset.taskId = task.id;
            button.disabled = task.status === "locked";
            const marker = document.createElement("span");
            marker.className = `path-marker marker-${task.status}`;
            marker.setAttribute("aria-hidden", "true");
            marker.textContent = ["completed", "locked"].includes(task.status) ? "" : "○";
            const copy = document.createElement("span");
            copy.className = "path-copy";
            const title = document.createElement("strong");
            title.textContent = task.title;
            copy.append(title);
            const state = document.createElement("span");
            state.className = "path-state";
            state.textContent = ({ completed: "Concluída · Revisar", available: "Disponível", in_progress: "Em andamento", locked: "Bloqueada" })[task.status];
            button.append(marker, copy, state);
            button.addEventListener("click", () => openTask(task.id));
            refs.learningPath.append(button);
        });
    });
}
async function openTask(id, focus = true) {
    if (busy) return;
    const request = ++selection;
    setBusy(true);
    try {
        const task = await educationApi(`/task/${encodeURIComponent(id)}`);
        if (request !== selection) return;
        selectedTask = task;
        refs.taskEmptyState.hidden = true;
        refs.taskContent.hidden = false;
        refs.taskModule.textContent = journey.modules.find(m => m.id === task.moduleId).title;
        const completed = journey.progress.tasks.find(t => t.id === id)?.status === "completed";
        refs.taskReward.textContent = completed ? "Revisão · sem XP adicional" : `+${task.xp} XP`;
        refs.taskTitle.textContent = task.title;
        refs.taskLesson.textContent = task.content;
        refs.taskQuestion.textContent = task.question;
        refs.taskOptions.replaceChildren();
        task.answers.forEach((text, index) => {
            const label = document.createElement("label");
            label.className = "task-option";
            const radio = document.createElement("input");
            radio.type = "radio"; radio.name = "education-answer"; radio.value = String(index);
            const copy = document.createElement("span"); copy.textContent = text;
            label.append(radio, copy); refs.taskOptions.append(label);
        });
        refs.taskFeedback.hidden = true;
        answerButton.hidden = false;
        continueButton.hidden = true;
        panel.classList.toggle("is-open", focus);
        document.body.classList.toggle("education-task-open", focus);
        if (focus && window.matchMedia("(max-width: 720px)").matches) {
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-modal", "true");
        }
        document.querySelectorAll(".path-node").forEach(node => node.classList.toggle("is-selected", node.dataset.taskId === id));
        if (focus) refs.taskTitle.focus();
    } catch (error) { message(navigator.onLine ? error.message : "Sem conexão. Reconecte-se para continuar.", true); }
    finally { setBusy(false); }
}
refs.taskForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selectedTask || busy) return;
    const selected = refs.taskForm.querySelector("input:checked");
    if (!selected) { feedback("Escolha uma alternativa antes de responder."); return; }
    setBusy(true);
    try {
        const result = await educationApi(`/task/${selectedTask.id}/responder`, { answer: Number(selected.value) });
        feedback(`${result.correct ? "✓ Correto!" : "Ainda não. Tente novamente."} ${result.explanation}`, result.correct);
        continueButton.hidden = !result.correct;
        answerButton.hidden = result.correct;
        if (result.correct) continueButton.focus();
    } catch (error) { feedback(error.message); }
    finally { setBusy(false); }
});
continueButton.addEventListener("click", async () => {
    if (!selectedTask || busy) return;
    setBusy(true);
    try {
        const result = await educationApi(`/task/${selectedTask.id}/concluir`, {});
        journey.progress = result.progress;
        renderSummary(); renderPath();
        message(`${result.moduleCompleted ? "Módulo concluído! " : ""}+${result.awardedXp} XP · Ofensiva mantida!`);
        document.getElementById("totalXp").classList.remove("xp-gained");
        requestAnimationFrame(() => document.getElementById("totalXp").classList.add("xp-gained"));
        if (result.moduleCompleted) {
            document.querySelector(".education-main").classList.add("module-celebration");
            setTimeout(() => document.querySelector(".education-main").classList.remove("module-celebration"), 1300);
        }
        continueButton.hidden = true;
        closeTask();
        refs.taskContent.hidden = true; refs.taskEmptyState.hidden = false;
        selectedTask = null;
        const next = result.progress.nextTask;
        setBusy(false);
        if (next) await openTask(next, false);
        else document.getElementById("certificateButton").focus();
    } catch (error) { feedback(error.message); }
    finally { setBusy(false); }
});
function closeTask() {
    panel.classList.remove("is-open");
    panel.removeAttribute("role"); panel.removeAttribute("aria-modal");
    document.body.classList.remove("education-task-open");
    if (selectedTask) document.querySelector(`[data-task-id="${selectedTask.id}"]`)?.focus();
}
closeButton.addEventListener("click", closeTask);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeTask();
    if (event.key === "Tab" && panel.getAttribute("aria-modal") === "true") {
        const focusable = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled)")].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === refs.taskTitle)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
});
document.getElementById("certificateButton").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try { const certificate = await downloadCertificate(); message(`Certificado emitido para ${certificate.name}. Código: ${certificate.code}`); }
    catch (error) { message(error.message, true); }
    finally { setBusy(false); }
});
async function load() {
    if (busy) return;
    setBusy(true);
    message("Carregando sua jornada…");
    try {
        journey = await educationApi("/trilha");
        renderSummary(); renderPath();
        const recommendations = document.getElementById("educationRecommendations");
        recommendations.replaceChildren();
        (journey.recommendations || []).forEach(item => {
            const text = document.createElement("p"); text.textContent = item.text; recommendations.append(text);
        });
        message(journey.progress.completedTasks ? "Continue sua jornada." : "Boas-vindas! Comece pela primeira task.");
        setBusy(false);
        if (journey.progress.nextTask) await openTask(journey.progress.nextTask, false);
    } catch (error) { message(navigator.onLine ? error.message : "Sem conexão. Reconecte-se para carregar seu progresso.", true); }
    finally { setBusy(false); }
}
retry.addEventListener("click", load);
window.addEventListener("offline", () => message("Sem conexão. Seu progresso já salvo está seguro. Reconecte-se para continuar.", true));
load();
