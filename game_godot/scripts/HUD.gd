extends CanvasLayer

## Gerenciamento da Interface de Usuário (HUD)

@onready var lbl_balance: Label = $TopBar/HBox/BalanceBox/LblBalance
@onready var lbl_emergency: Label = $TopBar/HBox/EmergencyBox/LblEmergency
@onready var lbl_invest: Label = $TopBar/HBox/InvestBox/LblInvest
@onready var bar_health: ProgressBar = $TopBar/HBox/HealthBox/BarHealth
@onready var bar_happiness: ProgressBar = $TopBar/HBox/HappyBox/BarHappy
@onready var lbl_xp: Label = $TopBar/HBox/XpBox/LblXp

@onready var mission_panel: PanelContainer = $MissionPanel
@onready var lbl_mission_title: Label = $MissionPanel/VBox/LblTitle
@onready var lbl_mission_desc: Label = $MissionPanel/VBox/LblDesc

func _ready() -> void:
	GameManager.stats_changed.connect(_on_stats_changed)
	GameManager.mission_started.connect(_on_mission_started)
	_on_stats_changed(GameManager.balance, GameManager.emergency_fund, GameManager.investments, GameManager.financial_health, GameManager.happiness, GameManager.total_xp)

func _on_stats_changed(balance: float, emergency: float, investments: float, health: int, happiness: int, xp: int) -> void:
	lbl_balance.text = "R$ " + ("%.2f" % balance)
	lbl_emergency.text = "R$ " + ("%.2f" % emergency)
	lbl_invest.text = "R$ " + ("%.2f" % investments)
	bar_health.value = health
	bar_happiness.value = happiness
	lbl_xp.text = str(xp) + " XP"

func _on_mission_started(mission: Dictionary) -> void:
	lbl_mission_title.text = mission.get("title", "")
	lbl_mission_desc.text = mission.get("description", "")

