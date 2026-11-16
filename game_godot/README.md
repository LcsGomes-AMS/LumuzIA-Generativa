# LumuzIA - Vida Financeira 2D (Projeto Godot 4)

Este é o projeto oficial do jogo em 2D desenvolvido com a engine **Godot 4.x** e **GDScript**, focado em educação financeira para jovens no início da vida adulta.

## 🎯 Conceito do Jogo
Você assume o papel de **Alex**, um jovem de 19 anos que acaba de conseguir seu primeiro emprego. Ao longo da jornada, você deve navegar pelo mundo 2D, interagir com mentores, amigos e lojas, enfrentando missões e dilemas financeiros reais:

1. **Missão 1: O Primeiro Salário (Bruto vs Líquido)** — Compreender os descontos legais (INSS/IRRF) e planejar com base na receita líquida real.
2. **Missão 2: A Regra 50/30/20** — Dividir o salário entre 50% necessidades, 30% desejos pessoais e 20% futuro/reserva.
3. **Missão 3: A Armadilha do Cartão de Crédito** — Evitar compras por impulso e os juros rotativos de mais de 400% ao ano.
4. **Missão 4: O Imprevisto & A Reserva de Emergência** — Solucionar despesas súbitas usando liquidez diária sem entrar no cheque especial.
5. **Missão 5: Primeiros Investimentos & Juros Compostos** — Vencer a inflação aplicando em Tesouro Selic e CDBs 100% CDI.

---

## 📁 Estrutura do Projeto
```
game_godot/
├── project.godot               # Arquivo principal de configuração do Godot 4
├── README.md                   # Esta documentação
├── scenes/
│   ├── Main.tscn               # Cena principal com o mundo 2D, jogador, HUD e diálogos
│   ├── Player.tscn             # Cena do personagem Alex (CharacterBody2D)
│   ├── HUD.tscn                # Interface de status (Saldo, Reserva, Investimentos, Saúde, Felicidade, XP)
│   └── DialogBox.tscn          # Caixa de diálogos, escolhas e feedback educativo
└── scripts/
    ├── GameManager.gd          # Singleton central de estado, estatísticas e progresso
    ├── Player.gd               # Movimentação 2D e interação
    ├── MissionSystem.gd        # Catálogo de missões, escolhas e lições financeiras
    ├── FinancialEngine.gd      # Motor com cálculos reais (salário líquido, 50/30/20, juros rotativo e juros compostos)
    ├── HUD.gd                  # Controlador visual da interface
    └── DialogUI.gd             # Gerenciador de diálogos e árvores de decisão
```

---

## 🚀 Como Abrir e Rodar no Godot Engine

1. Baixe o [Godot Engine 4.3+](https://godotengine.org/download) (Standard Edition).
2. Abra o Godot e clique no botão **Importar** (Import).
3. Selecione o arquivo `game_godot/project.godot` e clique em **Importar & Editar**.
4. Pressione **F5** (ou o botão Play no canto superior direito) para rodar o jogo!

### Controles
- **Setas ou WASD**: Movimentar o personagem.
- **E ou Barra de Espaço**: Interagir com personagens e cenários.
- **Mouse**: Clicar nas opções de decisão financeira nos diálogos.

---

## 🌐 Integração Web / Navegador
Este jogo também possui uma implementação web 2D totalmente jogável e integrada diretamente na tela de **Educação Financeira** da LumuzIA (`frontend/educacao.html`), acessível pelo botão **🎮 Jogar Modo 2D: Vida Financeira**.

