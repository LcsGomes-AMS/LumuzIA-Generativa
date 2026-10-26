const mockProgress = Object.freeze({
    currentStreak: 12,
    bestStreak: 24,
    completed: 8,
    total: 25,
    xp: 320,
    currentModule: "Orçamento Pessoal"
});

const mockTasks = Object.freeze([
    {
        id: "fundamentos-01",
        module: "Fundamentos Financeiros",
        title: "O que é educação financeira?",
        description: "Entenda por que organização e consciência vêm antes de qualquer investimento.",
        status: "completed",
        xp: 10,
        lesson: "Educação financeira é o conjunto de conhecimentos e hábitos que ajudam você a tomar decisões melhores sobre renda, consumo, dívidas, poupança e investimentos.",
        question: "Qual é o principal objetivo da educação financeira?",
        options: ["Gastar todo o dinheiro rapidamente", "Tomar decisões financeiras mais conscientes", "Investir apenas em renda variável", "Nunca usar crédito"],
        correct: 1,
        explanation: "Educação financeira não significa simplesmente gastar menos: significa entender as consequências das decisões e planejar o dinheiro de acordo com seus objetivos."
    },
    {
        id: "receitas-01",
        module: "Receitas e Despesas",
        title: "Receita x despesa",
        description: "Aprenda a diferenciar o que entra do que sai do orçamento.",
        status: "completed",
        xp: 10,
        lesson: "Receitas representam entradas de dinheiro. Despesas representam saídas. A comparação entre elas ajuda a entender se o orçamento está saudável.",
        question: "Se você recebe R$ 3.000 e gasta R$ 2.500 no mês, o que acontece?",
        options: ["Existe um saldo positivo de R$ 500", "Existe uma dívida de R$ 500", "Receita e despesa são iguais", "Não é possível saber"],
        correct: 0,
        explanation: "R$ 3.000 de receitas menos R$ 2.500 de despesas deixa R$ 500 de saldo positivo."
    },
    {
        id: "orcamento-01",
        module: "Orçamento Pessoal",
        title: "Monte seu primeiro orçamento",
        description: "Organize entradas, gastos essenciais e gastos flexíveis.",
        status: "current",
        xp: 10,
        lesson: "Um orçamento pessoal funciona melhor quando você registra as receitas e separa os gastos por categorias. Assim fica mais fácil identificar excessos e planejar quanto pode poupar.",
        question: "Qual atitude é mais útil ao começar um orçamento pessoal?",
        options: ["Ignorar gastos pequenos", "Registrar receitas e despesas", "Usar apenas dinheiro em espécie", "Investir antes de pagar contas"],
        correct: 1,
        explanation: "Registrar receitas e despesas cria uma visão real do fluxo de dinheiro e permite planejar os próximos passos."
    },
    {
        id: "orcamento-02",
        module: "Orçamento Pessoal",
        title: "Gastos essenciais e flexíveis",
        description: "Descubra quais despesas têm menos espaço para corte.",
        status: "available",
        xp: 10,
        lesson: "Gastos essenciais atendem necessidades importantes, enquanto gastos flexíveis costumam permitir mais ajustes quando o orçamento aperta.",
        question: "Qual item normalmente é mais flexível no orçamento?",
        options: ["Aluguel", "Conta de água", "Lazer", "Medicamento contínuo"],
        correct: 2,
        explanation: "Lazer pode ser importante para qualidade de vida, mas normalmente permite ajustes maiores do que despesas essenciais."
    },
    {
        id: "reserva-01",
        module: "Reserva de Emergência",
        title: "O que é uma reserva?",
        description: "Prepare-se para imprevistos sem depender de dívida cara.",
        status: "locked",
        xp: 10
    },
    {
        id: "dividas-01",
        module: "Dívidas e Juros",
        title: "Entendendo juros",
        description: "Veja por que algumas dívidas crescem tão rapidamente.",
        status: "locked",
        xp: 10
    },
    {
        id: "metas-01",
        module: "Metas Financeiras",
        title: "Transformando objetivos em metas",
        description: "Defina valor, prazo e aporte necessário.",
        status: "locked",
        xp: 10
    },
    {
        id: "renda-fixa-01",
        module: "Renda Fixa",
        title: "Risco, liquidez e rentabilidade",
        description: "Entenda os três pilares básicos antes de escolher um produto.",
        status: "locked",
        xp: 10
    },
    {
        id: "investimentos-01",
        module: "Investimentos",
        title: "Ações e FIIs",
        description: "Conheça formas diferentes de participar do mercado.",
        status: "locked",
        xp: 10
    },
    {
        id: "diversificacao-01",
        module: "Diversificação",
        title: "Não coloque tudo no mesmo lugar",
        description: "Entenda como diversificação pode reduzir riscos específicos.",
        status: "locked",
        xp: 10
    }
]);

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

