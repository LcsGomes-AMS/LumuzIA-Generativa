// LumuzIA - Simulador 2D: Vida Financeira de um Jovem
// Motor 2D em Canvas integrado à tela de Educação Financeira

const MISSIONS = [
    {
        id: 1,
        title: "Missão 1: O Primeiro Salário (Bruto vs Líquido)",
        npc: "Chefe do RH",
        zone: "work",
        targetX: 180,
        targetY: 170,
        intro: "Parabéns pela contratação! Seu salário em contrato é R$ 2.000,00. Mas no dia do pagamento, o extrato bancário mostra R$ 1.830,00 após o desconto do INSS.",
        question: "Como você deve planejar suas contas a partir de agora?",
        choices: [
            {
                text: "A) Fazer compras parceladas no cartão contando com R$ 2.000 todo mês.",
                deltaBalance: -100,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -20,
                deltaHappy: 10,
                xp: 10,
                isOptimal: false,
                feedback: "Cuidado! O salário bruto é só o valor nominal. O que entra de verdade no seu bolso é a Receita Líquida. Se basear no bruto gera endividamento antes mesmo de começar."
            },
            {
                text: "B) Cadastrar R$ 1.830 na LumuzIA e basear todo o seu orçamento no valor líquido real.",
                deltaBalance: 1830,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: 25,
                deltaHappy: 15,
                xp: 40,
                isOptimal: true,
                feedback: "Perfeito! A primeira regra de ouro da Cidadania Financeira é planejar apenas com a Receita Líquida disponível."
            }
        ]
    },
    {
        id: 2,
        title: "Missão 2: O Desafio do Orçamento (A Regra 50/30/20)",
        npc: "Alex (Home Office)",
        zone: "home",
        targetX: 470,
        targetY: 170,
        intro: "Com os R$ 1.830 em mãos, você precisa pagar transporte e comida, quer sair no fim de semana, mas sabe que precisa começar a guardar para o futuro.",
        question: "Qual divisão você adota para o seu dinheiro?",
        choices: [
            {
                text: "A) Gastar o que der nas contas e torrar todo o restante em lazer sem poupar nada.",
                deltaBalance: -600,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -25,
                deltaHappy: 5,
                xp: 10,
                isOptimal: false,
                feedback: "Viver no limite sem poupança deixa você vulnerável a qualquer imprevisto. Guardar um pouco todo mês é indispensável para construir patrimônio."
            },
            {
                text: "B) Aplicar a Regra 50/30/20: R$ 915 para Necessidades, R$ 549 para Desejos e R$ 366 para o Futuro.",
                deltaBalance: -915 - 549,
                deltaEmergency: 366,
                deltaInvest: 0,
                deltaHealth: 30,
                deltaHappy: 20,
                xp: 45,
                isOptimal: true,
                feedback: "Sensacional! A regra 50/30/20 equilibra pagar as contas em dia, ter lazer sem culpa e construir sua reserva financeira mês a mês."
            }
        ]
    },
    {
        id: 3,
        title: "Missão 3: A Armadilha do Cartão de Crédito",
        npc: "Amigo Lucas (Shopping)",
        zone: "shop",
        targetX: 250,
        targetY: 370,
        intro: "O banco liberou um limite de R$ 5.000 no seu cartão! Seu amigo Lucas te convida para uma viagem cara: 'Parcela em 12 vezes e depois a gente paga o mínimo da fatura!'.",
        question: "Como você lida com essa tentação?",
        choices: [
            {
                text: "A) Aceitar o convite, parcelar acima da sua renda e pagar o mínimo da fatura.",
                deltaBalance: -350,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -35,
                deltaHappy: -15,
                xp: 10,
                isOptimal: false,
                feedback: "Perigo! Os juros rotativos do cartão de crédito passam de 400% ao ano no Brasil. Pagar o mínimo é a maneira mais rápida de perder o controle das suas finanças."
            },
            {
                text: "B) Recusar a viagem agora, manter o limite alinhado ao seu ganho e só usar o cartão com dinheiro já garantido.",
                deltaBalance: 0,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: 30,
                deltaHappy: 15,
                xp: 50,
                isOptimal: true,
                feedback: "Decisão de mestre! O limite do cartão NÃO é extensão do seu salário. Usar com sabedoria e pagar sempre 100% da fatura evita a dívida mais cara do país."
            }
        ]
    },
    {
        id: 4,
        title: "Missão 4: O Imprevisto e a Reserva de Emergência",
        npc: "Assistência Técnica",
        zone: "shop",
        targetX: 680,
        targetY: 370,
        intro: "CRASH! A tela do seu celular quebrou no chão. Você precisa dele para trabalhar e estudar. O conserto de emergência custa R$ 300,00.",
        question: "De onde você tira o dinheiro para cobrir esse imprevisto?",
        choices: [
            {
                text: "A) Entrar no cheque especial do banco pagando juros diários altíssimos.",
                deltaBalance: -380,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -30,
                deltaHappy: -20,
                xp: 10,
                isOptimal: false,
                feedback: "O cheque especial é uma das linhas de crédito mais caras que existem. Sem uma reserva de segurança, qualquer imprevisto vira uma bola de neve de juros."
            },
            {
                text: "B) Usar a Reserva de Emergência (guardada em CDB 100% CDI com liquidez diária) e depois repor a quantia.",
                deltaBalance: 0,
                deltaEmergency: -300,
                deltaInvest: 0,
                deltaHealth: 25,
                deltaHappy: 15,
                xp: 50,
                isOptimal: true,
                feedback: "Exatamente para isso serve a Reserva de Emergência! Você cobriu o imprevisto à vista com tranquilidade, sem pagar nenhum centavo de juros a bancos."
            }
        ]
    },
    {
        id: 5,
        title: "Missão 5: O Poder dos Juros Compostos (Primeiros Investimentos)",
        npc: "Mentor LumuzIA (Banco)",
        zone: "bank",
        targetX: 790,
        targetY: 170,
        intro: "Suas contas estão organizadas, dívidas zero e reserva montada. Você poupou R$ 400 extras este mês. É hora de fazer seu dinheiro render acima da inflação!",
        question: "Onde você decide aplicar esses R$ 400?",
        choices: [
            {
                text: "A) Deixar tudo na poupança antiga ou apostar em 'bets' e promessas de ganhos fáceis na internet.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 200,
                deltaHealth: -15,
                deltaHappy: -5,
                xp: 15,
                isOptimal: false,
                feedback: "Atenção: apostas não são investimento e a poupança frequentemente perde para a inflação. Cuidado com promessas mágicas de enriquecimento sem fundamento."
            },
            {
                text: "B) Investir em títulos do Tesouro Selic e CDB com 100% do CDI, iniciando aportes de longo prazo.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 400,
                deltaHealth: 35,
                deltaHappy: 25,
                xp: 60,
                isOptimal: true,
                feedback: "Parabéns, investidor! Você colocou os juros compostos para trabalhar por você. Com constância e diversificação em ativos seguros, sua liberdade financeira está garantida!"
            }
        ]
    }
];

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {});
        }
    }
    playTone(freq, type, duration, gainVal = 0.15) {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch {}
    }
    coin() {
        this.playTone(987.77, "sine", 0.1, 0.2);
        setTimeout(() => this.playTone(1318.51, "sine", 0.2, 0.2), 80);
    }
    success() {
        this.playTone(523.25, "triangle", 0.12, 0.2);
        setTimeout(() => this.playTone(659.25, "triangle", 0.12, 0.2), 100);
        setTimeout(() => this.playTone(783.99, "triangle", 0.25, 0.25), 200);
    }
    warning() {
        this.playTone(261.63, "sawtooth", 0.2, 0.15);
        setTimeout(() => this.playTone(220.00, "sawtooth", 0.3, 0.18), 120);
    }
    click() {
        this.playTone(600, "sine", 0.04, 0.1);
    }
}

