# ============================================
# ROUTES — /api/settings — глобальные настройки
# ============================================
from flask import Blueprint, request, jsonify
from utils import repo
from utils.tokens import is_tiktoken_available, count_tokens

bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@bp.get("")
def get_settings():
    settings = repo.get_settings()
    settings["tiktoken_available"] = is_tiktoken_available()
    return jsonify(settings)


@bp.put("")
def update_settings():
    body = request.get_json(force=True) or {}
    settings = repo.get_settings()
    for field in (
        "token_limit", "vector_entries_char_limit", "context_messages_count",
        "summary_step_size", "summary_prompt",
    ):
        if field in body:
            settings[field] = body[field]

    if "censor_mode" in body:
        val = body["censor_mode"]
        if val in ("off", "messages", "full"):
            settings["censor_mode"] = val
        else:
            return jsonify({"error": "censor_mode должен быть 'off', 'messages' или 'full'"}), 400

    repo.save_settings(settings)
    return jsonify(settings)


@bp.post("/count-tokens")
def count_tokens_route():
    body = request.get_json(force=True) or {}
    text = body.get("text", "")
    return jsonify({"tokens": count_tokens(text), "tiktoken_available": is_tiktoken_available()})