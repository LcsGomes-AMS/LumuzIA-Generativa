// LumuzIA - Modo História 2D: A Vida Financeira de um Jovem
// Estilo Pixel Art RPG Top-Down (Inspirado em Forager & Stardew Valley) com Tela Cheia

const MISSIONS = [
    {
        id: 1,
        title: "Capítulo 1: O Primeiro Emprego & O Salário Real",
        npc: "Chefe do RH",
        role: "Empresa Contratante · Primeiro Emprego",
        avatar: "👔",
        zone: "work",
        targetX: 250,
        targetY: 170,
        intro: "Você parte da sua casa rumo ao primeiro emprego na Empresa da Ilha! Seu contrato promete R$ 2.000,00 brutos, mas ao receber o holerite, você nota o desconto obrigatório do INSS e recebe R$ 1.830,00 líquidos.",
        question: "Como você deve estruturar seus gastos a partir desta primeira remuneração?",
        choices: [
            {
                letter: "A",
                icon: "🛍️",
                title: "Gastar contando com o salário bruto",
                text: "Fazer compras parceladas no cartão de crédito assumindo que tem R$ 2.000 livres todos os meses.",
                deltaBalance: -150,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -25,
                deltaHappy: 10,
                xp: 15,
                isOptimal: false,
                feedback: "Atenção crítica! O salário bruto é apenas o valor nominal. O que entra de verdade no seu bolso é a Receita Líquida. Fazer contas pelo bruto é o primeiro passo para o endividamento precoce."
            },
            {
                letter: "B",
                icon: "📊",
                title: "Planejar pela receita líquida real",
                text: "Registrar os R$ 1.830 na LumuzIA e basear todo o orçamento de moradia, transporte e lazer no valor líquido.",
                deltaBalance: 0,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: 30,
                deltaHappy: 20,
                xp: 45,
                isOptimal: true,
                feedback: "Excelente decisão! A primeira regra de ouro da Cidadania Financeira é planejar 100% da sua vida financeira sobre a Receita Líquida disponível."
            }
        ]
    },
    {
        id: 2,
        title: "Capítulo 2: O Orçamento da Casa (A Regra 50/30/20)",
        npc: "Mentor LumuzIA",
        role: "Sua Casa · Gestão Orçamentária",
        avatar: "🏠",
        zone: "home",
        targetX: 470,
        targetY: 260,
        intro: "De volta à sua humilde casa na ilha, com os R$ 1.830 líquidos, é hora de organizar o lar: pagar comida, água, luz, internet e transporte, sem abrir mão do lazer e pensando no futuro.",
        question: "Qual divisão você adota para os seus recursos?",
        choices: [
            {
                letter: "A",
                icon: "🎉",
                title: "Viver no limite sem poupança",
                text: "Pagar apenas os boletos mais urgentes e torrar todo o resto em saídas e compras por impulso.",
                deltaBalance: -650,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -30,
                deltaHappy: 5,
                xp: 15,
                isOptimal: false,
                feedback: "Viver sem poupança deixa você à mercê do menor imprevisto. Guardar pelo menos 15% a 20% é a chave para a tranquilidade e independência financeira."
            },
            {
                letter: "B",
                icon: "⚖️",
                title: "Aplicar a Regra 50/30/20",
                text: "Destinar 50% para Necessidades (R$ 915), 30% para Desejos (R$ 549) e 20% para o Futuro / Poupança (R$ 366).",
                deltaBalance: -915 - 549 - 366,
                deltaEmergency: 366,
                deltaInvest: 0,
                deltaHealth: 35,
                deltaHappy: 25,
                xp: 50,
                isOptimal: true,
                feedback: "Sensacional! A regra 50/30/20 equilibra pagar as contas em dia, manter o lazer sem culpa e criar uma base patrimonial consistente."
            }
        ]
    },
    {
        id: 3,
        title: "Capítulo 3: A Armadilha do Cartão no Mercado",
        npc: "Amigo Lucas",
        role: "Mercado da Ilha · Tentação de Consumo",
        avatar: "☕",
        zone: "market",
        targetX: 740,
        targetY: 210,
        intro: "No mercado da ilha, o banco liberou R$ 5.000 de limite no seu cartão! Seu amigo Lucas te chama para comprar roupas de marca e jogos caros: 'Passa em 12x no cartão, depois a gente paga o mínimo da fatura!'.",
        question: "Como você lida com essa oferta tentadora?",
        choices: [
            {
                letter: "A",
                icon: "💳",
                title: "Aceitar e pagar o mínimo",
                text: "Ir na empolgação, parcelar compras supérfluas e pagar apenas o mínimo da fatura no mês seguinte.",
                deltaBalance: -350,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -40,
                deltaHappy: -20,
                xp: 15,
                isOptimal: false,
                feedback: "Ao pagar apenas o mínimo, o saldo restante pode entrar no crédito rotativo. Os juros reduzem o dinheiro disponível no próximo mês."
            },
            {
                letter: "B",
                icon: "🛡️",
                title: "Ajustar limite e pagar 100% à vista",
                text: "Dizer 'não' para os impulsos, manter o limite alinhado ao seu ganho e pagar sempre 100% da fatura.",
                deltaBalance: 0,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: 35,
                deltaHappy: 20,
                xp: 55,
                isOptimal: true,
                feedback: "Maturidade financeira nota 10! O limite do cartão NÃO é aumento de salário. Pagar sempre 100% da fatura protege seu score e sua paz mental."
            }
        ]
    },
    {
        id: 4,
        title: "Capítulo 4: O Temporal & A Reserva de Emergência",
        npc: "Mestre Construtor",
        role: "Oficina da Ilha · Imprevisto Urgente",
        avatar: "⚒️",
        zone: "workshop",
        targetX: 300,
        targetY: 420,
        intro: "CRASH! Um temporal atingiu a ilha e quebrou o telhado da sua casa e suas ferramentas essenciais de trabalho. O conserto urgente custa R$ 300,00 à vista.",
        question: "De onde você retira o dinheiro para resolver o dano?",
        choices: [
            {
                letter: "A",
                icon: "⚠️",
                title: "Entrar no Cheque Especial",
                text: "Usar o cheque especial do banco pagando tarifas e juros diários exorbitantes por não ter reserva.",
                deltaBalance: -390,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -35,
                deltaHappy: -25,
                xp: 15,
                isOptimal: false,
                feedback: "Sem reserva, o imprevisto virou dívida cara. O cheque especial cobra taxas altíssimas e corrói a renda do trabalhador rapidamente."
            },
            {
                letter: "B",
                icon: "🛡️",
                title: "Acionar a Reserva com Liquidez Diária",
                text: "Usar até R$ 300 da reserva, cobrir a diferença com o saldo e programar a reposição no próximo salário.",
                deltaBalance: 0,
                deltaEmergency: -300,
                deltaInvest: 0,
                deltaHealth: 30,
                deltaHappy: 20,
                xp: 55,
                isOptimal: true,
                feedback: "A reserva cobre o que estiver disponível. Se faltar dinheiro, a diferença sai do saldo e pode deixar as contas no vermelho."
            }
        ]
    },
    {
        id: 5,
        title: "Capítulo 5: A Expansão: O Poder dos Juros Compostos",
        npc: "Banqueiro Lumuz",
        role: "Banco Central da Ilha · Multiplicação de Renda",
        avatar: "📈",
        zone: "bank",
        targetX: 720,
        targetY: 420,
        intro: "No mês seguinte sobram R$ 400 após as despesas. Esse valor entra no saldo ao decidir. Se a conta estiver no vermelho, parte dele cobre o saldo negativo antes de qualquer aporte.",
        question: "Qual destino você dá a este primeiro aporte?",
        choices: [
            {
                letter: "A",
                icon: "🎲",
                title: "Apostar em busca de retorno rápido",
                text: "Apostar até R$ 400 do saldo disponível. Nesta simulação, a aposta perde todo o valor usado.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -15,
                deltaHappy: -5,
                xp: 15,
                isOptimal: false,
                feedback: "Apostas podem consumir o dinheiro destinado a metas. Retorno rápido prometido não garante que você recupere o que colocou."
            },
            {
                letter: "B",
                icon: "🌱",
                title: "Investir respeitando o saldo",
                text: "Aplicar até R$ 400 do saldo disponível e deixar os rendimentos na aplicação.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 400,
                deltaHealth: 40,
                deltaHappy: 30,
                xp: 75,
                isOptimal: true,
                feedback: "Nos juros compostos, os rendimentos deixados na aplicação também podem render. Nesta simulação, R$ 100 a 10% por período viram R$ 110 no primeiro e R$ 121 no segundo, antes de taxas e impostos."
            }
        ]
    }
];