function renderSummary() {
    const percent = Math.round((mockProgress.completed / mockProgress.total) * 100);
    refs.streakDays.textContent = `${mockProgress.currentStreak} dias`;
    refs.bestStreak.textContent = `${mockProgress.bestStreak} dias`;
    refs.tasksCompleted.textContent = `${mockProgress.completed} / ${mockProgress.total}`;
    refs.totalXp.textContent = `${mockProgress.xp} XP`;
    refs.currentModule.textContent = mockProgress.currentModule;
    refs.progressPercent.textContent = `${percent}%`;
    refs.progressFill.style.width = `${clamp(percent, 0, 100)}%`;
    refs.progressFill.parentElement.setAttribute("aria-valuenow", String(percent));

    const color = streakColor(mockProgress.currentStreak);
    refs.streakSymbol.style.setProperty("--streak-color", color);
    refs.streakSymbol.style.setProperty("--streak-glow", `${8 + Math.min(mockProgress.currentStreak, 100) / 4}px`);
    refs.streakSymbol.dataset.tier = mockProgress.currentStreak >= 60 ? "high" : "normal";
}

function statusLabel(status) {
    return ({
        completed: "Concluída",
        current: "Em andamento",
        available: "Disponível",
        locked: "Bloqueada"
    })[status] || status;
}

function markerLabel(task, index) {
    if (task.status === "completed") return "✓";
    if (task.status === "locked") return "×";
    return String(index + 1);
}

function renderPath() {
    refs.learningPath.replaceChildren();

    mockTasks.forEach((task, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "path-node";
        button.dataset.status = task.status;
        button.dataset.taskId = task.id;
        button.disabled = task.status === "locked";
        button.setAttribute("aria-label", `${task.title}. ${statusLabel(task.status)}`);

        const marker = document.createElement("span");
        marker.className = "path-marker";
        marker.textContent = markerLabel(task, index);

        const copy = document.createElement("span");
        copy.className = "path-copy";
        const module = document.createElement("span");
        module.textContent = task.module;
        const title = document.createElement("strong");
        title.textContent = task.title;
        const description = document.createElement("p");
        description.textContent = task.description;
        copy.append(module, title, description);

        const state = document.createElement("span");
        state.className = "path-state";
        state.textContent = statusLabel(task.status);

        button.append(marker, copy, state);
        if (!button.disabled) {
            button.addEventListener("click", () => selectTask(task.id));
        }
        refs.learningPath.appendChild(button);
    });
}

function selectTask(taskId) {
    const task = mockTasks.find(item => item.id === taskId);
    if (!task || task.status === "locked" || !task.question) return;

    selectedTask = task;
    document.querySelectorAll(".path-node").forEach(node => {
        node.classList.toggle("is-selected", node.dataset.taskId === taskId);
    });

    refs.taskEmptyState.hidden = true;
    refs.taskContent.hidden = false;
    refs.taskModule.textContent = task.module;
    refs.taskReward.textContent = `+${task.xp} XP`;
    refs.taskTitle.textContent = task.title;
    refs.taskLesson.textContent = task.lesson;
    refs.taskQuestion.textContent = task.question;
    refs.taskOptions.replaceChildren();

    task.options.forEach((option, index) => {
        const label = document.createElement("label");
        label.className = "task-option";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "education-answer";
        input.value = String(index);

        const letter = document.createElement("span");
        letter.className = "task-option-letter";
        letter.textContent = String.fromCharCode(65 + index);

        const text = document.createElement("span");
        text.textContent = option;

        label.append(input, letter, text);
        refs.taskOptions.appendChild(label);
    });

    refs.taskFeedback.hidden = true;
    refs.taskFeedback.className = "task-feedback";
    refs.taskFeedback.textContent = "";
}

refs.taskForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedTask) return;

    const selected = refs.taskForm.querySelector('input[name="education-answer"]:checked');
    refs.taskFeedback.hidden = false;

    if (!selected) {
        refs.taskFeedback.className = "task-feedback is-wrong";
        refs.taskFeedback.textContent = "Escolha uma alternativa antes de responder.";
        return;
    }

    const answer = Number(selected.value);
    if (answer === selectedTask.correct) {
        refs.taskFeedback.className = "task-feedback is-correct";
        refs.taskFeedback.textContent = `Correto! ${selectedTask.explanation}`;
    } else {
        refs.taskFeedback.className = "task-feedback is-wrong";
        refs.taskFeedback.textContent = `Ainda não. ${selectedTask.explanation} Tente novamente quando quiser.`;
    }
});

renderSummary();
renderPath();

const initialTask = mockTasks.find(task => task.status === "current") || mockTasks.find(task => task.status === "available");
if (initialTask) selectTask(initialTask.id);
