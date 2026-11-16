extends Control

## Sistema de Diálogos e Decisões Financeiras

@onready var panel_container: PanelContainer = $Box
@onready var lbl_speaker: Label = $Box/VBox/LblSpeaker
@onready var lbl_text: Label = $Box/VBox/LblText
@onready var choices_container: VBoxContainer = $Box/VBox/ChoicesBox
@onready var lbl_feedback: Label = $Box/VBox/LblFeedback
@onready var btn_next: Button = $Box/VBox/BtnNext

var current_mission: Dictionary = {}

func _ready() -> void:
	visible = false
	btn_next.visible = false
	lbl_feedback.visible = false
	btn_next.pressed.connect(_on_next_pressed)
	GameManager.mission_started.connect(show_dialog_for_mission)

func show_dialog_for_mission(mission: Dictionary) -> void:
	current_mission = mission
	lbl_speaker.text = "💬 " + mission.get("npc", "Mentor Financeiro")
	lbl_text.text = mission.get("description", "")
	lbl_feedback.visible = false
	btn_next.visible = false
	
	# Limpar botões antigos
	for child in choices_container.get_children():
		child.queue_free()
		
	var choices: Array = mission.get("choices", [])
	for i in range(choices.size()):
		var choice = choices[i]
		var btn = Button.new()
		btn.text = choice.get("text", "")
		btn.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		btn.custom_minimum_size = Vector2(0, 44)
		btn.pressed.connect(_on_choice_selected.bind(i))
		choices_container.add_child(btn)
		
	visible = true

func _on_choice_selected(index: int) -> void:
	var result = GameManager.make_decision(index)
	choices_container.visible = false
	
	var is_optimal: bool = result.get("is_optimal", false)
	lbl_feedback.text = ( "✅ " if is_optimal else "⚠️ " ) + result.get("feedback", "")
	lbl_feedback.visible = true
	btn_next.visible = true

func _on_next_pressed() -> void:
	visible = false
	choices_container.visible = true
	btn_next.visible = false
	lbl_feedback.visible = false