const PROGRESS_KEY = "lumuzia.finance-game.decisions.v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const signedMoney = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", signDisplay: "exceptZero"
});

function initialState() {
    return {
        balance: 1830,
        emergency: 200,
        investments: 0,
        health: 70,
        maxHealth: 75,
        happiness: 75,
        xp: 0,
        currentMissionIndex: 0,
        completed: false,
        selectedHotbar: 0
    };
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
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
        this.playTone(987.77, "sine", 0.08, 0.2);
        setTimeout(() => this.playTone(1318.51, "sine", 0.18, 0.2), 70);
    }
    success() {
        this.playTone(523.25, "triangle", 0.1, 0.2);
        setTimeout(() => this.playTone(659.25, "triangle", 0.1, 0.2), 90);
        setTimeout(() => this.playTone(783.99, "triangle", 0.22, 0.22), 180);
    }
    warning() {
        this.playTone(261.63, "sawtooth", 0.18, 0.15);
        setTimeout(() => this.playTone(220.00, "sawtooth", 0.25, 0.18), 110);
    }
    click() {
        this.playTone(700, "sine", 0.04, 0.08);
    }
}

export class FinancialGame2D {
    constructor(canvas, uiContainer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;
        this.ui = uiContainer;
        this.sound = new SoundEngine();
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        this.state = initialState();
        this.decisions = [];
        this.restoreProgress();

        this.player = {
            x: 430,
            y: 300,
            targetX: 430,
            targetY: 300,
            speed: 216,
            direction: "down",
            moving: false,
            frame: 0
        };

        this.hotbarItems = [
            { icon: "📱", name: "Celular Lumuz" },
            { icon: "💼", name: "Carteira CLT" },
            { icon: "💳", name: "Cartão de Crédito" },
            { icon: "🛡️", name: "Reserva Emergência" },
            { icon: "📈", name: "Tesouro & Ações" }
        ];

        this.keys = {};
        this.floatingTexts = [];
        this.clickRipples = [];
        this.footsteps = [];
        this.worldTime = 0;
        this.arrivalMission = null;
        this.missionCelebration = null;
        this.missionProximity = 0;
        this.animId = null;
        this.isModalOpen = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateHUD();
        if (this.state.completed) this.finishGame();
        else this.updateMissionUI();
        this.startLoop();
    }

