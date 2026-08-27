# ============================================
# ROUTES — /api/background — фоны приложения
# ============================================
from flask import Blueprint, request, jsonify
from utils import repo, storage
from utils.ids import generate_id
import config
from services.avatar_service import process_background_thumbnail, full_image_to_base64, AvatarProcessingError

bp = Blueprint("background", __name__, url_prefix="/api/background")


@bp.get("")
def get_background():
    return jsonify(repo.get_background())


@bp.post("/upload")
def upload_background():
    if "file" not in request.files:
        return jsonify({"error": "Файл не передан"}), 400
    file = request.files["file"]
    file_bytes = file.read()

    if len(file_bytes) > config.MAX_UPLOAD_SIZE_BYTES:
        return jsonify({"error": "Файл слишком большой! Максимум 5 МБ."}), 400

    data = repo.get_background()
    thumbnails = data.get("thumbnails", [])

    # защита от дублирования по имени и размеру
    existing = next((t for t in thumbnails if t.get("name") == file.filename and t.get("size") == len(file_bytes)), None)
    if existing:
        return jsonify({"error": "Этот фон уже загружен!", "duplicate": True}), 409

    try:
        thumbnail_b64 = process_background_thumbnail(file_bytes)
    except AvatarProcessingError as e:
        return jsonify({"error": str(e)}), 400

    full_b64 = full_image_to_base64(file_bytes)

    new_id = generate_id()
    thumbnails.insert(0, {
        "id": new_id,
        "name": file.filename,
        "size": len(file_bytes),
        "data": thumbnail_b64,
    })

    removed_id = None
    if len(thumbnails) > config.MAX_BACKGROUND_THUMBNAILS:
        removed = thumbnails.pop()
        removed_id = removed["id"]
        storage.delete_file(_bg_full_path(removed_id))

    storage.write_json(_bg_full_path(new_id), {"data": full_b64})

    data["thumbnails"] = thumbnails
    data["selected"] = new_id
    repo.save_background(data)

    return jsonify({"id": new_id, "thumbnail": thumbnail_b64, "removed_id": removed_id}), 201


def _bg_full_path(bg_id):
    import os
    return os.path.join(config.BACKGROUNDS_DIR, f"{bg_id}.json")


@bp.get("/<bg_id>/full")
def get_full_background(bg_id):
    from utils.storage import read_json
    result = read_json(_bg_full_path(bg_id))
    if not result:
        return jsonify({"error": "Фон не найден"}), 404
    return jsonify(result)


@bp.post("/<bg_id>/select")
def select_background(bg_id):
    data = repo.get_background()
    if not any(t["id"] == bg_id for t in data.get("thumbnails", [])):
        return jsonify({"error": "Фон не найден"}), 404
    data["selected"] = bg_id
    repo.save_background(data)
    return jsonify(data)


@bp.delete("/<bg_id>")
def delete_background(bg_id):
    data = repo.get_background()
    thumbnails = data.get("thumbnails", [])
    thumbnails = [t for t in thumbnails if t["id"] != bg_id]
    data["thumbnails"] = thumbnails
    storage.delete_file(_bg_full_path(bg_id))

    if data.get("selected") == bg_id:
        data["selected"] = thumbnails[0]["id"] if thumbnails else None

    repo.save_background(data)
    return jsonify(data)


@bp.post("/reset")
def reset_backgrounds():
    data = repo.get_background()
    for t in data.get("thumbnails", []):
        storage.delete_file(_bg_full_path(t["id"]))
    data = repo.default_background()
    repo.save_background(data)
    return jsonify(data)