export class FinancialGame2D {
    constructor(canvas, uiContainer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ui = uiContainer;
        this.sound = new SoundEngine();

        // Estado do Jogador
        this.state = {
            balance: 1830.0,
            emergency: 200.0,
            investments: 0.0,
            health: 60,
            happiness: 75,
            xp: 0,
            currentMissionIndex: 0,
            completed: false
        };

        // Personagem Alex
        this.player = {
            x: 470,
            y: 240,
            targetX: 470,
            targetY: 240,
            speed: 3.5,
            direction: "down",
            moving: false,
            frame: 0
        };

        // Teclas pressionadas
        this.keys = {};
        this.floatingTexts = [];
        this.animId = null;
        this.isInteracting = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateHUD();
        this.updateMissionUI();
        this.startLoop();
    }

    bindEvents() {
        window.addEventListener("keydown", e => {
            const code = e.key.toLowerCase();
            if (["arrowup", "w"].includes(code)) this.keys.up = true;
            if (["arrowdown", "s"].includes(code)) this.keys.down = true;
            if (["arrowleft", "a"].includes(code)) this.keys.left = true;
            if (["arrowright", "d"].includes(code)) this.keys.right = true;
            if (["e", " ", "enter"].includes(code)) {
                this.tryInteract();
            }
        });

        window.addEventListener("keyup", e => {
            const code = e.key.toLowerCase();
            if (["arrowup", "w"].includes(code)) this.keys.up = false;
            if (["arrowdown", "s"].includes(code)) this.keys.down = false;
            if (["arrowleft", "a"].includes(code)) this.keys.left = false;
            if (["arrowright", "d"].includes(code)) this.keys.right = false;
        });

        // Clique ou toque no canvas para guiar o personagem
        this.canvas.addEventListener("pointerdown", e => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            this.player.targetX = Math.max(30, Math.min(this.canvas.width - 30, clickX));
            this.player.targetY = Math.max(40, Math.min(this.canvas.height - 40, clickY));
            this.sound.init();
        });
    }

    startLoop() {
        let lastTime = performance.now();
        const loop = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            this.update(dt);
            this.render();
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    update(dt) {
        // Movimentação por teclado
        let dx = 0;
        let dy = 0;
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            this.player.x += (dx / length) * this.player.speed * (dt * 60);
            this.player.y += (dy / length) * this.player.speed * (dt * 60);
            this.player.targetX = this.player.x;
            this.player.targetY = this.player.y;
            this.player.moving = true;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.player.direction = dx > 0 ? "right" : "left";
            } else {
                this.player.direction = dy > 0 ? "down" : "up";
            }
        } else {
            // Movimentação em direção ao alvo (clique do mouse ou toque)
            const dist = Math.hypot(this.player.targetX - this.player.x, this.player.targetY - this.player.y);
            if (dist > 4) {
                const step = Math.min(dist, this.player.speed * (dt * 60));
                const angle = Math.atan2(this.player.targetY - this.player.y, this.player.targetX - this.player.x);
                this.player.x += Math.cos(angle) * step;
                this.player.y += Math.sin(angle) * step;
                this.player.moving = true;
                if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
                    this.player.direction = Math.cos(angle) > 0 ? "right" : "left";
                } else {
                    this.player.direction = Math.sin(angle) > 0 ? "down" : "up";
                }
            } else {
                this.player.moving = false;
            }
        }

        // Limites de tela do canvas
        this.player.x = Math.max(30, Math.min(this.canvas.width - 30, this.player.x));
        this.player.y = Math.max(50, Math.min(this.canvas.height - 40, this.player.y));

        if (this.player.moving) {
            this.player.frame += dt * 10;
        } else {
            this.player.frame = 0;
        }

        // Atualizar textos flutuantes
        this.floatingTexts.forEach(ft => {
            ft.y -= dt * 25;
            ft.alpha -= dt * 0.7;
        });
        this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);
    }

    addFloatingText(text, color = "#6FE7DD") {
        this.floatingTexts.push({
            text,
            x: this.player.x,
            y: this.player.y - 30,
            color,
            alpha: 1.0
        });
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Fundo principal estilo mapa 2D
        ctx.fillStyle = "#0c1315";
        ctx.fillRect(0, 0, w, h);

        // Grade de chão pixel art
        ctx.strokeStyle = "rgba(111, 231, 221, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Renderizar as 4 Zonas Temáticas do Jogo
        this.drawZone(40, 50, 270, 180, "🏢 Trabalho / RH", "Primeiro Emprego & Salário", "#182c30", "#317482");
        this.drawZone(345, 50, 270, 180, "🏠 Quarto do Alex", "Orçamento 50/30/20", "#18262c", "#2c636f");
        this.drawZone(650, 50, 270, 180, "🏦 Banco Lumuz", "Reserva & Investimentos", "#18322c", "#287a5f");
        this.drawZone(40, 265, 880, 185, "🛍️ Centro Comercial", "Lojas, Shopping & Tentações de Consumo", "#221c17", "#6b4923");

        // Desenhar Pontos de Interesse / NPCs das Missões
        this.drawNPC(180, 170, "Chefe RH", "#F2A65A", 1);
        this.drawNPC(470, 170, "LumuzIA App", "#6FE7DD", 2);
        this.drawNPC(790, 170, "Mentor Invest", "#7CE7A9", 5);
        this.drawNPC(250, 370, "Amigo Lucas", "#F28B82", 3);
        this.drawNPC(680, 370, "Celular / Loja", "#FDD663", 4);

        // Verificar proximidade com a missão atual
        const curMission = MISSIONS[this.state.currentMissionIndex];
        let nearMission = false;
        if (curMission && !this.state.completed) {
            const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
            if (dist < 55) {
                nearMission = true;
                this.drawInteractionPrompt(curMission.targetX, curMission.targetY - 45, "Interagir (E ou Toque)");
            }
        }

        // Desenhar Personagem Alex (Avatar 2D)
        this.drawPlayer(this.player.x, this.player.y);

        // Desenhar textos flutuantes (+R$ 1.830, XP etc)
        this.floatingTexts.forEach(ft => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.font = "bold 15px monospace";
            ctx.fillStyle = ft.color;
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 6;
            ctx.fillText(ft.text, ft.x - 20, ft.y);
            ctx.restore();
        });
    }

    drawZone(x, y, w, h, title, subtitle, bgColor, borderColor) {
        const ctx = this.ctx;
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#EAEFEF";
        ctx.fillText(title, x + 14, y + 26);

        ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "rgba(234, 239, 239, 0.6)";
        ctx.fillText(subtitle, x + 14, y + 44);
    }

    drawNPC(x, y, name, color, missionId) {
        const ctx = this.ctx;
        const isCurrent = (this.state.currentMissionIndex + 1) === missionId && !this.state.completed;

        // Pulso indicador de missão
        if (isCurrent) {
            const pulse = (Math.sin(performance.now() * 0.006) + 1) * 8;
            ctx.beginPath();
            ctx.arc(x, y, 22 + pulse, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(111, 231, 221, 0.2)";
            ctx.fill();

            // Marcador de exclamação !
            ctx.fillStyle = "#F2A65A";
            ctx.beginPath();
            ctx.arc(x, y - 36, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0c1315";
            ctx.font = "bold 13px monospace";
            ctx.fillText("!", x - 3, y - 32);
        }

        // Sombra
        ctx.beginPath();
        ctx.ellipse(x, y + 14, 16, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();

        // Corpo NPC
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x - 12, y - 18, 24, 28, 6);
        ctx.fill();

        // Cabeça
        ctx.fillStyle = "#FFD1A4";
        ctx.beginPath();
        ctx.arc(x, y - 20, 10, 0, Math.PI * 2);
        ctx.fill();

        // Nome
        ctx.font = "10px monospace";
        ctx.fillStyle = "#CAD5D8";
        ctx.textAlign = "center";
        ctx.fillText(name, x, y + 28);
        ctx.textAlign = "left";
    }

    drawPlayer(x, y) {
        const ctx = this.ctx;
        const walkCycle = Math.sin(this.player.frame) * 4;

        // Sombra
        ctx.beginPath();
        ctx.ellipse(x, y + 16, 18, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fill();

        // Pernas
        ctx.fillStyle = "#1E3338";
        ctx.fillRect(x - 8, y + 6, 6, 10 + (this.player.moving ? walkCycle : 0));
        ctx.fillRect(x + 2, y + 6, 6, 10 - (this.player.moving ? walkCycle : 0));

        // Tronco (Camiseta verde esmeralda LumuzIA)
        ctx.fillStyle = "#6FE7DD";
        ctx.beginPath();
        ctx.roundRect(x - 13, y - 14, 26, 22, 6);
        ctx.fill();

        // Cabeça / Rosto
        ctx.fillStyle = "#F5D0A9";
        ctx.beginPath();
        ctx.arc(x, y - 18, 11, 0, Math.PI * 2);
        ctx.fill();

        // Cabelo
        ctx.fillStyle = "#3D2B1F";
        ctx.beginPath();
        ctx.arc(x, y - 22, 11, Math.PI, Math.PI * 2);
        ctx.fill();

        // Olhos
        ctx.fillStyle = "#1A1A1A";
        const eyeOffset = this.player.direction === "right" ? 2 : this.player.direction === "left" ? -2 : 0;
        ctx.fillRect(x - 4 + eyeOffset, y - 19, 2, 3);
        ctx.fillRect(x + 2 + eyeOffset, y - 19, 2, 3);

        // Indicador do Jogador "Alex (Você)"
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#6FE7DD";
        ctx.textAlign = "center";
        ctx.fillText("Alex (Você)", x, y - 36);
        ctx.textAlign = "left";
    }

    drawInteractionPrompt(x, y, text) {
        const ctx = this.ctx;
        ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(12, 19, 21, 0.9)";
        ctx.strokeStyle = "#F2A65A";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - textWidth / 2 - 10, y - 14, textWidth + 20, 26, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F2A65A";
        ctx.textAlign = "center";
        ctx.fillText(text, x, y + 4);
        ctx.textAlign = "left";
    }

    tryInteract() {
        if (this.state.completed || this.isInteracting) return;
        const curMission = MISSIONS[this.state.currentMissionIndex];
        if (!curMission) return;

        const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
        if (dist <= 65) {
            this.openDecisionDialog(curMission);
        } else {
            // Guia o jogador até o ponto da missão
            this.player.targetX = curMission.targetX;
            this.player.targetY = curMission.targetY + 20;
            this.addFloatingText("Caminhando até a missão...", "#F2A65A");
        }
    }

    openDecisionDialog(mission) {
        this.isInteracting = true;
        this.sound.click();
        const dialogBox = document.getElementById("gameDialogBox");
        if (!dialogBox) return;

        dialogBox.hidden = false;
        dialogBox.scrollIntoView({ behavior: "smooth", block: "nearest" });

        const titleEl = document.getElementById("gameDialogTitle");
        const speakerEl = document.getElementById("gameDialogSpeaker");
        const descEl = document.getElementById("gameDialogDesc");
        const questionEl = document.getElementById("gameDialogQuestion");
        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");

        if (titleEl) titleEl.textContent = mission.title;
        if (speakerEl) speakerEl.textContent = `💬 ${mission.npc} diz:`;
        if (descEl) descEl.textContent = mission.intro;
        if (questionEl) questionEl.textContent = mission.question;
        if (feedbackEl) feedbackEl.hidden = true;
        if (continueBtn) continueBtn.hidden = true;

        if (optionsEl) {
            optionsEl.replaceChildren();
            mission.choices.forEach((choice, index) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "game-choice-btn";
                btn.textContent = choice.text;
                btn.addEventListener("click", () => this.handleChoice(mission, choice));
                optionsEl.append(btn);
            });
        }
    }

    handleChoice(mission, choice) {
        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");

        if (optionsEl) optionsEl.hidden = true;

        // Atualizar estado financeiro
        this.state.balance += choice.deltaBalance;
        this.state.emergency = Math.max(0, this.state.emergency + choice.deltaEmergency);
        this.state.investments = Math.max(0, this.state.investments + choice.deltaInvest);
        this.state.health = Math.min(100, Math.max(0, this.state.health + choice.deltaHealth));
        this.state.happiness = Math.min(100, Math.max(0, this.state.happiness + choice.deltaHappy));
        this.state.xp += choice.xp;

        if (choice.isOptimal) {
            this.sound.success();
            this.addFloatingText(`+${choice.xp} XP!`, "#7CE7A9");
        } else {
            this.sound.warning();
            this.addFloatingText("Cuidado com a dívida!", "#F28B82");
        }

        if (feedbackEl) {
            feedbackEl.hidden = false;
            feedbackEl.className = `game-feedback ${choice.isOptimal ? "is-optimal" : "is-warning"}`;
            feedbackEl.innerHTML = `
                <strong>${choice.isOptimal ? "✓ Excelente Decisão!" : "⚠️ Ponto de Atenção!"}</strong>
                <p>${choice.feedback}</p>
                <div class="game-feedback-stats">
                    <span>Saldo: R$ ${this.state.balance.toFixed(2)}</span> ·
                    <span>Reserva: R$ ${this.state.emergency.toFixed(2)}</span> ·
                    <span>Investimentos: R$ ${this.state.investments.toFixed(2)}</span> ·
                    <span>Saúde: ${this.state.health}%</span>
                </div>
            `;
        }

        this.updateHUD();

        if (continueBtn) {
            continueBtn.hidden = false;
            continueBtn.onclick = () => {
                this.closeDecisionDialog();
                this.state.currentMissionIndex++;
                if (this.state.currentMissionIndex >= MISSIONS.length) {
                    this.finishGame();
                } else {
                    this.updateMissionUI();
                    this.sound.coin();
                }
            };
        }
    }

    closeDecisionDialog() {
        const dialogBox = document.getElementById("gameDialogBox");
        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");
        if (dialogBox) dialogBox.hidden = true;
        if (optionsEl) optionsEl.hidden = false;
        if (feedbackEl) feedbackEl.hidden = true;
        if (continueBtn) continueBtn.hidden = true;
        this.isInteracting = false;
    }

    updateHUD() {
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        const setWidth = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.style.width = `${Math.min(100, Math.max(0, val))}%`;
        };

        setTxt("gameHudBalance", `R$ ${this.state.balance.toFixed(2)}`);
        setTxt("gameHudEmergency", `R$ ${this.state.emergency.toFixed(2)}`);
        setTxt("gameHudInvest", `R$ ${this.state.investments.toFixed(2)}`);
        setTxt("gameHudXp", `${this.state.xp} XP`);
        setTxt("gameHudHealthText", `${this.state.health}%`);
        setTxt("gameHudHappyText", `${this.state.happiness}%`);

        setWidth("gameHudHealthFill", this.state.health);
        setWidth("gameHudHappyFill", this.state.happiness);
    }

    updateMissionUI() {
        const curMission = MISSIONS[this.state.currentMissionIndex];
        const missionBox = document.getElementById("gameMissionTracker");
        if (!missionBox) return;

        if (curMission) {
            missionBox.innerHTML = `
                <div class="mission-tag">🎯 Missão ${curMission.id} de 5</div>
                <h3>${curMission.title}</h3>
                <p>${curMission.intro}</p>
                <div class="mission-actions-row">
                    <button id="btnIrParaMissao" class="education-primary-button" type="button">Ir até o local da Missão</button>
                    <button id="btnAbrirDecisao" class="education-secondary-button" type="button">Abrir Diálogo</button>
                </div>
            `;
            document.getElementById("btnIrParaMissao")?.addEventListener("click", () => {
                this.player.targetX = curMission.targetX;
                this.player.targetY = curMission.targetY + 20;
                this.addFloatingText("Caminhando...", "#6FE7DD");
            });
            document.getElementById("btnAbrirDecisao")?.addEventListener("click", () => {
                this.openDecisionDialog(curMission);
            });
        }
    }

    finishGame() {
        this.state.completed = true;
        this.sound.success();
        const missionBox = document.getElementById("gameMissionTracker");
        if (missionBox) {
            missionBox.innerHTML = `
                <div class="game-victory-card">
                    <div class="victory-badge">🏆 Parabéns, Jovem Gestor!</div>
                    <h3>Você concluiu todas as missões da Vida Financeira!</h3>
                    <p>Você aprendeu a planejar pelo salário líquido, dominar a regra 50/30/20, escapar da armadilha dos juros do cartão de crédito, montar sua reserva de emergência e começar a investir com juros compostos.</p>
                    <div class="victory-stats-grid">
                        <div><span>Patrimônio Final</span><strong>R$ ${(this.state.balance + this.state.emergency + this.state.investments).toFixed(2)}</strong></div>
                        <div><span>Saúde Financeira</span><strong>${this.state.health}%</strong></div>
                        <div><span>XP Conquistado</span><strong>${this.state.xp} XP</strong></div>
                    </div>
                    <div class="victory-buttons-row">
                        <button id="btnReiniciarJogo" class="education-secondary-button" type="button">Jogar Novamente</button>
                        <button id="btnVoltarTasksVitoria" class="education-primary-button" type="button">Continuar para as Tasks da Trilha</button>
                    </div>
                </div>
            `;
            document.getElementById("btnReiniciarJogo")?.addEventListener("click", () => this.restart());
            document.getElementById("btnVoltarTasksVitoria")?.addEventListener("click", () => {
                const btnTasks = document.getElementById("btnModoTasks");
                if (btnTasks) btnTasks.click();
            });
        }
    }

    restart() {
        this.state = {
            balance: 1830.0,
            emergency: 200.0,
            investments: 0.0,
            health: 60,
            happiness: 75,
            xp: 0,
            currentMissionIndex: 0,
            completed: false
        };
        this.player.x = 470;
        this.player.y = 240;
        this.player.targetX = 470;
        this.player.targetY = 240;
        this.updateHUD();
        this.updateMissionUI();
        this.closeDecisionDialog();
        this.sound.coin();
    }
}