    bindEvents() {
        window.addEventListener("keydown", e => {
            if (this.isModalOpen) {
                if (e.key === "Escape") this.closeDecisionModal();
                if (e.key === "Tab") {
                    const controls = [...document.querySelectorAll("#gameDialogBox button")]
                        .filter(button => !button.closest("[hidden]"));
                    const edge = e.shiftKey ? controls.at(0) : controls.at(-1);
                    if (document.activeElement === edge) {
                        e.preventDefault();
                        (e.shiftKey ? controls.at(-1) : controls.at(0))?.focus();
                    }
                }
                return;
            }
            if (this.ui.hidden || e.target !== this.canvas) return;
            const code = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(code)) {
                e.preventDefault();
            }
            if (["arrowup", "w"].includes(code)) this.keys.up = true;
            if (["arrowdown", "s"].includes(code)) this.keys.down = true;
            if (["arrowleft", "a"].includes(code)) this.keys.left = true;
            if (["arrowright", "d"].includes(code)) this.keys.right = true;
            if (["1", "2", "3", "4", "5"].includes(e.key)) {
                this.state.selectedHotbar = parseInt(e.key) - 1;
                this.sound.click();
            }
            if (!e.repeat && ["e", " ", "enter"].includes(code)) {
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

        const clearMovement = () => { this.keys = {}; };
        this.canvas.addEventListener("blur", clearMovement);
        window.addEventListener("blur", clearMovement);

        this.canvas.addEventListener("pointerdown", e => {
            if (this.isModalOpen) return;
            const rect = this.canvas.getBoundingClientRect();
            const scale = Math.min(rect.width / this.canvas.width, rect.height / this.canvas.height);
            if (!scale) return;
            const clickX = (e.clientX - rect.left - (rect.width - this.canvas.width * scale) / 2) / scale;
            const clickY = (e.clientY - rect.top - (rect.height - this.canvas.height * scale) / 2) / scale;
            if (clickX < 0 || clickX > this.canvas.width || clickY < 0 || clickY > this.canvas.height) return;

            // Verificar clique na hotbar (área inferior central)
            const hotbarY = this.canvas.height - 52;
            const hotbarXStart = this.canvas.width / 2 - 125;
            if (clickY >= hotbarY - 6 && clickY <= hotbarY + 44) {
                for (let i = 0; i < 5; i++) {
                    const slotX = hotbarXStart + i * 50;
                    if (clickX >= slotX && clickX <= slotX + 44) {
                        this.state.selectedHotbar = i;
                        this.sound.click();
                        return;
                    }
                }
            }

            const mission = MISSIONS[this.state.currentMissionIndex];
            const onMission = mission && Math.abs(clickX - mission.targetX) < 24
                && clickY >= mission.targetY - 50 && clickY <= mission.targetY + 22;
            if (onMission) {
                this.tryInteract();
            } else {
                this.setTarget(clickX, clickY);
            }

            this.sound.init();
        });

        // Fechar modal ao clicar no botão X ou no fundo
        document.getElementById("btnFecharGameModal")?.addEventListener("click", () => this.closeDecisionModal());
        document.getElementById("gameModalBackdrop")?.addEventListener("click", e => {
            if (e.target.id === "gameModalBackdrop") this.closeDecisionModal();
        });
    }

    setTarget(x, y, mission = null) {
        this.player.targetX = Math.max(90, Math.min(this.canvas.width - 90, x));
        this.player.targetY = Math.max(100, Math.min(this.canvas.height - 85, y));
        this.arrivalMission = mission;
        this.clickRipples = [{
            x: this.player.targetX, y: this.player.targetY, radius: 4, alpha: 1
        }];
    }

    startLoop() {
        let lastTime = performance.now();
        const loop = (now) => {
            const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
            lastTime = now;
            if (!this.ui.hidden) {
                this.update(dt);
                this.render();
            }
            this.animId = requestAnimationFrame(loop);
        };
        this.animId = requestAnimationFrame(loop);
    }

    update(dt) {
        this.worldTime += dt;
        if (this.isModalOpen) return;

        this.updatePlayer(dt);

        const mission = MISSIONS[this.state.currentMissionIndex];
        const isNear = mission && Math.hypot(this.player.x - mission.targetX, this.player.y - mission.targetY) <= 85;
        this.missionProximity += (Number(Boolean(isNear)) - this.missionProximity) * Math.min(1, dt * 10);
        if (isNear && this.arrivalMission === mission
            && Math.hypot(this.player.targetX - this.player.x, this.player.targetY - this.player.y) < 1) {
            this.openDecisionModal(mission);
        }
        if (this.missionCelebration) {
            this.missionCelebration.elapsed += dt;
            if (this.missionCelebration.elapsed >= 0.85) this.missionCelebration = null;
        }

        this.footsteps.forEach(step => { step.age += dt; });
        this.footsteps = this.footsteps.filter(step => step.age < 0.32);

        // Textos flutuantes
        this.floatingTexts.forEach(ft => {
            if (!this.reducedMotion.matches) ft.y -= dt * 32;
            ft.alpha -= dt * 0.8;
        });
        this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);

        // Ripples de clique
        this.clickRipples.forEach(r => {
            r.radius += dt * 36;
            r.alpha -= dt * 1.8;
        });
        this.clickRipples = this.clickRipples.filter(r => r.alpha > 0);
    }

    updatePlayer(dt) {
        const player = this.player;
        const keyX = Number(Boolean(this.keys.right)) - Number(Boolean(this.keys.left));
        const keyY = Number(Boolean(this.keys.down)) - Number(Boolean(this.keys.up));
        const manual = keyX !== 0 || keyY !== 0;
        const dx = manual ? keyX : player.targetX - player.x;
        const dy = manual ? keyY : player.targetY - player.y;
        const length = Math.hypot(dx, dy);
        player.moving = false;
        if (!length) return;

        const speed = manual ? player.speed : Math.min(player.speed, 48 + length * 8);
        const distance = manual ? speed * dt : Math.min(length, speed * dt);
        const x = Math.max(90, Math.min(this.canvas.width - 90, player.x + dx / length * distance));
        const y = Math.max(100, Math.min(this.canvas.height - 85, player.y + dy / length * distance));
        const traveled = Math.hypot(x - player.x, y - player.y);
        if (manual) {
            this.arrivalMission = null;
            player.targetX = x;
            player.targetY = y;
        }
        if (traveled < 0.001) return;

        player.moving = true;
        player.direction = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? "right" : "left")
            : (dy > 0 ? "down" : "up");
        const nextFrame = player.frame + traveled * 0.16;
        if (!this.reducedMotion.matches && Math.floor(nextFrame / Math.PI) > Math.floor(player.frame / Math.PI)) {
            this.footsteps.push({ x: player.x, y: player.y + 15, age: 0 });
        }
        player.frame = nextFrame % (Math.PI * 2);
        player.x = x;
        player.y = y;
    }

    addFloatingText(text, color = "#6FE7DD") {
        this.floatingTexts.push({
            text,
            x: this.player.x,
            y: this.player.y - 36,
            color,
            alpha: 1.0
        });
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.imageSmoothingEnabled = false;

        // 1. ÁGUA DO OCEANO (AZUL VIBRANTE FORAGER)
        ctx.fillStyle = "#2CA5F5";
        ctx.fillRect(0, 0, w, h);

        // Ondas / reflexos pixelados na água
        this.drawWaterWaves(w, h);

        // 2. ILHA DE TERRA E GRAMA VERDE VIBRANTE COM BORDAS ESCALONADAS
        this.drawPixelIsland();

        // 3. ESTRUTURAS & CONSTRUÇÕES NA ILHA
        // Casa do Alex (estilo idêntico à foto de referência)
        this.drawPixelHouse(410, 200);

        // Empresa / Trabalho (à esquerda)
        this.drawPixelCompany(190, 110);

        // Mercado / Comércio (à direita superior)
        this.drawPixelMarket(680, 150);

        // Banco Lumuz (à direita inferior)
        this.drawPixelBank(660, 360);

        // Oficina / Construtor (à esquerda inferior)
        this.drawPixelWorkshop(240, 360);

        // 4. ELEMENTOS DA NATUREZA (Árvores redondas, pedras, tocos, arbustos)
        this.drawPixelTree(360, 60);
        this.drawPixelTree(640, 80);
        this.drawPixelTree(800, 260);
        this.drawPixelTree(120, 240);
        this.drawPixelTree(420, 430);

        this.drawPixelRock(100, 160);
        this.drawPixelRock(830, 160);
        this.drawPixelStump(520, 320);
        this.drawPixelStump(180, 440);

        this.drawPixelBush(370, 340);
        this.drawPixelBush(570, 340);
        this.drawPixelBush(840, 370);
        this.drawPixelBush(140, 340);

        // 5. CRIATURAS VIVAS (Abelha voando e peixe na água)
        const time = this.reducedMotion.matches ? 0 : this.worldTime;
        this.drawBee(390 + Math.cos(time * 2) * 23, 183 + Math.sin(time * 3.8) * 12, time);
        this.drawBee(811 + Math.cos(time * 1.7 + 2) * 17, 368 + Math.sin(time * 3) * 9, time);
        this.drawFish(585, 508, time);

        // Efeito de clique no mapa
        if (!this.reducedMotion.matches) this.clickRipples.forEach(r => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
        this.drawRoute();

        // 6. NPCs E BALÕES DE MISSÃO
        const curMission = MISSIONS[this.state.currentMissionIndex];
        this.drawNPC(250, 170, "Chefe RH", "👔", 1);
        this.drawNPC(470, 260, "Sua Casa", "🏠", 2);
        this.drawNPC(740, 210, "Lucas", "☕", 3);
        this.drawNPC(300, 420, "Oficina", "⚒️", 4);
        this.drawNPC(720, 420, "Banco", "📈", 5);

        // Balão de interação se estiver perto
        if (curMission && !this.state.completed && !this.isModalOpen) {
            const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
            if (dist <= 85) {
                this.drawInteractionPrompt(curMission.targetX, curMission.targetY - 50, `[ E ] Falar com ${curMission.npc}`);
            }
        }

        // 7. PERSONAGEM ALEX (Estilo Pixel Art Forager / RPG)
        this.drawPixelPlayer(this.player.x, this.player.y);

        this.drawMissionCelebration();

        // 8. TEXTOS FLUTUANTES
        this.floatingTexts.forEach(ft => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.font = "bold 14px 'Space Mono', monospace";
            ctx.fillStyle = ft.color;
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 6;
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });

        // 9. HUD PIXEL ART NA TELA (Estilo idêntico à imagem enviada pelo usuário)
        this.drawPixelHUDOverlay();
    }

