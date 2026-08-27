# ============================================
# ROUTES — /api/chats — чаты, сообщения, чекпоинты, режимы user/char
# ============================================
import copy
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from utils import repo
from utils.ids import generate_id
from services import summary_service
from services.prompt_builder import build_main_prompt

bp = Blueprint("chats", __name__, url_prefix="/api/chats")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ============================================
# ГЛАВНАЯ СТРАНИЦА — последние чаты
# ============================================
@bp.get("/recent")
def recent_chats():
    index = repo.get_chats_index()
    # закреплённые — вверху, дальше по дате обновления
    index.sort(key=lambda c: (not c.get("pinned", False), c["updated"]), reverse=False)
    index.sort(key=lambda c: c["updated"], reverse=True)
    index.sort(key=lambda c: c.get("pinned", False), reverse=True)
    return jsonify(index[:10])


@bp.get("")
def list_all_chats():
    character_id = request.args.get("character_id")
    if character_id:
        return jsonify(repo.get_chats_by_character(character_id))
    return jsonify(repo.get_chats_index())


# ============================================
# CRUD ЧАТА
# ============================================
@bp.get("/<chat_id>")
def get_chat(chat_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    page = request.args.get("page")
    per_page = int(request.args.get("per_page", 20))
    active_msgs = chat["messages"]

    if page is not None:
        page = int(page)
        total = len(active_msgs)
        start = max(0, total - page * per_page)
        end = total - (page - 1) * per_page
        chat = dict(chat)
        chat["messages"] = active_msgs[max(0, start):max(0, end)]
        chat["messages_total"] = total

    return jsonify(chat)


@bp.post("")
def create_chat():
    body = request.get_json(force=True) or {}
    character_id = body.get("character_id")
    if not character_id:
        return jsonify({"error": "character_id обязателен"}), 400
    character = repo.get_character(character_id)
    if not character:
        return jsonify({"error": "Персонаж не найден"}), 404

    # Если к персонажу привязана персона — она становится активной автоматически
    personas = repo.get_personas()
    linked_persona = next((p for p in personas if character_id in p.get("linked_characters", [])), None)
    persona_id = body.get("persona_id") or (linked_persona["id"] if linked_persona else repo.get_active_persona_id())

    chat = repo.default_chat(character_id, persona_id, body.get("name"))

    # Если у карточки чара есть вступительное сообщение — оно выводится первым (от Char),
    # и далее диалог всё равно продолжается в режиме User.
    if character.get("first_message"):
        chat["messages"].append({
            "index": 0,
            "role": "assistant",
            "content": character["first_message"],
            "timestamp": _now_iso(),
            "deleted": False,
        })
    chat["mode"] = "user"

    repo.save_chat(chat)
    return jsonify(chat), 201


@bp.put("/<chat_id>")
def update_chat(chat_id):
    body = request.get_json(force=True) or {}
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    for field in ("name", "pinned", "mode"):
        if field in body:
            chat[field] = body[field]
    repo.save_chat(chat)
    return jsonify(chat)


@bp.delete("/<chat_id>")
def delete_chat(chat_id):
    if not repo.get_chat(chat_id):
        return jsonify({"error": "Чат не найден"}), 404
    repo.delete_chat(chat_id)
    return jsonify({"ok": True})


@bp.post("/<chat_id>/checkpoint")
def create_checkpoint(chat_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    checkpoint = copy.deepcopy(chat)
    checkpoint["id"] = generate_id()
    existing_checkpoints = [c for c in repo.get_chats_by_character(chat["character_id"])
                             if c["name"].startswith(chat["name"] + " Checkpoint")]
    checkpoint["name"] = f"{chat['name']} Checkpoint {len(existing_checkpoints) + 1}"
    checkpoint["created"] = _now_iso()
    repo.save_chat(checkpoint)
    return jsonify(checkpoint), 201


# ============================================
# СООБЩЕНИЯ
# ============================================
@bp.post("/<chat_id>/messages")
def add_message(chat_id):
    body = request.get_json(force=True) or {}
    role = body.get("role")  # "user" | "assistant"
    content = body.get("content", "")
    if role not in ("user", "assistant"):
        return jsonify({"error": "role должен быть 'user' или 'assistant'"}), 400

    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    # Важный момент: если последний ответ был от бота, нельзя генерировать промпт/отвечать
    # за user, пока не будет реального ответа от Char — контролируется через mode.
    next_index = (chat["messages"][-1]["index"] + 1) if chat["messages"] else 0
    message = {
        "index": next_index,
        "role": role,
        "content": content,
        "timestamp": _now_iso(),
        "deleted": False,
    }
    chat["messages"].append(message)

    # автоматическое переключение режима после каждой отправки
    chat["mode"] = "char" if role == "user" else "user"

    repo.save_chat(chat)

    unsummarized_count = len([m for m in chat["messages"]
                               if not m.get("deleted") and m["index"] > chat.get("last_summarized_index", -1)])
    notify_summary = unsummarized_count > 0 and unsummarized_count % 10 == 0

    return jsonify({
        "message": message,
        "chat_mode": chat["mode"],
        "notify_update_history": notify_summary,
    }), 201


@bp.put("/<chat_id>/messages/<int:index>")
def edit_message(chat_id, index):
    body = request.get_json(force=True) or {}
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    message = next((m for m in chat["messages"] if m["index"] == index), None)
    if not message:
        return jsonify({"error": "Сообщение не найдено"}), 404
    message["content"] = body.get("content", message["content"])
    repo.save_chat(chat)
    return jsonify(message)


@bp.delete("/<chat_id>/messages")
def delete_messages(chat_id):
    """Массовое удаление (пометка deleted=true) — тело запроса: {"indices": [1,2,3]}.
    Не удаляет физически, только помечает. Также чистит связанные блоки саммари."""
    body = request.get_json(force=True) or {}
    indices = body.get("indices", [])
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    for m in chat["messages"]:
        if m["index"] in indices:
            m["deleted"] = True
    repo.save_chat(chat)

    summary_result = summary_service.handle_messages_deletion(chat_id, indices)

    return jsonify({
        "ok": True,
        "deleted_indices": indices,
        "summary_blocks_removed": summary_result["removed_blocks"],
        "last_summarized_index": summary_result["last_summarized_index"],
    })


@bp.delete("/<chat_id>/messages/<int:index>")
def delete_single_message(chat_id, index):
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    message = next((m for m in chat["messages"] if m["index"] == index), None)
    if not message:
        return jsonify({"error": "Сообщение не найдено"}), 404
    message["deleted"] = True
    repo.save_chat(chat)
    summary_result = summary_service.handle_messages_deletion(chat_id, [index])
    return jsonify({
        "ok": True,
        "summary_blocks_removed": summary_result["removed_blocks"],
        "last_summarized_index": summary_result["last_summarized_index"],
    })


# ============================================
# РЕЖИМЫ user/char
# ============================================
@bp.post("/<chat_id>/mode")
def set_mode(chat_id):
    body = request.get_json(force=True) or {}
    mode = body.get("mode")
    if mode not in ("user", "char"):
        return jsonify({"error": "mode должен быть 'user' или 'char'"}), 400
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    chat["mode"] = mode
    repo.save_chat(chat)
    return jsonify({"mode": mode})


# ============================================
# ГЕНЕРАЦИЯ ГЛАВНОГО ПРОМПТА
# ============================================
@bp.post("/<chat_id>/generate-prompt")
def generate_prompt(chat_id):
    body = request.get_json(force=True) or {}
    user_message = body.get("message", "")

    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    # Если последний неудалённый ответ был от бота (char), значит очередь персоны —
    # нельзя сгенерировать промпт, пока не ответит user.
    active_msgs = [m for m in chat["messages"] if not m.get("deleted")]
    if active_msgs and active_msgs[-1]["role"] == "assistant" and chat.get("mode") == "char":
        return jsonify({
            "ok": False,
            "message": "Сделайте ответ от user и промпт сгенерируется",
        }), 409

    result = build_main_prompt(chat_id, user_message)
    result["ok"] = True
    return jsonify(result)


# ============================================
# ЭКСПОРТ ЧАТА
# ============================================
@bp.get("/<chat_id>/export/json")
def export_chat_json(chat_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    return jsonify(chat)


@bp.get("/<chat_id>/export/txt")
def export_chat_txt(chat_id):
    from flask import Response
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404

    character = repo.get_character(chat["character_id"])
    persona = repo.get_persona(chat["persona_id"]) if chat.get("persona_id") else None
    char_name = character["name"] if character else "Char"
    persona_name = persona["name"] if persona else "User"

    lines = [f"Чат: {chat['name']}", ""]
    for m in chat["messages"]:
        if m.get("deleted"):
            continue
        speaker = persona_name if m["role"] == "user" else char_name
        lines.append(f"[{m['timestamp']}] {speaker}: {m['content']}")

    text = "\n".join(lines)
    return Response(
        text, mimetype="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{chat["name"]}.txt"'}
    )


@bp.post("/import")
def import_chat():
    body = request.get_json(force=True) or {}
    chat = body.get("chat") or body
    chat["id"] = generate_id()
    repo.save_chat(chat)
    return jsonify(chat), 201


# ============================================
# САММАРИ (эндпоинты чата, делегируют в summary_service)
# ============================================
@bp.get("/<chat_id>/summary/status")
def summary_status(chat_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    return jsonify(summary_service.get_summary_status(chat))


@bp.post("/<chat_id>/summary/generate-prompt")
def generate_summary_prompt(chat_id):
    body = request.get_json(force=True) or {}
    prompt_text = body.get("summary_prompt")
    try:
        result = summary_service.build_summary_prompt(chat_id, prompt_text)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(result)


@bp.post("/<chat_id>/summary/blocks")
def save_summary(chat_id):
    body = request.get_json(force=True) or {}
    try:
        block = summary_service.save_summary_block(
            chat_id,
            body.get("start_index"),
            body.get("end_index"),
            body.get("summary", ""),
            body.get("name"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(block), 201


@bp.post("/<chat_id>/summary/blocks/empty")
def add_empty_summary(chat_id):
    try:
        block = summary_service.add_empty_summary_block(chat_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(block), 201


@bp.put("/<chat_id>/summary/blocks/<block_id>")
def edit_summary_block(chat_id, block_id):
    body = request.get_json(force=True) or {}
    chat = repo.get_chat(chat_id)
    if not chat:
        return jsonify({"error": "Чат не найден"}), 404
    block = next((b for b in chat["summary_blocks"] if b["id"] == block_id), None)
    if not block:
        return jsonify({"error": "Блок не найден"}), 404
    for field in ("name", "summary"):
        if field in body:
            block[field] = body[field]
    repo.save_chat(chat)
    return jsonify(block)


@bp.delete("/<chat_id>/summary/blocks/<block_id>")
def delete_summary(chat_id, block_id):
    try:
        blocks = summary_service.delete_summary_block(chat_id, block_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(blocks)