// Inicializador quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("financeGameCanvas");
    const container = document.getElementById("financeGameSection");
    const btnModoJogo = document.getElementById("btnModoJogo");
    const btnModoTasks = document.getElementById("btnModoTasks");
    const tasksContainer = document.getElementById("modoTasksContainer");

    if (!canvas || !container) return;

    let gameInstance = null;

    function toggleMode(mode) {
        const isGame = mode === "game";
        btnModoJogo?.classList.toggle("is-active", isGame);
        btnModoTasks?.classList.toggle("is-active", !isGame);
        btnModoJogo?.setAttribute("aria-selected", String(isGame));
        btnModoTasks?.setAttribute("aria-selected", String(!isGame));

        container.hidden = !isGame;
        if (tasksContainer) tasksContainer.hidden = isGame;

        if (isGame) {
            if (!gameInstance) {
                gameInstance = new FinancialGame2D(canvas, container);
            }
            container.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    btnModoJogo?.addEventListener("click", () => toggleMode("game"));
    btnModoTasks?.addEventListener("click", () => toggleMode("tasks"));

    // Botões auxiliares de controle no jogo
    document.getElementById("btnVoltarTasksHeader")?.addEventListener("click", () => toggleMode("tasks"));
    document.getElementById("btnGameRestart")?.addEventListener("click", () => gameInstance?.restart());
    
    // Controles direcionais na tela (mobile / touch)
    document.querySelectorAll(".game-dpad-btn").forEach(btn => {
        const dir = btn.dataset.dir;
        btn.addEventListener("pointerdown", () => {
            if (gameInstance) {
                gameInstance.sound.init();
                const step = 40;
                if (dir === "up") gameInstance.player.targetY -= step;
                if (dir === "down") gameInstance.player.targetY += step;
                if (dir === "left") gameInstance.player.targetX -= step;
                if (dir === "right") gameInstance.player.targetX += step;
            }
        });
    });

    document.getElementById("btnDpadInteract")?.addEventListener("click", () => {
        if (gameInstance) gameInstance.tryInteract();
    });

    // Toggle som
    const soundBtn = document.getElementById("btnToggleSound");
    if (soundBtn) {
        soundBtn.addEventListener("click", () => {
            if (gameInstance) {
                gameInstance.sound.enabled = !gameInstance.sound.enabled;
                soundBtn.textContent = gameInstance.sound.enabled ? "🔊 Som Ativo" : "🔇 Som Mudo";
            }
        });
    }
});

