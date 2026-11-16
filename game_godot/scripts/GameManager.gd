extends Node

## Gerenciador Central de Estado da Vida Financeira (Autoload Singleton)

signal stats_changed(balance: float, emergency: float, investments: float, health: int, happiness: int, xp: int)
signal mission_started(mission_data: Dictionary)
signal mission_completed(mission_data: Dictionary, choice_result: Dictionary)
signal game_finished(total_xp: int, final_health: int, final_balance: float)

var balance: float = 1830.0
var emergency_fund: float = 200.0
var investments: float = 0.0
var financial_health: int = 60 # 0 a 100
var happiness: int = 75       # 0 a 100
var total_xp: int = 0

var current_mission_index: int = 0
var missions: Array[Dictionary] = []
var game_completed: bool = false

func _ready() -> void:
	missions = MissionSystem.get_all_missions()
	emit_stats()

func emit_stats() -> void:
	stats_changed.emit(balance, emergency_fund, investments, financial_health, happiness, total_xp)

func get_current_mission() -> Dictionary:
	if current_mission_index < missions.size():
		return missions[current_mission_index]
	return {}

func start_mission(index: int) -> void:
	if index < missions.size():
		current_mission_index = index
		mission_started.emit(missions[current_mission_index])

func make_decision(choice_index: int) -> Dictionary:
	var mission = get_current_mission()
	if mission.is_empty():
		return {}
	
	var choices: Array = mission.get("choices", [])
	if choice_index < 0 or choice_index >= choices.size():
		return {}
		
	var choice: Dictionary = choices[choice_index]
	
	# Aplicar efeitos da decisão
	balance += float(choice.get("delta_balance", 0.0))
	emergency_fund = max(0.0, emergency_fund + float(choice.get("delta_emergency", 0.0)))
	investments = max(0.0, investments + float(choice.get("delta_investment", 0.0)))
	
	financial_health = clampi(financial_health + int(choice.get("delta_health", 0)), 0, 100)
	happiness = clampi(happiness + int(choice.get("delta_happiness", 0)), 0, 100)
	total_xp += int(choice.get("xp", 0))
	
	emit_stats()
	mission_completed.emit(mission, choice)
	
	# Próxima missão
	current_mission_index += 1
	if current_mission_index < missions.size():
		# Inicia a próxima após breve intervalo
		get_tree().create_timer(1.5).timeout.connect(func():
			start_mission(current_mission_index)
		)
	else:
		game_completed = true
		game_finished.emit(total_xp, financial_health, balance + emergency_fund + investments)
		
	return choice

func restart_game() -> void:
	balance = 1830.0
	emergency_fund = 200.0
	investments = 0.0
	financial_health = 60
	happiness = 75
	total_xp = 0
	current_mission_index = 0
	game_completed = false
	emit_stats()
	start_mission(0)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_F11:
		toggle_fullscreen()

func toggle_fullscreen() -> void:
	var mode = DisplayServer.window_get_mode()
	if mode == DisplayServer.WINDOW_MODE_FULLSCREEN:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)

