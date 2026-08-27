# ============================================
# ROUTES — /api/lorebooks — миры (World Info) и их записи
# ============================================
import copy
from flask import Blueprint, request, jsonify
from utils import repo
from utils.ids import generate_id

bp = Blueprint("lorebooks", __name__, url_prefix="/api/lorebooks")


@bp.get("")
def list_lorebooks():
    return jsonify(repo.get_lorebooks())


@bp.get("/<lorebook_id>")
def get_lorebook(lorebook_id):
    lb = repo.get_lorebook(lorebook_id)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    return jsonify(lb)


@bp.post("")
def create_lorebook():
    body = request.get_json(force=True) or {}
    lorebooks = repo.get_lorebooks()
    lb = repo.default_lorebook()
    lb["name"] = body.get("name", lb["name"])
    lorebooks.append(lb)
    repo.save_lorebooks(lorebooks)
    return jsonify(lb), 201


@bp.put("/<lorebook_id>")
def rename_lorebook(lorebook_id):
    body = request.get_json(force=True) or {}
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    if "name" in body:
        lb["name"] = body["name"]
    repo.save_lorebooks(lorebooks)
    return jsonify(lb)


@bp.post("/<lorebook_id>/duplicate")
def duplicate_lorebook(lorebook_id):
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    new_lb = copy.deepcopy(lb)
    new_lb["id"] = generate_id()
    new_lb["name"] = f"{lb['name']} copy"
    for entry in new_lb["entries"]:
        entry["id"] = generate_id()
    lorebooks.append(new_lb)
    repo.save_lorebooks(lorebooks)
    return jsonify(new_lb), 201


@bp.delete("/<lorebook_id>")
def delete_lorebook(lorebook_id):
    # Удаление лорбука -> удаляется только он. Персонажи/персоны остаются, но у них
    # пропадает связь (lorebook_id -> None).
    lorebooks = repo.get_lorebooks()
    lorebooks = [w for w in lorebooks if w["id"] != lorebook_id]
    repo.save_lorebooks(lorebooks)

    characters = repo.get_characters()
    changed = False
    for c in characters:
        if c.get("lorebook_id") == lorebook_id:
            c["lorebook_id"] = None
            changed = True
    if changed:
        repo.save_characters(characters)

    return jsonify({"ok": True})


@bp.get("/<lorebook_id>/export")
def export_lorebook(lorebook_id):
    lb = repo.get_lorebook(lorebook_id)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    return jsonify(lb)


@bp.post("/import")
def import_lorebook():
    body = request.get_json(force=True) or {}
    lorebooks = repo.get_lorebooks()
    lb = repo.default_lorebook()
    lb["name"] = body.get("name", lb["name"])
    entries = body.get("entries", [])
    for e in entries:
        e["id"] = generate_id()
    lb["entries"] = entries
    lorebooks.append(lb)
    repo.save_lorebooks(lorebooks)
    return jsonify(lb), 201


# ============================================
# ЗАПИСИ ЛОРБУКА
# ============================================
@bp.post("/<lorebook_id>/entries")
def create_entry(lorebook_id):
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    entry = repo.default_lore_entry(order=len(lb["entries"]))
    lb["entries"].append(entry)
    repo.save_lorebooks(lorebooks)
    return jsonify(entry), 201


@bp.put("/<lorebook_id>/entries/<entry_id>")
def update_entry(lorebook_id, entry_id):
    body = request.get_json(force=True) or {}
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    entry = next((e for e in lb["entries"] if e["id"] == entry_id), None)
    if not entry:
        return jsonify({"error": "Запись не найдена"}), 404

    for field in ("name", "active", "content", "keywords", "priority", "scan_depth", "status", "order"):
        if field in body:
            entry[field] = body[field]

    # Постоянная запись — глубина сканирования неактивна (игнорируется логически)
    if entry.get("status") == "constant":
        entry["scan_depth"] = 100

    repo.save_lorebooks(lorebooks)
    return jsonify(entry)


@bp.delete("/<lorebook_id>/entries/<entry_id>")
def delete_entry(lorebook_id, entry_id):
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    lb["entries"] = [e for e in lb["entries"] if e["id"] != entry_id]
    repo.save_lorebooks(lorebooks)
    return jsonify({"ok": True})


@bp.put("/<lorebook_id>/entries/reorder")
def reorder_entries(lorebook_id):
    """Изменение порядка записей (drag&drop) — принимает список ID в новом порядке."""
    body = request.get_json(force=True) or {}
    order = body.get("order", [])  # список entry_id по порядку
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404

    entries_by_id = {e["id"]: e for e in lb["entries"]}
    new_entries = []
    for idx, entry_id in enumerate(order):
        if entry_id in entries_by_id:
            entries_by_id[entry_id]["order"] = idx
            new_entries.append(entries_by_id[entry_id])
    # добавляем те, что не попали в order (на всякий случай), в конец
    for e in lb["entries"]:
        if e["id"] not in order:
            new_entries.append(e)

    lb["entries"] = new_entries
    repo.save_lorebooks(lorebooks)
    return jsonify(lb)


@bp.post("/<lorebook_id>/entries/<entry_id>/keywords")
def add_keyword(lorebook_id, entry_id):
    body = request.get_json(force=True) or {}
    keyword = (body.get("keyword") or "").strip()
    if not keyword:
        return jsonify({"error": "keyword обязателен"}), 400

    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    entry = next((e for e in lb["entries"] if e["id"] == entry_id), None)
    if not entry:
        return jsonify({"error": "Запись не найдена"}), 404

    if keyword not in entry["keywords"]:
        entry["keywords"].append(keyword)
    repo.save_lorebooks(lorebooks)
    return jsonify(entry)


@bp.delete("/<lorebook_id>/entries/<entry_id>/keywords/<keyword>")
def remove_keyword(lorebook_id, entry_id, keyword):
    lorebooks = repo.get_lorebooks()
    lb = next((w for w in lorebooks if w["id"] == lorebook_id), None)
    if not lb:
        return jsonify({"error": "Лорбук не найден"}), 404
    entry = next((e for e in lb["entries"] if e["id"] == entry_id), None)
    if not entry:
        return jsonify({"error": "Запись не найдена"}), 404

    entry["keywords"] = [k for k in entry["keywords"] if k != keyword]
    repo.save_lorebooks(lorebooks)
    return jsonify(entry)