    drawWaterWaves(w, h) {
        const ctx = this.ctx;
        ctx.fillStyle = "#6CD4FF";
        const time = this.reducedMotion.matches ? 0 : this.worldTime;
        for (let i = 0; i < 42; i++) {
            const wx = Math.round(((i * 73 + time * (9 + i % 4 * 4)) % w));
            const wy = (i * 37) % h;
            ctx.globalAlpha = 0.55 + Math.sin(time * 2.4 + i) * 0.22;
            ctx.fillRect(wx, wy, 12 + i % 5 * 3, 2);
            ctx.fillRect(wx + 8, wy + 4, 10, 2);
        }
        ctx.globalAlpha = 1;
    }

    drawRoute() {
        const { x, y, targetX, targetY } = this.player;
        const distance = Math.hypot(targetX - x, targetY - y);
        const ctx = this.ctx;
        ctx.save();
        for (const step of this.footsteps) {
            if (this.reducedMotion.matches) break;
            ctx.globalAlpha = (1 - step.age / 0.32) * 0.55;
            ctx.fillStyle = "#F0DAA0";
            ctx.fillRect(Math.round(step.x - 5 - step.age * 13), step.y, 3, 3);
            ctx.fillRect(Math.round(step.x + 3 + step.age * 13), step.y + 3, 2, 2);
        }
        if (distance >= 8) {
            ctx.globalAlpha = 0.75;
            ctx.strokeStyle = this.arrivalMission ? "#FFF0A3" : "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 7]);
            ctx.beginPath();
            ctx.moveTo(x, y + 14);
            ctx.lineTo(targetX, targetY + 9);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeRect(targetX - 5, targetY + 4, 10, 10);
        }
        ctx.restore();
    }

    drawPixelIsland() {
        const ctx = this.ctx;
        // Borda de terra/sombra da ilha (verde escuro pixelado)
        ctx.fillStyle = "#369E1C";
        ctx.beginPath();
        // Contorno escalonado da ilha principal
        ctx.rect(70, 70, 820, 400);
        ctx.fill();

        // Superfície de grama verde vibrante (#5BE236)
        ctx.fillStyle = "#5BE236";
        ctx.fillRect(75, 75, 810, 390);

        // Recortes de água nos cantos para formato orgânico estilo Forager
        ctx.fillStyle = "#2CA5F5";
        ctx.fillRect(70, 70, 60, 50);
        ctx.fillRect(830, 70, 60, 60);
        ctx.fillRect(70, 410, 70, 60);
        ctx.fillRect(820, 410, 70, 60);

        // Pequenas gramas e flores pixel art
        ctx.fillStyle = "#43BA22";
        for (let i = 0; i < 40; i++) {
            const gx = 100 + ((i * 67) % 760);
            const gy = 100 + ((i * 47) % 340);
            ctx.fillRect(gx, gy, 4, 6);
            ctx.fillRect(gx + 3, gy + 2, 3, 4);
        }

        // Flores amarelas
        ctx.fillStyle = "#FDD663";
        ctx.fillRect(320, 240, 4, 4);
        ctx.fillRect(610, 280, 4, 4);
        ctx.fillRect(210, 320, 4, 4);
    }

    drawPixelHouse(x, y) {
        const ctx = this.ctx;
        // Sombra da casa
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(x - 65, y + 50, 130, 18);

        // Parede frontal de madeira
        ctx.fillStyle = "#C89467";
        ctx.fillRect(x - 50, y - 10, 100, 60);

        // Detalhes das tábuas de madeira
        ctx.strokeStyle = "#A46F46";
        ctx.lineWidth = 1.5;
        for (let py = y; py <= y + 40; py += 12) {
            ctx.beginPath();
            ctx.moveTo(x - 50, py);
            ctx.lineTo(x + 50, py);
            ctx.stroke();
        }

        // Porta arqueada
        ctx.fillStyle = "#8F4525";
        ctx.beginPath();
        ctx.roundRect(x - 14, y + 16, 28, 34, [10, 10, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = "#4D210F";
        ctx.stroke();
        // Maçaneta
        ctx.fillStyle = "#FDD663";
        ctx.fillRect(x + 5, y + 32, 3, 3);

        // Janela com cruz de madeira
        ctx.fillStyle = "#6CD4FF";
        ctx.fillRect(x + 22, y + 4, 18, 18);
        ctx.strokeStyle = "#8F4525";
        ctx.strokeRect(x + 22, y + 4, 18, 18);

        // Telhado triangular de telhas cerâmicas vermelhas/alaranjadas
        ctx.fillStyle = "#C94A29";
        ctx.beginPath();
        ctx.moveTo(x - 65, y - 5);
        ctx.lineTo(x, y - 65);
        ctx.lineTo(x + 65, y - 5);
        ctx.closePath();
        ctx.fill();

        // Linhas de telhas
        ctx.strokeStyle = "#9C3217";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 48, y - 18);
        ctx.lineTo(x, y - 65);
        ctx.lineTo(x + 48, y - 18);
        ctx.stroke();

        ctx.strokeStyle = "#5C1B0A";
        ctx.stroke();

        // Letreiro da Casa
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#0c1315";
        ctx.fillText("🏠 Sua Casa", x - 30, y + 62);
    }

    drawPixelCompany(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "#2D4B66";
        ctx.fillRect(x - 40, y - 20, 80, 55);
        ctx.fillStyle = "#1E3347";
        ctx.fillRect(x - 44, y - 30, 88, 12);
        // Janelas iluminadas
        ctx.fillStyle = "#FDD663";
        ctx.fillRect(x - 28, y - 10, 16, 16);
        ctx.fillRect(x + 12, y - 10, 16, 16);
        // Porta
        ctx.fillStyle = "#6FE7DD";
        ctx.fillRect(x - 10, y + 14, 20, 21);
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#EAEFEF";
        ctx.fillText("🏢 CLT / RH", x - 26, y + 48);
    }

    drawPixelMarket(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "#94623E";
        ctx.fillRect(x - 35, y - 10, 70, 45);
        // Toldo listrado vermelho e branco
        ctx.fillStyle = "#D9382E";
        ctx.fillRect(x - 40, y - 24, 80, 16);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x - 24, y - 24, 16, 16);
        ctx.fillRect(x + 8, y - 24, 16, 16);
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#0c1315";
        ctx.fillText("🏪 Mercado", x - 28, y + 46);
    }

