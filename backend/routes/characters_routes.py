# ============================================
# ROUTES — /api/characters — карточки персонажей (Bot)
# ============================================
from flask import Blueprint, request, jsonify
from utils import repo
from utils.tokens import count_tokens
from services.avatar_service import process_avatar, AvatarProcessingError

bp = Blueprint("characters", __name__, url_prefix="/api/characters")


def _character_token_count(character):
    fields = character.get("fields", {})
    text = "\n".join([character.get("name", "")] + list(fields.values()))
    return count_tokens(text)


@bp.get("")
def list_characters():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    characters = repo.get_characters()
    total = len(characters)
    start = (page - 1) * per_page
    items = characters[start:start + per_page]
    return jsonify({
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, (total + per_page - 1) // per_page),
    })


@bp.get("/<char_id>")
def get_character(char_id):
    character = repo.get_character(char_id)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404
    result = dict(character)
    result["token_count"] = _character_token_count(character)
    return jsonify(result)


@bp.post("")
def create_character():
    body = request.get_json(force=True) or {}
    characters = repo.get_characters()
    character = repo.default_character()
    character["name"] = body.get("name", character["name"])
    character["first_message"] = body.get("first_message", "")
    character["fields"].update(body.get("fields", {}))
    characters.append(character)
    repo.save_characters(characters)
    return jsonify(character), 201


@bp.put("/<char_id>")
def update_character(char_id):
    body = request.get_json(force=True) or {}
    characters = repo.get_characters()
    character = next((c for c in characters if c["id"] == char_id), None)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404

    if "name" in body:
        character["name"] = body["name"]
    if "first_message" in body:
        character["first_message"] = body["first_message"]
    if "lorebook_id" in body:
        character["lorebook_id"] = body["lorebook_id"]
    if "fields" in body:
        character["fields"].update(body["fields"])

    repo.save_characters(characters)
    result = dict(character)
    result["token_count"] = _character_token_count(character)
    return jsonify(result)


@bp.delete("/<char_id>")
def delete_character(char_id):
    # Удаление персонажа -> удаляются все его чаты. Лорбуки/персоны остаются, но
    # у персон пропадает связь с этим персонажем.
    characters = repo.get_characters()
    characters = [c for c in characters if c["id"] != char_id]
    repo.save_characters(characters)

    for chat in repo.get_chats_by_character(char_id):
        repo.delete_chat(chat["id"])

    personas = repo.get_personas()
    changed = False
    for p in personas:
        if char_id in p.get("linked_characters", []):
            p["linked_characters"].remove(char_id)
            changed = True
    if changed:
        repo.save_personas(personas)

    return jsonify({"ok": True})


@bp.post("/<char_id>/avatar")
def upload_avatar(char_id):
    characters = repo.get_characters()
    character = next((c for c in characters if c["id"] == char_id), None)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404

    if "file" not in request.files:
        return jsonify({"error": "Файл не передан"}), 400
    file = request.files["file"]
    try:
        avatar_b64 = process_avatar(file.read())
    except AvatarProcessingError as e:
        return jsonify({"error": str(e)}), 400

    character["avatar"] = avatar_b64
    repo.save_characters(characters)
    return jsonify({"avatar": avatar_b64})


@bp.post("/<char_id>/lorebook")
def attach_lorebook(char_id):
    body = request.get_json(force=True) or {}
    lorebook_id = body.get("lorebook_id")  # может быть None — открепить
    characters = repo.get_characters()
    character = next((c for c in characters if c["id"] == char_id), None)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404
    character["lorebook_id"] = lorebook_id
    repo.save_characters(characters)
    return jsonify(character)


@bp.get("/<char_id>/export")
def export_character(char_id):
    character = repo.get_character(char_id)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404
    return jsonify(character)


@bp.post("/import")
def import_character():
    body = request.get_json(force=True) or {}
    characters = repo.get_characters()
    character = repo.default_character()
    character["name"] = body.get("name", character["name"])
    character["avatar"] = body.get("avatar")
    character["lorebook_id"] = body.get("lorebook_id")
    character["first_message"] = body.get("first_message", "")
    character["fields"].update(body.get("fields", {}))
    characters.append(character)
    repo.save_characters(characters)
    return jsonify(character), 201
