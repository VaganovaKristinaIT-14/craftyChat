# ============================================
# REPO — CRUD-обёртки над storage.py для всех сущностей
# ============================================
import os
import config
from utils.storage import read_json, write_json, delete_file
from utils.ids import generate_id


# ============================================
# НАСТРОЙКИ (глобальные)
# ============================================
def get_settings():
    settings = read_json(config.SETTINGS_FILE, None)
    if settings is None:
        settings = dict(config.DEFAULT_SETTINGS)
        write_json(config.SETTINGS_FILE, settings)
    else:
        merged = dict(config.DEFAULT_SETTINGS)
        merged.update(settings)
        settings = merged
    return settings


def save_settings(settings):
    write_json(config.SETTINGS_FILE, settings)
    return settings


# ============================================
# ПРЕСЕТЫ (коллекции: основной промпт + доп промпт + мини-пресеты)
# ============================================
def default_presets_data():
    return {
        "collections": [
            {
                "id": generate_id(),
                "name": "Основной",
                "mainPrompt": "Ты — персонаж. Отвечай коротко, по делу. Не повторяй действия пользователя.",
                "extraPrompt": "Будь саркастичным, но не злым. Используй короткие фразы.",
                "presets": [],
                "tokenLimit": 10000,
            }
        ],
        "activeCollectionId": None,
    }


def get_presets_data():
    data = read_json(config.PRESETS_FILE, None)
    if not data:
        data = default_presets_data()
        data["activeCollectionId"] = data["collections"][0]["id"]
        write_json(config.PRESETS_FILE, data)
    return data


def save_presets_data(data):
    write_json(config.PRESETS_FILE, data)
    return data


def get_active_collection():
    data = get_presets_data()
    return next((c for c in data["collections"] if c["id"] == data.get("activeCollectionId")), None)


def get_collection(collection_id):
    data = get_presets_data()
    return next((c for c in data["collections"] if c["id"] == collection_id), None)


# ============================================
# ПЕРСОНАЖИ (Bot)
# ============================================
def default_character():
    return {
        "id": generate_id(),
        "name": "New character",
        "avatar": None,
        "lorebook_id": None,
        "first_message": "",
        "fields": {
            "personality": "",
            "behavior": "",
            "appearance": "",
            "occupation": "",
            "extra": "",
        },
    }


def get_characters():
    data = read_json(config.CHARACTERS_FILE, None)
    if data is None:
        data = []
        write_json(config.CHARACTERS_FILE, data)
    return data


def save_characters(characters):
    write_json(config.CHARACTERS_FILE, characters)
    return characters


def get_character(char_id):
    return next((c for c in get_characters() if c["id"] == char_id), None)


# ============================================
# ПЕРСОНЫ (User)
# ============================================
def default_persona():
    return {
        "id": generate_id(),
        "name": "New persona",
        "avatar": None,
        "description": "",
        "linked_characters": [],
    }


def get_personas():
    data = read_json(config.PERSONAS_FILE, None)
    if data is None:
        data = []
        write_json(config.PERSONAS_FILE, data)
    return data


def save_personas(personas):
    write_json(config.PERSONAS_FILE, personas)
    return personas


def get_persona(persona_id):
    return next((p for p in get_personas() if p["id"] == persona_id), None)


def get_active_persona_id():
    settings = read_json(config.SETTINGS_FILE, {}) or {}
    return settings.get("active_persona_id")


def set_active_persona_id(persona_id):
    settings = get_settings()
    settings["active_persona_id"] = persona_id
    save_settings(settings)


# ============================================
# ЛОРБУКИ (миры)
# ============================================
def default_lore_entry(order=0):
    return {
        "id": generate_id(),
        "name": "New entry",
        "active": True,
        "content": "",
        "keywords": [],
        "priority": 5,        # 1 — самый высокий приоритет, 10 — самый низкий
        "scan_depth": 100,    # % истории для сканирования ключевых слов
        "status": "normal",   # "constant" | "normal" | "vector"
        "order": order,
    }


def default_lorebook():
    return {
        "id": generate_id(),
        "name": "New World",
        "entries": [],
    }


def get_lorebooks():
    data = read_json(config.LOREBOOKS_FILE, None)
    if data is None:
        data = []
        write_json(config.LOREBOOKS_FILE, data)
    return data


def save_lorebooks(lorebooks):
    write_json(config.LOREBOOKS_FILE, lorebooks)
    return lorebooks


def get_lorebook(lorebook_id):
    return next((w for w in get_lorebooks() if w["id"] == lorebook_id), None)


# ============================================
# ФОН
# ============================================
def default_background():
    return {"selected": None, "thumbnails": []}


def get_background():
    data = read_json(config.BACKGROUND_FILE, None)
    if data is None:
        data = default_background()
        write_json(config.BACKGROUND_FILE, data)
    return data


def save_background(data):
    write_json(config.BACKGROUND_FILE, data)
    return data


# ============================================
# ЧАТЫ (каждый чат — отдельный JSON-файл + индексный файл)
# ============================================
def _chat_path(chat_id):
    return os.path.join(config.CHATS_DIR, f"{chat_id}.json")


def default_chat(character_id, persona_id=None, name=None):
    settings = get_settings()
    character = get_character(character_id)
    return {
        "id": generate_id(),
        "character_id": character_id,
        "persona_id": persona_id,
        "name": name or f"Чат с {character['name'] if character else 'персонажем'}",
        "messages": [],
        "summary_blocks": [],
        "last_summarized_index": -1,
        "step_size": settings.get("summary_step_size", 10),
        "mode": "user",   # "user" | "char" — чья сейчас очередь отвечать
        "pinned": False,
        "created": _now_iso(),
        "updated": _now_iso(),
    }


def _now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def get_chat(chat_id):
    return read_json(_chat_path(chat_id), None)


def save_chat(chat):
    chat["updated"] = _now_iso()
    write_json(_chat_path(chat["id"]), chat)
    update_chats_index(chat)
    return chat


def delete_chat(chat_id):
    delete_file(_chat_path(chat_id))
    index = get_chats_index()
    index = [c for c in index if c["id"] != chat_id]
    save_chats_index(index)


def get_chats_by_character(character_id):
    index = get_chats_index()
    chat_ids = [c["id"] for c in index if c["character_id"] == character_id]
    return [get_chat(cid) for cid in chat_ids if get_chat(cid)]


# ---------- Индексный файл (для главной страницы) ----------
def get_chats_index():
    data = read_json(config.CHATS_INDEX_FILE, None)
    if data is None:
        data = []
        write_json(config.CHATS_INDEX_FILE, data)
    return data


def save_chats_index(index):
    write_json(config.CHATS_INDEX_FILE, index)
    return index


def update_chats_index(chat):
    index = get_chats_index()
    existing = next((c for c in index if c["id"] == chat["id"]), None)

    active_msgs = [m for m in chat["messages"] if not m.get("deleted")]
    last_msg = active_msgs[-1] if active_msgs else None
    preview = (last_msg["content"][:50] if last_msg else "")
    chat_size = sum(len(m.get("content", "")) for m in chat["messages"])

    entry = {
        "id": chat["id"],
        "character_id": chat["character_id"],
        "persona_id": chat.get("persona_id"),
        "name": chat["name"],
        "updated": chat["updated"],
        "created": chat.get("created", chat["updated"]),
        "pinned": chat.get("pinned", False),
        "last_message_preview": preview,
        "messages_count": len(active_msgs),
        "chat_size_chars": chat_size,
    }

    if existing:
        idx = index.index(existing)
        index[idx] = entry
    else:
        index.append(entry)

    save_chats_index(index)
