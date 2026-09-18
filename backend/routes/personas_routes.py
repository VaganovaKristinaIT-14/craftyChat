# ============================================
# ROUTES — /api/personas — карточки персон (User)
# ============================================
from flask import Blueprint, request, jsonify
from utils import repo
from services.avatar_service import process_avatar, AvatarProcessingError

bp = Blueprint("personas", __name__, url_prefix="/api/personas")


@bp.get("")
def list_personas():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    personas = repo.get_personas()
    total = len(personas)
    start = (page - 1) * per_page
    items = personas[start:start + per_page]
    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total + per_page - 1) // per_page),
        "active_persona_id": repo.get_active_persona_id(),
    })


@bp.get("/<persona_id>")
def get_persona(persona_id):
    persona = repo.get_persona(persona_id)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404
    return jsonify(persona)


@bp.post("")
def create_persona():
    body = request.get_json(force=True) or {}
    personas = repo.get_personas()
    persona = repo.default_persona()
    persona["name"] = body.get("name", persona["name"])
    persona["description"] = body.get("description", "")
    personas.append(persona)
    repo.save_personas(personas)
    return jsonify(persona), 201


@bp.put("/<persona_id>")
def update_persona(persona_id):
    body = request.get_json(force=True) or {}
    personas = repo.get_personas()
    persona = next((p for p in personas if p["id"] == persona_id), None)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404
    for field in ("name", "description"):
        if field in body:
            persona[field] = body[field]
    repo.save_personas(personas)
    return jsonify(persona)


@bp.delete("/<persona_id>")
def delete_persona(persona_id):
    # Удаление персоны -> удаляется только она, отвязывается от персонажей (для их чатов
    # дальше будет использоваться дефолтная персона).
    personas = repo.get_personas()
    personas = [p for p in personas if p["id"] != persona_id]
    repo.save_personas(personas)

    if repo.get_active_persona_id() == persona_id:
        repo.set_active_persona_id(None)

    return jsonify({"ok": True})


@bp.post("/<persona_id>/avatar")
def upload_avatar(persona_id):
    personas = repo.get_personas()
    persona = next((p for p in personas if p["id"] == persona_id), None)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404

    if "file" not in request.files:
        return jsonify({"error": "Файл не передан"}), 400
    file = request.files["file"]
    try:
        avatar_b64 = process_avatar(file.read())
    except AvatarProcessingError as e:
        return jsonify({"error": str(e)}), 400

    persona["avatar"] = avatar_b64
    repo.save_personas(personas)
    return jsonify({"avatar": avatar_b64})


@bp.post("/<persona_id>/activate")
def activate_persona(persona_id):
    if not repo.get_persona(persona_id):
        return jsonify({"error": "Персона не найдена"}), 404
    repo.set_active_persona_id(persona_id)
    return jsonify({"active_persona_id": persona_id})


@bp.post("/<persona_id>/link-character")
def link_character(persona_id):
    body = request.get_json(force=True) or {}
    character_id = body.get("character_id")
    if not character_id:
        return jsonify({"error": "character_id обязателен"}), 400

    personas = repo.get_personas()
    persona = next((p for p in personas if p["id"] == persona_id), None)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404

    # 1. Убираем старые привязки этого персонажа у других персон
    for p in personas:
        if character_id in p.get("linked_characters", []) and p["id"] != persona_id:
            p["linked_characters"].remove(character_id)  # Исправлено: character_id

    # 2. Добавляем привязку текущей персоне
    if character_id not in persona["linked_characters"]:
        persona["linked_characters"].append(character_id)

    repo.save_personas(personas)

    # --- НОВОЕ: Синхронизируем все существующие чаты этого персонажа ---
    chats = repo.get_chats_by_character(character_id)
    for chat in chats:
        if chat.get("persona_id") != persona_id:
            chat["persona_id"] = persona_id
            repo.save_chat(chat)
    # -----------------------------------------------------------------

    return jsonify(persona)


@bp.post("/<persona_id>/unlink-character")
def unlink_character(persona_id):
    body = request.get_json(force=True) or {}
    character_id = body.get("character_id")

    personas = repo.get_personas()
    persona = next((p for p in personas if p["id"] == persona_id), None)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404

    if character_id in persona.get("linked_characters", []):
        persona["linked_characters"].remove(character_id)

    repo.save_personas(personas)

    # --- НОВОЕ: Сбрасываем чаты на глобальную активную персону ---
    active_p_id = repo.get_active_persona_id()
    chats = repo.get_chats_by_character(character_id)
    for chat in chats:
        chat["persona_id"] = active_p_id
        repo.save_chat(chat)
    # -------------------------------------------------------------

    return jsonify(persona)

@bp.get("/for-character/<character_id>")
def persona_for_character(character_id):
    """Если к персонажу привязана персона — она становится активной автоматически
    при открытии чата с ним."""
    personas = repo.get_personas()
    persona = next((p for p in personas if character_id in p.get("linked_characters", [])), None)
    return jsonify(persona)


@bp.get("/<persona_id>/export")
def export_persona(persona_id):
    persona = repo.get_persona(persona_id)
    if not persona:
        return jsonify({"error": "Персона не найдена"}), 404
    return jsonify(persona)


@bp.post("/import")
def import_persona():
    body = request.get_json(force=True) or {}
    personas = repo.get_personas()
    persona = repo.default_persona()
    persona["name"] = body.get("name", persona["name"])
    persona["description"] = body.get("description", "")
    persona["avatar"] = body.get("avatar")
    personas.append(persona)
    repo.save_personas(personas)
    return jsonify(persona), 201
