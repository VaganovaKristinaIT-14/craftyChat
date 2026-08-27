# ============================================
# ROUTES — /api/presets — коллекции пресетов
# (Основной промпт, Доп промпт, мини-пресеты, ползунок лимита токенов)
# ============================================
from flask import Blueprint, request, jsonify
from utils import repo
from utils.ids import generate_id

bp = Blueprint("presets", __name__, url_prefix="/api/presets")


@bp.get("")
def get_all():
    return jsonify(repo.get_presets_data())


@bp.put("")
def replace_all():
    data = request.get_json(force=True)
    repo.save_presets_data(data)
    return jsonify(data)


@bp.post("/collections")
def create_collection():
    body = request.get_json(force=True) or {}
    data = repo.get_presets_data()
    collection = {
        "id": generate_id(),
        "name": body.get("name", "Новая коллекция"),
        "mainPrompt": body.get("mainPrompt", ""),
        "extraPrompt": body.get("extraPrompt", ""),
        "presets": [],
        "tokenLimit": body.get("tokenLimit", 10000),
    }
    data["collections"].append(collection)
    if not data.get("activeCollectionId"):
        data["activeCollectionId"] = collection["id"]
    repo.save_presets_data(data)
    return jsonify(collection), 201


@bp.put("/collections/<collection_id>")
def update_collection(collection_id):
    body = request.get_json(force=True) or {}
    data = repo.get_presets_data()
    collection = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not collection:
        return jsonify({"error": "Коллекция не найдена"}), 404
    for field in ("name", "mainPrompt", "extraPrompt", "tokenLimit"):
        if field in body:
            collection[field] = body[field]
    repo.save_presets_data(data)
    return jsonify(collection)


@bp.delete("/collections/<collection_id>")
def delete_collection(collection_id):
    data = repo.get_presets_data()
    data["collections"] = [c for c in data["collections"] if c["id"] != collection_id]
    if data.get("activeCollectionId") == collection_id:
        data["activeCollectionId"] = data["collections"][0]["id"] if data["collections"] else None
    repo.save_presets_data(data)
    return jsonify({"ok": True})


@bp.post("/collections/<collection_id>/activate")
def activate_collection(collection_id):
    data = repo.get_presets_data()
    if not any(c["id"] == collection_id for c in data["collections"]):
        return jsonify({"error": "Коллекция не найдена"}), 404
    data["activeCollectionId"] = collection_id
    repo.save_presets_data(data)
    return jsonify(data)


# ---------- мини-пресеты (доп промптики внутри коллекции) ----------
@bp.post("/collections/<collection_id>/presets")
def add_mini_preset(collection_id):
    data = repo.get_presets_data()
    collection = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not collection:
        return jsonify({"error": "Коллекция не найдена"}), 404
    number = len(collection["presets"]) + 1
    preset = {
        "id": generate_id(),
        "name": f"Preset {number}",
        "enabled": True,
        "content": "",
    }
    collection["presets"].append(preset)
    repo.save_presets_data(data)
    return jsonify(preset), 201


@bp.put("/collections/<collection_id>/presets/<preset_id>")
def update_mini_preset(collection_id, preset_id):
    body = request.get_json(force=True) or {}
    data = repo.get_presets_data()
    collection = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not collection:
        return jsonify({"error": "Коллекция не найдена"}), 404
    preset = next((p for p in collection["presets"] if p["id"] == preset_id), None)
    if not preset:
        return jsonify({"error": "Пресет не найден"}), 404
    for field in ("name", "enabled", "content"):
        if field in body:
            preset[field] = body[field]
    repo.save_presets_data(data)
    return jsonify(preset)


@bp.delete("/collections/<collection_id>/presets/<preset_id>")
def delete_mini_preset(collection_id, preset_id):
    data = repo.get_presets_data()
    collection = next((c for c in data["collections"] if c["id"] == collection_id), None)
    if not collection:
        return jsonify({"error": "Коллекция не найдена"}), 404
    collection["presets"] = [p for p in collection["presets"] if p["id"] != preset_id]
    repo.save_presets_data(data)
    return jsonify({"ok": True})
