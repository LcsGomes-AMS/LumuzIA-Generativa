// LumuzIA - Simulador 2D: Vida Financeira de um Jovem
// Motor 2D Gráfico em Canvas & Modal Interativo de Decisões

const MISSIONS = [
    {
        id: 1,
        title: "Missão 1: O Primeiro Salário (Bruto vs Líquido)",
        npc: "Chefe do RH",
        role: "Empresa Contratante · Primeiro Emprego",
        avatar: "👔",
        zone: "work",
        targetX: 180,
        targetY: 170,
        intro: "Parabéns pela sua contratação! O seu salário acordado em contrato é de R$ 2.000,00 brutos. Porém, ao cair na conta corrente no 5º dia útil, o extrato exibe R$ 1.830,00 devido à dedução compulsória do INSS.",
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
                xp: 10,
                isOptimal: false,
                feedback: "Atenção crítica! O salário bruto é apenas o valor nominal. O que entra de verdade no seu bolso é a Receita Líquida. Fazer contas pelo bruto é o primeiro passo para o endividamento precoce."
            },
            {
                letter: "B",
                icon: "📊",
                title: "Planejar pela receita líquida real",
                text: "Registrar os R$ 1.830 na LumuzIA e basear todo o orçamento de moradia, transporte e lazer no valor líquido.",
                deltaBalance: 1830,
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
        title: "Missão 2: O Desafio do Orçamento (A Regra 50/30/20)",
        npc: "Alex & Mentor Lumuz",
        role: "Home Office · Gestão Orçamentária",
        avatar: "💻",
        zone: "home",
        targetX: 470,
        targetY: 170,
        intro: "Com os R$ 1.830 líquidos em mãos, você precisa pagar transporte, alimentação e ajudar em casa, mas também quer sair no fim de semana com os amigos e construir segurança.",
        question: "Qual metodologia de divisão de gastos você adota?",
        choices: [
            {
                letter: "A",
                icon: "🎉",
                title: "Viver no limite do mês a mês",
                text: "Pagar apenas os boletos mais urgentes e torrar todo o resto em baladas, fast-food e compras por impulso sem guardar nada.",
                deltaBalance: -650,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -30,
                deltaHappy: 5,
                xp: 10,
                isOptimal: false,
                feedback: "Viver sem poupança deixa você à mercê do menor imprevisto. Guardar pelo menos 15% a 20% é a chave para a tranquilidade e independência financeira."
            },
            {
                letter: "B",
                icon: "⚖️",
                title: "Aplicar a Regra 50/30/20",
                text: "Destinar 50% para Necessidades (R$ 915), 30% para Desejos (R$ 549) e 20% para o Futuro / Poupança (R$ 366).",
                deltaBalance: -915 - 549,
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
        title: "Missão 3: A Armadilha do Cartão de Crédito",
        npc: "Amigo Lucas",
        role: "Shopping Center · Tentação de Consumo",
        avatar: "☕",
        zone: "shop",
        targetX: 250,
        targetY: 370,
        intro: "O banco acaba de liberar um limite de R$ 5.000 no seu cartão! Seu amigo Lucas te convida para uma viagem caríssima com a galera: 'Joga tudo em 12x no cartão, depois a gente paga o mínimo da fatura!'.",
        question: "Como você reage diante dessa tentação?",
        choices: [
            {
                letter: "A",
                icon: "💳",
                title: "Aceitar e pagar o mínimo",
                text: "Ir na empolgação, parcelar a viagem acima da renda e planejar pagar apenas o mínimo da fatura no mês que vem.",
                deltaBalance: -350,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -40,
                deltaHappy: -20,
                xp: 10,
                isOptimal: false,
                feedback: "Alerta vermelho! Os juros do rotativo do cartão superam 400% ao ano no Brasil. Pagar o mínimo é a via mais rápida para a inadimplência e o endividamento crônico."
            },
            {
                letter: "B",
                icon: "🛡️",
                title: "Ajustar limite e pagar 100% à vista",
                text: "Dizer 'não' para a viagem agora, reduzir o limite no aplicativo e usar o cartão apenas com valor total já disponível na conta.",
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
        title: "Missão 4: O Imprevisto e a Reserva de Emergência",
        npc: "Técnico da Loja",
        role: "Assistência Técnica · Despesa Súbita",
        avatar: "📱",
        zone: "shop",
        targetX: 680,
        targetY: 370,
        intro: "CRASH! A tela do seu celular se estilhaçou no chão. Você depende do aparelho para estudar, trabalhar e acessar seu banco. O conserto urgente custa R$ 300,00 à vista.",
        question: "Qual recurso você utiliza para quitar o reparo?",
        choices: [
            {
                letter: "A",
                icon: "⚠️",
                title: "Entrar no Cheque Especial",
                text: "Utilizar o limite de cheque especial do banco pagando tarifas e juros diários exorbitantes por não ter guardado nada.",
                deltaBalance: -390,
                deltaEmergency: 0,
                deltaInvest: 0,
                deltaHealth: -35,
                deltaHappy: -25,
                xp: 10,
                isOptimal: false,
                feedback: "Sem reserva, o imprevisto virou dívida cara. O cheque especial cobra taxas altíssimas e corrói a renda do trabalhador rapidamente."
            },
            {
                letter: "B",
                icon: "🛡️",
                title: "Acionar a Reserva com Liquidez Diária",
                text: "Resgatar R$ 300 da Reserva de Emergência (guardada em CDB 100% CDI) e programar a reposição no próximo salário.",
                deltaBalance: 0,
                deltaEmergency: -300,
                deltaInvest: 0,
                deltaHealth: 30,
                deltaHappy: 20,
                xp: 55,
                isOptimal: true,
                feedback: "Exatamente para isso serve a Reserva de Emergência! Você liquidou o problema na hora, à vista, sem dever um centavo de juros para instituições financeiras."
            }
        ]
    },
    {
        id: 5,
        title: "Missão 5: O Poder dos Juros Compostos (Primeiros Investimentos)",
        npc: "Mentor Financeiro",
        role: "Banco & Corretora · Multiplicação de Patrimônio",
        avatar: "📈",
        zone: "bank",
        targetX: 790,
        targetY: 170,
        intro: "Parabéns! Suas dívidas estão zeradas, despesas controladas e a reserva estabelecida. Sobraram R$ 400,00 este mês. Chegou a hora de colocar o dinheiro para render acima da inflação!",
        question: "Onde você decide aplicar esses primeiros recursos?",
        choices: [
            {
                letter: "A",
                icon: "🎲",
                title: "Poupança tradicional ou apostas",
                text: "Deixar tudo na poupança antiga (que perde para o IPCA) ou apostar em promessas de retorno fácil de influenciadores.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 150,
                deltaHealth: -15,
                deltaHappy: -5,
                xp: 15,
                isOptimal: false,
                feedback: "Cuidado! Apostas não são investimentos e a poupança frequentemente perde para a inflação real. Dinheiro seguro exige estratégia regulada pela CVM/BCB."
            },
            {
                letter: "B",
                icon: "🌱",
                title: "Tesouro Selic e CDB 100% CDI",
                text: "Investir em títulos do Tesouro Selic e CDB com liquidez e rendimento de 100% do CDI, iniciando a mágica dos juros compostos.",
                deltaBalance: -400,
                deltaEmergency: 0,
                deltaInvest: 400,
                deltaHealth: 40,
                deltaHappy: 30,
                xp: 70,
                isOptimal: true,
                feedback: "Sensacional, investidor! Você ativou a engrenagem mais poderosa das finanças: os juros compostos a seu favor. Com disciplina, seu patrimônio crescerá de forma sólida e protegida!"
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
        this.playTone(650, "sine", 0.04, 0.08);
    }
}

export class FinancialGame2D {
    constructor(canvas, uiContainer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ui = uiContainer;
        this.sound = new SoundEngine();

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

        this.player = {
            x: 470,
            y: 230,
            targetX: 470,
            targetY: 230,
            speed: 3.8,
            direction: "down",
            moving: false,
            frame: 0,
            blinkTimer: 0,
            isBlinking: false
        };

        this.keys = {};
        this.floatingTexts = [];
        this.clickRipples = [];
        this.animId = null;
        this.isModalOpen = false;

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
            if (this.isModalOpen) {
                if (e.key === "Escape") this.closeDecisionModal();
                return;
            }
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

        // Clique ou toque no canvas para guiar Alex com efeito visual de ripple
        this.canvas.addEventListener("pointerdown", e => {
            if (this.isModalOpen) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            this.player.targetX = Math.max(30, Math.min(this.canvas.width - 30, clickX));
            this.player.targetY = Math.max(50, Math.min(this.canvas.height - 40, clickY));

            this.clickRipples.push({
                x: clickX,
                y: clickY,
                radius: 4,
                alpha: 1.0
            });

            this.sound.init();
        });

        // Fechar modal ao clicar no botão X ou no fundo
        document.getElementById("btnFecharGameModal")?.addEventListener("click", () => this.closeDecisionModal());
        document.getElementById("gameModalBackdrop")?.addEventListener("click", e => {
            if (e.target.id === "gameModalBackdrop") this.closeDecisionModal();
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

    update(dt) {
        if (this.isModalOpen) return;

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

        // Limites do canvas
        this.player.x = Math.max(30, Math.min(this.canvas.width - 30, this.player.x));
        this.player.y = Math.max(60, Math.min(this.canvas.height - 40, this.player.y));

        if (this.player.moving) {
            this.player.frame += dt * 11;
        } else {
            this.player.frame = 0;
        }

        // Controle do piscar de olhos
        this.player.blinkTimer += dt;
        if (this.player.blinkTimer > 3.5) {
            this.player.isBlinking = true;
            if (this.player.blinkTimer > 3.65) {
                this.player.isBlinking = false;
                this.player.blinkTimer = 0;
            }
        }

        // Textos flutuantes
        this.floatingTexts.forEach(ft => {
            ft.y -= dt * 32;
            ft.alpha -= dt * 0.8;
        });
        this.floatingTexts = this.floatingTexts.filter(ft => ft.alpha > 0);

        // Ripples de clique
        this.clickRipples.forEach(r => {
            r.radius += dt * 38;
            r.alpha -= dt * 1.8;
        });
        this.clickRipples = this.clickRipples.filter(r => r.alpha > 0);
    }

    addFloatingText(text, color = "#6FE7DD") {
        this.floatingTexts.push({
            text,
            x: this.player.x,
            y: this.player.y - 38,
            color,
            alpha: 1.0
        });
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Fundo ardósia profundo com blueprint de alta resolução
        ctx.fillStyle = "#080D0F";
        ctx.fillRect(0, 0, w, h);

        // Grid sutil no chão do mapa
        ctx.strokeStyle = "rgba(111, 231, 221, 0.04)";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Efeitos de ripples de clique
        this.clickRipples.forEach(r => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.strokeStyle = "#6FE7DD";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        // 1. ZONA 1: ESCRITÓRIO / RH (PRIMEIRO EMPREGO)
        this.drawOfficeZone(35, 45, 275, 195);

        // 2. ZONA 2: QUARTO DO ALEX (HOME OFFICE / ORÇAMENTO)
        this.drawHomeZone(342, 45, 275, 195);

        // 3. ZONA 3: BANCO & CORRETORA LUMUZ (INVESTIMENTOS)
        this.drawBankZone(650, 45, 275, 195);

        // 4. ZONA 4: CENTRO COMERCIAL & SHOPPING (TENTAÇÕES & REPARO)
        this.drawShoppingZone(35, 260, 890, 195);

        // Pontos de Missão e NPCs
        this.drawRichNPC(180, 170, "Chefe do RH", "👔", "#4382B8", 1);
        this.drawRichNPC(470, 170, "LumuzIA App", "💻", "#6FE7DD", 2);
        this.drawRichNPC(790, 170, "Mentor Invest", "📈", "#7CE7A9", 5);
        this.drawRichNPC(250, 370, "Amigo Lucas", "☕", "#F28B82", 3);
        this.drawRichNPC(680, 370, "Técnico Loja", "📱", "#FDD663", 4);

        // Verificar proximidade e desenhar Prompt Interativo
        const curMission = MISSIONS[this.state.currentMissionIndex];
        if (curMission && !this.state.completed && !this.isModalOpen) {
            const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
            if (dist < 65) {
                this.drawInteractiveBeacon(curMission.targetX, curMission.targetY, `[ E ] Falar com ${curMission.npc}`);
            }
        }

        // Desenhar Personagem Alex
        this.drawAlex(this.player.x, this.player.y);

        // Textos flutuantes (+R$ 1.830, XP etc)
        this.floatingTexts.forEach(ft => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.font = "bold 14px 'Space Mono', monospace";
            ctx.fillStyle = ft.color;
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 8;
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });
    }

    drawOfficeZone(x, y, w, h) {
        const ctx = this.ctx;
        // Piso corporativo xadrez
        ctx.fillStyle = "#101B20";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 14);
        ctx.fill();

        ctx.strokeStyle = "rgba(67, 130, 184, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Linha divisória de parede no topo
        ctx.fillStyle = "#15242B";
        ctx.fillRect(x + 1, y + 1, w - 2, 38);

        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#CAD5D8";
        ctx.fillText("🏢 Escritório de RH · Emprego", x + 14, y + 24);

        // Mesa de trabalho em L
        ctx.fillStyle = "#22353E";
        ctx.beginPath();
        ctx.roundRect(x + 130, y + 130, 95, 45, 6);
        ctx.fill();
        ctx.fillStyle = "#334C58";
        ctx.fillRect(x + 140, y + 135, 30, 20); // Monitor
        ctx.fillStyle = "#6FE7DD";
        ctx.fillRect(x + 143, y + 137, 24, 14); // Tela acesa

        // Bebedouro de água
        ctx.fillStyle = "#CAD5D8";
        ctx.fillRect(x + 22, y + 55, 18, 30);
        ctx.fillStyle = "#4382B8";
        ctx.beginPath();
        ctx.arc(x + 31, y + 54, 7, 0, Math.PI * 2);
        ctx.fill();

        // Planta decorativa
        ctx.fillStyle = "#7D5335";
        ctx.fillRect(x + 235, y + 55, 16, 16);
        ctx.fillStyle = "#43CD82";
        ctx.beginPath();
        ctx.arc(x + 243, y + 52, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHomeZone(x, y, w, h) {
        const ctx = this.ctx;
        // Piso de madeira acolhedor
        ctx.fillStyle = "#181D20";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 14);
        ctx.fill();

        ctx.strokeStyle = "rgba(111, 231, 221, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Parede topo
        ctx.fillStyle = "#1F282C";
        ctx.fillRect(x + 1, y + 1, w - 2, 38);

        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#EAEFEF";
        ctx.fillText("🏠 Quarto do Alex · Orçamento", x + 14, y + 24);

        // Tapete geométrico
        ctx.fillStyle = "rgba(111, 231, 221, 0.08)";
        ctx.beginPath();
        ctx.roundRect(x + 70, y + 100, 135, 75, 10);
        ctx.fill();

        // Cama de solteiro
        ctx.fillStyle = "#2D3F47";
        ctx.beginPath();
        ctx.roundRect(x + 20, y + 60, 60, 95, 6);
        ctx.fill();
        ctx.fillStyle = "#CAD5D8";
        ctx.fillRect(x + 26, y + 66, 48, 22); // Travesseiro
        ctx.fillStyle = "#3974B8";
        ctx.fillRect(x + 20, y + 94, 60, 61); // Coberta

        // Mesa de estudos com tela LumuzIA
        ctx.fillStyle = "#2B2621";
        ctx.beginPath();
        ctx.roundRect(x + 145, y + 60, 90, 42, 6);
        ctx.fill();

        // Monitor com brilho verde
        ctx.fillStyle = "#0c1315";
        ctx.fillRect(x + 165, y + 64, 38, 24);
        ctx.fillStyle = "#7CE7A9";
        ctx.fillRect(x + 168, y + 67, 32, 18);

        // Abajur com halo de luz
        const lampX = x + 215;
        const lampY = y + 74;
        const grad = ctx.createRadialGradient(lampX, lampY, 3, lampX, lampY, 35);
        grad.addColorStop(0, "rgba(253, 214, 99, 0.4)");
        grad.addColorStop(1, "rgba(253, 214, 99, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lampX, lampY, 35, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBankZone(x, y, w, h) {
        const ctx = this.ctx;
        // Piso mármore tecnológico
        ctx.fillStyle = "#0F1E1B";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 14);
        ctx.fill();

        ctx.strokeStyle = "rgba(124, 231, 169, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#142A25";
        ctx.fillRect(x + 1, y + 1, w - 2, 38);

        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#7CE7A9";
        ctx.fillText("🏦 Banco & Investimentos", x + 14, y + 24);

        // Terminal ATM de autoatendimento
        ctx.fillStyle = "#1D3A33";
        ctx.fillRect(x + 25, y + 60, 36, 52);
        ctx.fillStyle = "#F2A65A";
        ctx.fillRect(x + 30, y + 68, 26, 16);

        // Cofre / Divisória de vidro com brilho
        ctx.strokeStyle = "rgba(111, 231, 221, 0.5)";
        ctx.strokeRect(x + 110, y + 60, 140, 8);

        // Balcão de consultoria
        ctx.fillStyle = "#1E3C34";
        ctx.beginPath();
        ctx.roundRect(x + 130, y + 130, 100, 40, 8);
        ctx.fill();
    }

    drawShoppingZone(x, y, w, h) {
        const ctx = this.ctx;
        // Calçada urbana de paralelepípedo
        ctx.fillStyle = "#141517";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 14);
        ctx.fill();

        ctx.strokeStyle = "rgba(242, 166, 90, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Letreiro comercial
        ctx.fillStyle = "#1B1C20";
        ctx.fillRect(x + 1, y + 1, w - 2, 38);

        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#F2A65A";
        ctx.fillText("🛍️ Centro Comercial: Lojas, Shopping & Assistência Técnica", x + 18, y + 24);

        // Vitrine Loja de Roupas & Eletrônicos (Lucas)
        ctx.fillStyle = "#22252A";
        ctx.beginPath();
        ctx.roundRect(x + 40, y + 55, 230, 60, 8);
        ctx.fill();
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#F28B82";
        ctx.fillText("💳 PROMOÇÃO: 12x SEM JUROS", x + 55, y + 85);

        // Vitrine Assistência Técnica (Celular)
        ctx.fillStyle = "#24252A";
        ctx.beginPath();
        ctx.roundRect(x + 580, y + 55, 260, 60, 8);
        ctx.fill();
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#FDD663";
        ctx.fillText("📱 CONSERTO EXPRESS DE CELULARES", x + 595, y + 85);

        // Poste de luz com halo no centro
        const postX = x + 440;
        const postY = y + 80;
        const grad = ctx.createRadialGradient(postX, postY, 5, postX, postY, 65);
        grad.addColorStop(0, "rgba(242, 166, 90, 0.25)");
        grad.addColorStop(1, "rgba(242, 166, 90, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(postX, postY, 65, 0, Math.PI * 2);
        ctx.fill();
    }

    drawRichNPC(x, y, name, avatar, badgeColor, missionId) {
        const ctx = this.ctx;
        const isCurrent = (this.state.currentMissionIndex + 1) === missionId && !this.state.completed;

        // Anéis de missão pulsantes no chão
        if (isCurrent) {
            const pulse = (Math.sin(performance.now() * 0.007) + 1) * 8;
            ctx.beginPath();
            ctx.arc(x, y, 22 + pulse, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(242, 166, 90, 0.18)";
            ctx.fill();
            ctx.strokeStyle = "#F2A65A";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Marcador de exclamação animado
            const bob = Math.sin(performance.now() * 0.006) * 4;
            ctx.fillStyle = "#F2A65A";
            ctx.beginPath();
            ctx.arc(x, y - 44 + bob, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0c1315";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.fillText("!", x, y - 39 + bob);
        }

        // Sombra
        ctx.beginPath();
        ctx.ellipse(x, y + 16, 18, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();

        // Corpo
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.roundRect(x - 14, y - 16, 28, 28, 8);
        ctx.fill();

        // Cabeça
        ctx.fillStyle = "#F5D0A9";
        ctx.beginPath();
        ctx.arc(x, y - 18, 12, 0, Math.PI * 2);
        ctx.fill();

        // Emoji avatar no peito
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(avatar, x, y + 5);

        // Tag de nome elegante
        ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#CAD5D8";
        ctx.fillText(name, x, y + 32);
        ctx.textAlign = "left";
    }

    drawAlex(x, y) {
        const ctx = this.ctx;
        const walkCycle = Math.sin(this.player.frame) * 5;

        // Sombra suave sob os pés
        ctx.beginPath();
        ctx.ellipse(x, y + 18, 19, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fill();

        // Pernas com animação de passada
        ctx.fillStyle = "#1E2A30";
        ctx.fillRect(x - 9, y + 6, 7, 12 + (this.player.moving ? walkCycle : 0));
        ctx.fillRect(x + 2, y + 6, 7, 12 - (this.player.moving ? walkCycle : 0));

        // Tênis com detalhe branco
        ctx.fillStyle = "#EAEFEF";
        ctx.fillRect(x - 10, y + 16 + (this.player.moving ? walkCycle : 0), 8, 4);
        ctx.fillRect(x + 2, y + 16 - (this.player.moving ? walkCycle : 0), 8, 4);

        // Tronco: Jaqueta verde esmeralda LumuzIA
        ctx.fillStyle = "#43CD82";
        ctx.beginPath();
        ctx.roundRect(x - 15, y - 16, 30, 24, 7);
        ctx.fill();

        // Detalhe central da camiseta branca
        ctx.fillStyle = "#EAEFEF";
        ctx.fillRect(x - 4, y - 14, 8, 18);

        // Mochila nas costas quando olhando para cima
        if (this.player.direction === "up") {
            ctx.fillStyle = "#2D3F47";
            ctx.fillRect(x - 11, y - 12, 22, 16);
        }

        // Cabeça
        ctx.fillStyle = "#F5D0A9";
        ctx.beginPath();
        ctx.arc(x, y - 20, 12, 0, Math.PI * 2);
        ctx.fill();

        // Cabelo castanho com mecha estilizada
        ctx.fillStyle = "#3B2618";
        ctx.beginPath();
        ctx.arc(x, y - 23, 13, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();

        // Olhos expressivos e piscada
        if (!this.player.isBlinking && this.player.direction !== "up") {
            ctx.fillStyle = "#141C1E";
            const eyeOffset = this.player.direction === "right" ? 3 : this.player.direction === "left" ? -3 : 0;
            ctx.fillRect(x - 5 + eyeOffset, y - 21, 2.5, 3.5);
            ctx.fillRect(x + 2.5 + eyeOffset, y - 21, 2.5, 3.5);
        }

        // Indicador flutuante do personagem
        ctx.font = "bold 11px 'Space Mono', monospace";
        ctx.fillStyle = "#6FE7DD";
        ctx.textAlign = "center";
        ctx.fillText("Alex (Você)", x, y - 38);
        ctx.textAlign = "left";
    }

    drawInteractiveBeacon(x, y, text) {
        const ctx = this.ctx;
        const bob = Math.sin(performance.now() * 0.007) * 4;
        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        const textWidth = ctx.measureText(text).width;

        ctx.fillStyle = "rgba(14, 23, 26, 0.95)";
        ctx.strokeStyle = "#F2A65A";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - textWidth / 2 - 12, y - 56 + bob, textWidth + 24, 30, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F2A65A";
        ctx.textAlign = "center";
        ctx.fillText(text, x, y - 36 + bob);
        ctx.textAlign = "left";
    }

    tryInteract() {
        if (this.state.completed || this.isModalOpen) return;
        const curMission = MISSIONS[this.state.currentMissionIndex];
        if (!curMission) return;

        const dist = Math.hypot(this.player.x - curMission.targetX, this.player.y - curMission.targetY);
        if (dist <= 75) {
            this.openDecisionModal(curMission);
        } else {
            this.player.targetX = curMission.targetX;
            this.player.targetY = curMission.targetY + 20;
            this.addFloatingText("Caminhando até a missão...", "#F2A65A");
        }
    }

    openDecisionModal(mission) {
        this.isModalOpen = true;
        this.sound.click();

        const backdrop = document.getElementById("gameModalBackdrop");
        if (!backdrop) return;

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
        if (missionTagEl) missionTagEl.textContent = `Missão ${mission.id} de 5`;
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
    }

    handleChoice(mission, choice) {
        const optionsEl = document.getElementById("gameDialogOptions");
        const feedbackEl = document.getElementById("gameDialogFeedback");
        const continueBtn = document.getElementById("gameDialogContinue");

        if (optionsEl) optionsEl.hidden = true;

        // Atualizar valores do jogo
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
                <div class="feedback-badge-row">
                    <span class="feedback-status-badge">${choice.isOptimal ? "✓ Decisão Inteligente!" : "⚠️ Ponto de Risco Financeiro!"}</span>
                    <span class="feedback-xp-pill">+${choice.xp} XP</span>
                </div>
                <p class="feedback-text">${choice.feedback}</p>
                <div class="game-feedback-stats">
                    <div><span>💰 Saldo:</span> <strong>R$ ${this.state.balance.toFixed(2)}</strong></div>
                    <div><span>🛡️ Reserva:</span> <strong>R$ ${this.state.emergency.toFixed(2)}</strong></div>
                    <div><span>📈 Investimentos:</span> <strong>R$ ${this.state.investments.toFixed(2)}</strong></div>
                    <div><span>📊 Saúde:</span> <strong>${this.state.health}%</strong></div>
                </div>
            `;
        }

        this.updateHUD();

        if (continueBtn) {
            continueBtn.hidden = false;
            continueBtn.focus();
            continueBtn.onclick = () => {
                this.closeDecisionModal();
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

    closeDecisionModal() {
        const backdrop = document.getElementById("gameModalBackdrop");
        if (backdrop) {
            backdrop.hidden = true;
            backdrop.classList.remove("is-active");
        }
        this.isModalOpen = false;
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
            const stepsHtml = MISSIONS.map((m, idx) => {
                const status = idx < this.state.currentMissionIndex ? "done" : idx === this.state.currentMissionIndex ? "current" : "locked";
                return `<span class="mission-step ${status}">${idx < this.state.currentMissionIndex ? "✓" : idx + 1}</span>`;
            }).join("");

            missionBox.innerHTML = `
                <div class="mission-header-flex">
                    <div class="mission-steps-wrap">${stepsHtml}</div>
                    <span class="mission-counter">Etapa ${curMission.id} de 5</span>
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
        this.state.completed = true;
        this.sound.success();
        const missionBox = document.getElementById("gameMissionTracker");
        if (missionBox) {
            missionBox.innerHTML = `
                <div class="game-victory-card">
                    <div class="victory-badge">🏆 Parabéns, Jovem Gestor!</div>
                    <h3>Você dominou as 5 Etapas Fundamentais da Vida Financeira!</h3>
                    <p>Você aprendeu a planejar pela Receita Líquida real, distribuir o orçamento com a regra 50/30/20, desviar da armadilha do cartão de crédito, montar sua reserva com liquidez diária e aplicar nos primeiros investimentos com juros compostos.</p>
                    <div class="victory-stats-grid">
                        <div><span>Patrimônio Acumulado</span><strong>R$ ${(this.state.balance + this.state.emergency + this.state.investments).toFixed(2)}</strong></div>
                        <div><span>Saúde Financeira</span><strong>${this.state.health}%</strong></div>
                        <div><span>XP Conquistado</span><strong>${this.state.xp} XP</strong></div>
                    </div>
                    <div class="victory-buttons-row">
                        <button id="btnReiniciarJogo" class="education-secondary-button" type="button">Jogar Novamente</button>
                        <button id="btnVoltarTasksVitoria" class="education-primary-button" type="button">Fazer as Tasks da Trilha</button>
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
        this.player.y = 230;
        this.player.targetX = 470;
        this.player.targetY = 230;
        this.updateHUD();
        this.updateMissionUI();
        this.closeDecisionModal();
        this.sound.coin();
    }
}

// Inicialização da interface e alternância de modos
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

    document.getElementById("btnVoltarTasksHeader")?.addEventListener("click", () => toggleMode("tasks"));
    document.getElementById("btnGameRestart")?.addEventListener("click", () => gameInstance?.restart());

    // D-Pad Mobile
    document.querySelectorAll(".game-dpad-btn").forEach(btn => {
        const dir = btn.dataset.dir;
        btn.addEventListener("pointerdown", () => {
            if (gameInstance) {
                gameInstance.sound.init();
                const step = 45;
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