    drawPixelBank(x, y) {
        const ctx = this.ctx;
        // Colunas clássicas de banco
        ctx.fillStyle = "#CAD5D8";
        ctx.fillRect(x - 40, y - 20, 80, 52);
        ctx.fillStyle = "#F2A65A";
        ctx.fillRect(x - 44, y - 30, 88, 12); // Frontão
        // Colunas
        ctx.fillStyle = "#EAEFEF";
        ctx.fillRect(x - 30, y - 18, 10, 48);
        ctx.fillRect(x + 20, y - 18, 10, 48);
        ctx.fillStyle = "#168B91";
        ctx.fillRect(x - 10, y + 10, 20, 24); // Cofre
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#0c1315";
        ctx.fillText("🏦 Banco", x - 22, y + 44);
    }

    drawPixelWorkshop(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "#7D5335";
        ctx.fillRect(x - 35, y - 10, 70, 45);
        ctx.fillStyle = "#334C58";
        ctx.fillRect(x - 40, y - 22, 80, 14);
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#0c1315";
        ctx.fillText("⚒️ Oficina", x - 26, y + 46);
    }

    drawPixelTree(x, y) {
        const ctx = this.ctx;
        const sway = this.reducedMotion.matches ? 0 : Math.round(Math.sin(this.worldTime * 2.2 + x * 0.04) * 3);
        // Sombra
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.beginPath();
        ctx.ellipse(x, y + 36, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tronco
        ctx.fillStyle = "#6B4423";
        ctx.fillRect(x - 6, y + 8, 12, 28);
        ctx.fillStyle = "#4A2E16";
        ctx.fillRect(x - 6, y + 8, 4, 28);

        // Copa da árvore redonda e fofa estilo Forager
        ctx.fillStyle = "#3BB522";
        ctx.beginPath();
        ctx.arc(x + sway, y, 26, 0, Math.PI * 2);
        ctx.fill();

        // Destaque de luz no topo
        ctx.fillStyle = "#65DE3C";
        ctx.beginPath();
        ctx.arc(x - 6 + sway, y - 7, 16, 0, Math.PI * 2);
        ctx.fill();

        // Sombra inferior da copa
        ctx.fillStyle = "#258213";
        ctx.beginPath();
        ctx.arc(x + 5 + sway, y + 9, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPixelRock(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(x - 22, y + 10, 44, 10);

        ctx.fillStyle = "#94A4A8";
        ctx.beginPath();
        ctx.roundRect(x - 20, y - 16, 40, 26, 8);
        ctx.fill();

        ctx.fillStyle = "#CAD5D8";
        ctx.fillRect(x - 14, y - 12, 10, 6); // Brilho

        ctx.fillStyle = "#5E6E74";
        ctx.fillRect(x + 4, y + 2, 12, 6); // Sombra
    }

    drawPixelStump(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "#8F563B";
        ctx.fillRect(x - 12, y - 4, 24, 18);
        ctx.fillStyle = "#BA7D5D";
        ctx.beginPath();
        ctx.ellipse(x, y - 4, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPixelBush(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = "#258213";
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#43BA22";
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 9, 0, Math.PI * 2);
        ctx.fill();
        // Frutinhas vermelhas
        ctx.fillStyle = "#D9382E";
        ctx.fillRect(x - 4, y - 1, 3, 3);
        ctx.fillRect(x + 3, y + 2, 3, 3);
    }

    drawBee(x, y, time) {
        const ctx = this.ctx;
        const wing = 0.4 + Math.sin(time * 38) * 0.65;
        // Asas brancas translúcidas
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.beginPath();
        ctx.ellipse(x - 3, y - 5, 5, 2, -wing, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 3, y - 5, 5, 2, wing, 0, Math.PI * 2);
        ctx.fill();

        // Corpo amarelo e listras pretas
        ctx.fillStyle = "#F5C438";
        ctx.fillRect(x - 5, y - 3, 10, 7);
        ctx.fillStyle = "#0c1315";
        ctx.fillRect(x - 2, y - 3, 2, 7);
        ctx.fillRect(x + 2, y - 3, 2, 7);
    }

    drawFish(x, y, time) {
        const ctx = this.ctx;
        const cycle = time % 5;
        const progress = Math.min(1, Math.max(0, (cycle - 3.3) / 0.9));
        const jump = Math.sin(progress * Math.PI) * 24;
        x += progress * 44;
        const fy = y - jump;
        if (cycle < 3.3 || cycle > 4.2) {
            const ripple = cycle > 4.2 ? (cycle - 4.2) / 0.8 : 0;
            ctx.save();
            ctx.globalAlpha = 0.65 * (1 - ripple);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(x, y, 8 + ripple * 16, 3 + ripple * 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            if (cycle > 4.2 && ripple < 0.45) {
                ctx.fillStyle = "#D1F5FF";
                const lift = Math.sin(ripple * Math.PI / 0.45) * 12;
                ctx.fillRect(x - ripple * 24, y - lift, 3, 3);
                ctx.fillRect(x + ripple * 28, y - lift * 0.7, 2, 2);
            }
            ctx.restore();
        }

        if (jump > 2) {
            ctx.fillStyle = "#E07438";
            ctx.fillRect(x - 6, fy - 4, 12, 7);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(x - 4, fy - 2, 2, 2);
            // Cauda
            ctx.fillStyle = "#C45B25";
            ctx.fillRect(x + 6, fy - 2, 4, 4);
        }
    }

    drawPixelPlayer(x, y) {
        const ctx = this.ctx;
        const animate = !this.reducedMotion.matches;
        const walk = animate && this.player.moving ? Math.round(Math.sin(this.player.frame) * 4) : 0;
        const bounce = this.player.moving ? Math.abs(walk) * 0.55 : (1 + Math.sin(this.worldTime * 3)) / 2;
        const bob = animate ? -Math.round(bounce) : 0;
        const facing = this.player.direction;
        const side = facing === "left" ? -1 : 1;

        // Sombra
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(x, y + 16, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        x = Math.round(x);
        y = Math.round(y + bob);

        // Pernas (calça azul jeans idêntica ao personagem da foto)
        ctx.fillStyle = "#2B65C2";
        ctx.fillRect(x - 6, y + 4, 5, 10 + walk);
        ctx.fillRect(x + 1, y + 4, 5, 10 - walk);
        ctx.fillStyle = "#23394B";
        ctx.fillRect(x - 6, y + 13 + walk, 5, 3);
        ctx.fillRect(x + 1, y + 13 - walk, 5, 3);

        // Tronco (camiseta vermelha clássica)
        ctx.fillStyle = "#D9382E";
        ctx.fillRect(x - 8, y - 10, 16, 15);
        ctx.fillStyle = "#F5C498";
        ctx.fillRect(x - 10, y - 3 - walk, 3, 7);
        ctx.fillRect(x + 7, y - 3 + walk, 3, 7);

        // Cabeça redonda estilo Forager
        ctx.fillStyle = "#F5C498";
        ctx.beginPath();
        ctx.arc(x, y - 14, 9, 0, Math.PI * 2);
        ctx.fill();

        // Olhos pretos simples
        if (facing === "up") {
            ctx.fillStyle = "#704430";
            ctx.fillRect(x - 7, y - 19, 14, 10);
        } else {
            ctx.fillStyle = "#0c1315";
            const eyeOffset = facing === "down" ? 0 : side * 2;
            const eyeHeight = animate && this.worldTime % 4.2 > 4.03 ? 1 : 3;
            ctx.fillRect(x - 4 + eyeOffset, y - 15, 2, eyeHeight);
            ctx.fillRect(x + 1 + eyeOffset, y - 15, 2, eyeHeight);
        }

        // Ferramenta na mão (vara de pesca ou celular)
        ctx.strokeStyle = "#4A2E16";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + side * 8, y - 2 + side * walk);
        ctx.lineTo(x + side * 17, y - 13 + side * walk);
        ctx.stroke();

        // Indicador flutuante
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.textAlign = "center";
        ctx.fillText("Alex (Você)", x, y - 28);
        ctx.textAlign = "left";
    }

    drawNPC(x, y, name, avatar, missionId) {
        const ctx = this.ctx;
        const isCurrent = (this.state.currentMissionIndex + 1) === missionId && !this.state.completed;

        if (isCurrent) {
            const proximity = this.reducedMotion.matches ? Math.round(this.missionProximity) : this.missionProximity;
            const pulse = this.reducedMotion.matches ? 0 : (Math.sin(this.worldTime * 7) + 1) * 4;
            ctx.strokeStyle = proximity > 0.5 ? "#7CE7A9" : "#F2A65A";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, y + 8, 16 + pulse + proximity * 9, 7 + proximity * 4, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Marcador de exclamação animado
            const bob = this.reducedMotion.matches ? 0 : Math.sin(this.worldTime * 6) * 4;
            ctx.fillStyle = "#F2A65A";
            ctx.beginPath();
            ctx.arc(x, y - 36 + bob, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0c1315";
            ctx.font = "bold 13px monospace";
            ctx.textAlign = "center";
            ctx.fillText("!", x, y - 32 + bob);
        }

        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(avatar, x, y + 4);

        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#0c1315";
        ctx.fillText(name, x, y + 22);
        ctx.textAlign = "left";
    }

    drawInteractionPrompt(x, y, text) {
        const ctx = this.ctx;
        const bob = this.reducedMotion.matches ? 0 : Math.sin(this.worldTime * 7) * 4;
        ctx.font = "bold 12px monospace";
        const tw = ctx.measureText(text).width;

        ctx.fillStyle = "#0c1315";
        ctx.strokeStyle = "#F2A65A";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2 - 10, y + bob, tw + 20, 26, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F2A65A";
        ctx.textAlign = "center";
        ctx.fillText(text, x, y + 17 + bob);
        ctx.textAlign = "left";
    }

    drawMissionCelebration() {
        if (!this.missionCelebration || this.reducedMotion.matches) return;
        const { x, y, elapsed, completed } = this.missionCelebration;
        const ctx = this.ctx;
        const count = completed ? 24 : 12;
        const colors = ["#7CE7A9", "#F2A65A", "#6FE7DD"];
        ctx.save();
        ctx.globalAlpha = 1 - elapsed / 0.85;
        for (let index = 0; index < count; index++) {
            const angle = index * Math.PI * 2 / count;
            const speed = 48 + index % 4 * 17;
            const offsetX = Math.cos(angle) * speed * elapsed;
            const offsetY = Math.sin(angle) * speed * elapsed + 55 * elapsed ** 2;
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(Math.round(x + offsetX), Math.round(y + offsetY), 4, 4);
        }
        ctx.restore();
    }

    drawPixelHUDOverlay() {
        const ctx = this.ctx;
        const w = this.canvas.width;

        // TOP-LEFT: CRISTAL / GEMA AZUL & MOEDAS (IDÊNTICO À FOTO DE REFERÊNCIA)
        ctx.fillStyle = "rgba(12, 19, 21, 0.85)";
        ctx.strokeStyle = "#6CD4FF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(14, 14, 150, 42, 8);
        ctx.fill();
        ctx.stroke();

        // Ícone Cristal Azul com cruz verde
        ctx.fillStyle = "#32B3F7";
        ctx.beginPath();
        ctx.moveTo(34, 20);
        ctx.lineTo(46, 35);
        ctx.lineTo(34, 50);
        ctx.lineTo(22, 35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#43CD82";
        ctx.fillRect(40, 36, 8, 8); // badge '+'

        ctx.font = "bold 13px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`${money.format(this.state.balance)}`, 56, 39);

        // TOP-RIGHT: BARRA DE ENERGIA / SAÚDE VERMELHA RETRÔ (69/75 DA FOTO)
        const barW = 140;
        const barX = w - barW - 14;
        ctx.fillStyle = "#D9382E";
        ctx.fillRect(barX, 14, barW, 26);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, 14, barW, 26);

        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(`${this.state.health}/${this.state.maxHealth}`, barX + barW / 2, 31);
        ctx.textAlign = "left";

        // Ícones de ação no topo direito (⚙️ 📦 🧑 ⚒️ 🎒)
        const icons = ["🎒", "🛡️", "📈", "⛶"];
        icons.forEach((ic, idx) => {
            const ix = w - 165 - idx * 34;
            ctx.fillStyle = "rgba(12, 19, 21, 0.8)";
            ctx.fillRect(ix, 14, 28, 28);
            ctx.strokeStyle = "#CAD5D8";
            ctx.strokeRect(ix, 14, 28, 28);
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(ic, ix + 14, 34);
        });
        ctx.textAlign = "left";

        // BOTTOM-CENTER: HOTBAR DE ITENS (5 SLOTS RETRÔ COM SELETOR)
        const hotbarY = this.canvas.height - 52;
        const totalW = 5 * 50;
        const startX = w / 2 - totalW / 2;

        for (let i = 0; i < 5; i++) {
            const slotX = startX + i * 50;
            const isSelected = this.state.selectedHotbar === i;

            ctx.fillStyle = isSelected ? "rgba(111, 231, 221, 0.4)" : "rgba(10, 16, 18, 0.85)";
            ctx.fillRect(slotX, hotbarY, 44, 44);
            ctx.strokeStyle = isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.strokeRect(slotX, hotbarY, 44, 44);

            // Colchetes no slot selecionado
            if (isSelected) {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(slotX - 2, hotbarY - 2, 6, 2);
                ctx.fillRect(slotX - 2, hotbarY - 2, 2, 6);
                ctx.fillRect(slotX + 40, hotbarY - 2, 6, 2);
                ctx.fillRect(slotX + 44, hotbarY - 2, 2, 6);
            }

            ctx.font = "20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(this.hotbarItems[i].icon, slotX + 22, hotbarY + 30);
        }
        ctx.textAlign = "left";
    }

    tryInteract() {
        if (this.state.completed || this.isModalOpen) return;
        const curMission = MISSIONS[this.state.currentMissionIndex];
        if (!curMission) return;

        const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
        if (dist <= 85) {
            this.openDecisionModal(curMission);
        } else {
            this.setTarget(curMission.targetX, curMission.targetY + 15, curMission);
            this.addFloatingText("Caminhando...", "#F2A65A");
        }
    }

    openDecisionModal(mission) {
        const backdrop = document.getElementById("gameModalBackdrop");
        if (!backdrop || this.isModalOpen || this.ui.hidden) return;

        this.isModalOpen = true;
        this.previousFocus = document.activeElement;
        this.keys = {};
        this.arrivalMission = null;
        this.player.targetX = this.player.x;
        this.player.targetY = this.player.y;
        this.player.moving = false;
        this.sound.click();

        backdrop.hidden = false;
        backdrop.classList.add("is-active");

        const avatarEl = document.getElementById("gameDialogAvatar");
        const speakerEl = document.getElementById("gameDialogSpeaker");
        const roleEl = document.getElementById("gameDialogRole");
        const missionTagEl = document.getElementById("gameDialogMissionTag");
        const titleEl = document.getElementById("gameDialogTitle");
        const descEl = document.getElementById("gameDialogDesc");
        const questionEl = document.getElementById("gameDialogQuestion");
        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");

        if (avatarEl) avatarEl.textContent = mission.avatar || "💬";
        if (speakerEl) speakerEl.textContent = mission.npc;
        if (roleEl) roleEl.textContent = mission.role || "Educação Financeira";
        if (missionTagEl) missionTagEl.textContent = `Capítulo ${mission.id} de ${MISSIONS.length}`;
        if (titleEl) titleEl.textContent = mission.title;
        if (descEl) descEl.textContent = mission.intro;
        if (questionEl) questionEl.textContent = mission.question;
        if (feedbackEl) feedbackEl.hidden = true;
        if (continueBtn) continueBtn.hidden = true;

        if (optionsEl) {
            optionsEl.hidden = false;
            optionsEl.replaceChildren();
            mission.choices.forEach(choice => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "game-modal-choice";
                btn.innerHTML = `
                    <div class="choice-letter-badge">${choice.letter}</div>
                    <div class="choice-text-wrap">
                        <strong>${choice.icon} ${choice.title}</strong>
                        <span>${choice.text}</span>
                    </div>
                `;
                btn.addEventListener("click", () => this.handleChoice(mission, choice));
                optionsEl.append(btn);
            });
        }
        document.getElementById("btnFecharGameModal")?.focus();
    }

    restoreProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (!raw || raw.length > 64) return;
            const saved = JSON.parse(raw);
            if (!Array.isArray(saved) || saved.length > MISSIONS.length) return;
            const choices = saved.map((letter, index) => MISSIONS[index].choices.find(choice => choice.letter === letter));
            if (choices.every(Boolean)) choices.forEach(choice => this.applyChoice(choice));
        } catch {
            // A partida ainda funciona se o armazenamento estiver indispon?vel.
        }
    }

    saveProgress() {
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.decisions));
        } catch {
            // A partida atual continua em mem?ria.
        }
    }

