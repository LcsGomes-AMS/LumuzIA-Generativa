extends CharacterBody2D

## Controlador 2D do Personagem (Alex)

@export var speed: float = 180.0
@onready var sprite: ColorRect = $AvatarVisual
@onready var interaction_ray: RayCast2D = $InteractionRay

var can_move: bool = true
var nearby_interactable = null

signal interaction_requested(target)

func _physics_process(_delta: float) -> void:
	if not can_move:
		velocity = Vector2.ZERO
		move_and_slide()
		return
		
	var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = direction * speed
	
	if direction != Vector2.ZERO:
		interaction_ray.target_position = direction * 40.0
		# Feedback visual de caminhada
		sprite.rotation_degrees = sin(Time.get_ticks_msec() * 0.012) * 5.0
	else:
		sprite.rotation_degrees = 0.0
		
	move_and_slide()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact"):
		if nearby_interactable:
			interaction_requested.emit(nearby_interactable)

func _on_interaction_area_area_entered(area: Area2D) -> void:
	if area.is_in_group("interactables"):
		nearby_interactable = area

func _on_interaction_area_area_exited(area: Area2D) -> void:
	if nearby_interactable == area:
		nearby_interactable = null