    applyChoice(choice) {
        const state = this.state;
        let balance = choice.deltaBalance;
        let reserve = choice.deltaEmergency;
        let investments = choice.deltaInvest;

        if (reserve < 0) {
            const available = Math.min(state.emergency, -reserve);
            balance += reserve + available;
            reserve = -available;
        }

        if (state.currentMissionIndex === MISSIONS.length - 1) {
            const monthlySurplus = 400;
            const amount = Math.min(-balance, Math.max(0, state.balance + monthlySurplus));
            balance = monthlySurplus - amount;
            investments = choice.deltaInvest ? amount : 0;
        }

        state.balance += balance;
        state.emergency += reserve;
        state.investments += investments;
        state.health = Math.min(state.maxHealth, Math.max(0, state.health + choice.deltaHealth));
        state.happiness = Math.min(100, Math.max(0, state.happiness + choice.deltaHappy));
        state.xp += choice.xp;
        state.currentMissionIndex++;
        state.completed = state.currentMissionIndex === MISSIONS.length;
        this.decisions.push(choice.letter);
        return { balance, reserve, investments };
    }

    handleChoice(mission, choice) {
        if (!this.isModalOpen || mission !== MISSIONS[this.state.currentMissionIndex] || !mission.choices.includes(choice)) return;

        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");

        if (optionsEl) optionsEl.hidden = true;

        const impact = this.applyChoice(choice);
        this.saveProgress();
        this.refreshMissionOnClose = true;

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
                <div class="feedback-badge-row">
                    <span class="feedback-status-badge">${choice.isOptimal ? "✓ Decisão Inteligente!" : "⚠️ Ponto de Risco Financeiro!"}</span>
                    <span class="feedback-xp-pill">+${choice.xp} XP</span>
                </div>
                <p class="feedback-text">${choice.feedback}</p>
                <div class="game-feedback-stats">
                    <div><span>💰 Saldo:</span> <strong>${money.format(this.state.balance)}</strong> <span>(${signedMoney.format(impact.balance)})</span></div>
                    <div><span>🛡️ Reserva:</span> <strong>${money.format(this.state.emergency)}</strong> <span>(${signedMoney.format(impact.reserve)})</span></div>
                    <div><span>📈 Investimentos:</span> <strong>${money.format(this.state.investments)}</strong> <span>(${signedMoney.format(impact.investments)})</span></div>
                    <div><span>❤️ Saúde/Energia:</span> <strong>${this.state.health}/${this.state.maxHealth}</strong></div>
                </div>
            `;
        }

        this.updateHUD();

        if (continueBtn) {
            continueBtn.hidden = false;
            continueBtn.focus();
            continueBtn.onclick = () => this.closeDecisionModal();
        }
    }

    closeDecisionModal() {
        if (!this.isModalOpen) return;
        const backdrop = document.getElementById("gameModalBackdrop");
        backdrop.hidden = true;
        backdrop.classList.remove("is-active");
        this.isModalOpen = false;

        if (this.refreshMissionOnClose) {
            this.refreshMissionOnClose = false;
            this.missionProximity = 0;
            this.missionCelebration = {
                x: this.player.x,
                y: this.player.y - 24,
                elapsed: 0,
                completed: this.state.completed
            };
            if (this.state.completed) {
                this.finishGame();
                this.sound.success();
            } else {
                this.updateMissionUI();
                this.sound.coin();
            }
        }

        const focusTarget = this.previousFocus?.isConnected ? this.previousFocus : this.canvas;
        focusTarget.focus({ preventScroll: true });
    }

    updateHUD() {
        const setTxt = (id, val, animate = false) => {
            const el = document.getElementById(id);
            if (!el || el.textContent === val) return;
            el.textContent = val;
            if (animate && !this.reducedMotion.matches) {
                el.getAnimations().forEach(animation => animation.cancel());
                el.animate(
                    [{ transform: "translateY(3px)", opacity: 0.65 }, { transform: "translateY(0)", opacity: 1 }],
                    { duration: 260, easing: "ease-out" }
                );
            }
        };
        const setWidth = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.style.width = `${Math.min(100, Math.max(0, val))}%`;
        };

        setTxt("gameHudBalance", money.format(this.state.balance), this.isModalOpen);
        setTxt("gameHudEmergency", money.format(this.state.emergency), this.isModalOpen);
        setTxt("gameHudInvest", money.format(this.state.investments), this.isModalOpen);
        setTxt("gameHudXp", `${this.state.xp} XP`, this.isModalOpen);
        setTxt("gameHudHealthText", `${this.state.health}/${this.state.maxHealth}`);
        setTxt("gameHudHappyText", `${this.state.happiness}%`);

        setWidth("gameHudHealthFill", (this.state.health / this.state.maxHealth) * 100);
        setWidth("gameHudHappyFill", this.state.happiness);
    }

    updateMissionUI() {
        const curMission = MISSIONS[this.state.currentMissionIndex];
        const missionBox = document.getElementById("gameMissionTracker");
        if (!missionBox) return;

        if (curMission) {
            const stepsHtml = MISSIONS.map((m, idx) => {
                const status = idx < this.state.currentMissionIndex ? "done" : idx === this.state.currentMissionIndex ? "current" : "locked";
                return `<span class="mission-step ${status}">${idx < this.state.currentMissionIndex ? "✓" : idx + 1}</span>`;
            }).join("");

            missionBox.innerHTML = `
                <div class="mission-header-flex">
                    <div class="mission-steps-wrap">${stepsHtml}</div>
                    <span class="mission-counter">Capítulo ${curMission.id} de ${MISSIONS.length}</span>
                </div>
                <div class="mission-body-flex">
                    <div>
                        <h3>${curMission.title}</h3>
                        <p>${curMission.intro}</p>
                    </div>
                    <div class="mission-actions-row">
                        <button id="btnAbrirDecisao" class="education-primary-button mission-open-btn" type="button">
                            <span>Abrir Missão / Responder</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById("btnAbrirDecisao")?.addEventListener("click", () => {
                this.openDecisionModal(curMission);
            });
        }
    }

    finishGame() {
        const missionBox = document.getElementById("gameMissionTracker");
        if (missionBox) {
            missionBox.innerHTML = `
                <div class="game-victory-card">
                    <div class="victory-badge">🏆 Parabéns, Conquistador da Ilha!</div>
                    <h3>Você concluiu todos os capítulos da Vida Financeira!</h3>
                    <details>
                        <summary>Rever minhas decisões</summary>
                        <ol class="game-decision-review"></ol>
                    </details>
                    <div class="victory-stats-grid">
                        <div><span>Patrimônio Acumulado</span><strong>${money.format(this.state.balance + this.state.emergency + this.state.investments)}</strong></div>
                        <div><span>Saúde & Energia</span><strong>${this.state.health}/${this.state.maxHealth}</strong></div>
                        <div><span>XP Conquistado</span><strong>${this.state.xp} XP</strong></div>
                    </div>
                    <div class="victory-buttons-row">
                        <button id="btnReiniciarJogo" class="education-secondary-button" type="button">Jogar Novamente</button>
                        <button id="btnVoltarTasksVitoria" class="education-primary-button" type="button">Fazer as Tasks da Trilha</button>
                    </div>
                </div>
            `;
            const review = missionBox.querySelector(".game-decision-review");
            MISSIONS.forEach((mission, index) => {
                const choice = mission.choices.find(option => option.letter === this.decisions[index]);
                const item = document.createElement("li");
                const title = document.createElement("strong");
                title.textContent = choice.title;
                const lesson = document.createElement("p");
                lesson.textContent = choice.feedback;
                item.append(title, lesson);
                review.append(item);
            });
            document.getElementById("btnReiniciarJogo")?.addEventListener("click", () => this.restart());
            document.getElementById("btnVoltarTasksVitoria")?.addEventListener("click", () => {
                const btnTasks = document.getElementById("btnModoTasks");
                if (btnTasks) btnTasks.click();
            });
        }
    }

    restart() {
        this.closeDecisionModal();
        this.state = initialState();
        this.decisions = [];
        this.saveProgress();
        this.keys = {};
        this.floatingTexts = [];
        this.clickRipples = [];
        this.footsteps = [];
        this.arrivalMission = null;
        this.missionCelebration = null;
        this.missionProximity = 0;
        this.player.x = 430;
        this.player.y = 300;
        this.player.targetX = 430;
        this.player.targetY = 300;
        this.player.direction = "down";
        this.player.frame = 0;
        this.player.moving = false;
        this.updateHUD();
        this.updateMissionUI();
        this.canvas.focus({ preventScroll: true });
        this.sound.coin();
    }
}

// Inicializador da Página & Modo Tela Cheia (Fullscreen API)
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

        if (!isGame) {
            gameInstance?.closeDecisionModal();
            if (document.fullscreenElement === container) document.exitFullscreen().catch(() => {});
        }
        container.hidden = !isGame;
        if (tasksContainer) tasksContainer.hidden = isGame;

        if (isGame) {
            if (!gameInstance) {
                gameInstance = new FinancialGame2D(canvas, container);
            }
            canvas.focus({ preventScroll: true });
            container.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    btnModoJogo?.addEventListener("click", () => toggleMode("game"));
    btnModoTasks?.addEventListener("click", () => toggleMode("tasks"));

    // Alternar Tela Cheia (Fullscreen API)
    function toggleFullscreen() {
        const target = container;
        if (!document.fullscreenElement) {
            if (target.requestFullscreen) {
                target.requestFullscreen().catch(() => {});
            } else if (target.webkitRequestFullscreen) {
                target.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    document.getElementById("btnFullscreenGame")?.addEventListener("click", () => {
        toggleMode("game");
        toggleFullscreen();
    });
    document.getElementById("btnToggleFullscreenCanvas")?.addEventListener("click", toggleFullscreen);
    document.getElementById("btnExitFullscreenFloating")?.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    });

    document.addEventListener("fullscreenchange", () => {
        const isFs = document.fullscreenElement === container;
        container.classList.toggle("is-fullscreen-mode", isFs);
        const exitBtn = document.getElementById("btnExitFullscreenFloating");
        if (exitBtn) exitBtn.hidden = !isFs;
        const fsBtnText = document.querySelector("#btnFullscreenGame .fs-text");
        if (fsBtnText) fsBtnText.textContent = isFs ? "Sair da Tela Cheia" : "Modo História (Tela Cheia)";
    });

    document.getElementById("btnVoltarTasksHeader")?.addEventListener("click", () => {
        toggleMode("tasks");
        btnModoTasks?.focus();
    });
    document.getElementById("btnGameRestart")?.addEventListener("click", () => gameInstance?.restart());

    // D-Pad Mobile
    const touchSteps = { up: [0, -45], down: [0, 45], left: [-45, 0], right: [45, 0] };
    document.querySelectorAll(".game-dpad-btn[data-dir]").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!gameInstance || gameInstance.isModalOpen) return;
            const [dx, dy] = touchSteps[btn.dataset.dir];
            const { targetX, targetY } = gameInstance.player;
            gameInstance.setTarget(targetX + dx, targetY + dy);
            gameInstance.sound.init();
        });
    });

    document.getElementById("btnDpadInteract")?.addEventListener("click", () => {
        if (gameInstance) gameInstance.tryInteract();
    });

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
