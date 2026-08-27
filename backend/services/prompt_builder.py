# ============================================
# PROMPT BUILDER — сборка мейн промпта:
# [Role] -> [Presets] -> [Character] -> [User] -> [Lore] -> [Summary] -> [Context] -> сообщение
#
# Обрезка при переполнении (от менее важного к более важному):
#   1. Векторные записи лорбука — обрезаются суммарно до N символов (всегда).
#   2. Блоки саммари — удаляются от самых старых, пока промпт не влезет.
# Системный промпт и текущее сообщение пользователя НИКОГДА не обрезаются.
# ============================================
from utils import repo
from utils.tokens import count_tokens

CHARACTER_FIELD_LABELS = {
    "personality": "Характер",
    "behavior": "Речь/поведение",
    "appearance": "Внешность",
    "occupation": "Род деятельности",
    "extra": "Дополнительная информация",
}


def _log(title, content):
    print(f"\n===== {title} =====\n{content}\n===== /{title} =====\n")


def build_role_block(collection):
    if not collection:
        return ""
    main_p = (collection.get("mainPrompt") or "").strip()
    extra_p = (collection.get("extraPrompt") or "").strip()
    parts = [p for p in (main_p, extra_p) if p]
    if not parts:
        return ""
    return "[Role]\n" + "\n\n".join(parts)


def build_presets_block(collection):
    if not collection:
        return ""
    enabled = [p for p in collection.get("presets", []) if p.get("enabled", True) and (p.get("content") or "").strip()]
    if not enabled:
        return ""
    body = "\n\n".join(p["content"].strip() for p in enabled)
    return f"[Presets]\n{body}"


def build_character_block(character):
    if not character:
        return ""
    fields = character.get("fields", {})
    lines = []
    if character.get("name"):
        lines.append(f"Имя: {character['name']}")
    for key, label in CHARACTER_FIELD_LABELS.items():
        value = (fields.get(key) or "").strip()
        if value:
            lines.append(f"{label}: {value}")
    if not lines:
        return ""
    return "[Character]\n" + "\n".join(lines)


def build_user_block(persona):
    if not persona:
        return ""
    desc = (persona.get("description") or "").strip()
    if not desc:
        return ""
    name = persona.get("name", "")
    header = f"Имя: {name}\n" if name else ""
    return f"[User]\n{header}{desc}"


def _get_history_window(messages, scan_depth_percent):
    """Возвращает срез сообщений истории для сканирования ключевых слов
    в зависимости от глубины (0..100%). 100% = вся история, 0% = только текущее сообщение."""
    active = [m for m in messages if not m.get("deleted")]
    if scan_depth_percent <= 0 or not active:
        return []
    if scan_depth_percent >= 100:
        return active
    count = max(1, round(len(active) * scan_depth_percent / 100))
    return active[-count:]


def _keyword_matches(entry_keywords, texts):
    if not entry_keywords:
        return False
    haystacks = [t.lower() for t in texts if t]
    for kw in entry_keywords:
        kw_low = kw.lower().strip()
        if not kw_low:
            continue
        for haystack in haystacks:
            if kw_low in haystack:
                return True
    return False


def select_lore_entries(lorebook, messages, current_user_message, vector_char_limit):
    """Классифицирует и отбирает записи лорбука по алгоритму:
    Постоянные -> Обычные (по ключевым словам + приоритет) -> Векторные (блок, обрезан до N символов)."""
    if not lorebook:
        return "", 0

    entries = [e for e in lorebook.get("entries", []) if e.get("active", True)]

    constant_entries = [e for e in entries if e.get("status") == "constant"]
    normal_entries = [e for e in entries if e.get("status") == "normal"]
    vector_entries = [e for e in entries if e.get("status") == "vector"]

    selected_normal = []
    for entry in normal_entries:
        window = _get_history_window(messages, entry.get("scan_depth", 100))
        window_texts = [m.get("content", "") for m in window] + [current_user_message or ""]
        if _keyword_matches(entry.get("keywords", []), window_texts):
            selected_normal.append(entry)

    # Сортировка обычных записей по приоритету (1 — в начало, 10 — в конец)
    selected_normal.sort(key=lambda e: e.get("priority", 5))

    body_parts = []

    for e in constant_entries:
        if (e.get("content") or "").strip():
            body_parts.append(e["content"].strip())

    for e in selected_normal:
        if (e.get("content") or "").strip():
            body_parts.append(e["content"].strip())

    # Векторные записи — единым блоком, в порядке активации, обрезаны суммарно до N символов
    vector_text = "\n".join(e["content"].strip() for e in vector_entries if (e.get("content") or "").strip())
    vector_discarded = 0
    if vector_text:
        if len(vector_text) > vector_char_limit:
            vector_discarded = len(vector_text) - vector_char_limit
            vector_text = vector_text[:vector_char_limit]
        body_parts.append(vector_text)

    if not body_parts:
        return "", vector_discarded

    block = "[Lore]\nИнформация о мире:\n\n" + "\n\n".join(body_parts)
    return block, vector_discarded


def build_summary_block(chat):
    blocks = chat.get("summary_blocks", [])
    if not blocks:
        return ""
    # Хронологический порядок (от старых к новым) — так удобнее ИИ читать историю
    ordered = sorted(blocks, key=lambda b: b.get("start_index", 0))
    body = "\n\n".join(b.get("summary", "").strip() for b in ordered if (b.get("summary") or "").strip())
    if not body:
        return ""
    return f"[Summary]\n{body}"


def build_context_block(chat, context_count):
    active = [m for m in chat.get("messages", []) if not m.get("deleted")]
    recent = active[-context_count:] if context_count > 0 else []
    if not recent:
        return ""
    lines = []
    for m in recent:
        speaker = "User" if m.get("role") == "user" else "Char"
        lines.append(f"{speaker}: {m.get('content', '')}")
    return "[Context]\n" + "\n".join(lines)


def _assemble(parts):
    return "\n\n".join(p for p in parts if p)


def build_main_prompt(chat_id, user_message):
    """Основная функция сборки промпта. Возвращает dict с промптом и статистикой по токенам."""
    settings = repo.get_settings()
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")

    character = repo.get_character(chat.get("character_id"))
    persona = repo.get_persona(chat.get("persona_id")) if chat.get("persona_id") else None
    lorebook = repo.get_lorebook(character.get("lorebook_id")) if character and character.get("lorebook_id") else None

    collection = repo.get_active_collection() or repo.get_collection(
        (repo.get_presets_data().get("collections") or [{}])[0].get("id")
    )

    token_limit = (collection or {}).get("tokenLimit", settings["token_limit"])
    vector_char_limit = settings["vector_entries_char_limit"]
    context_count = settings["context_messages_count"]

    role_block = build_role_block(collection)
    presets_block = build_presets_block(collection)
    character_block = build_character_block(character)
    user_block = build_user_block(persona)
    lore_block, _ = select_lore_entries(lorebook, chat.get("messages", []), user_message, vector_char_limit)
    summary_block = build_summary_block(chat)
    context_block = build_context_block(chat, context_count)
    current_message_block = (user_message or "").strip()

    # ---- Шаг 1: сборка ----
    full_prompt = _assemble([
        role_block, presets_block, character_block, user_block,
        lore_block, summary_block, context_block, current_message_block,
    ])
    tokens_before = count_tokens(full_prompt)
    _log("СГЕНЕРИРОВАННЫЙ ПРОМПТ (до обрезки)", full_prompt)
    print(f"[PromptBuilder] Токенов до обрезки: {tokens_before}, лимит: {token_limit}")

    if tokens_before <= token_limit:
        return {
            "prompt": full_prompt,
            "tokens_before": tokens_before,
            "tokens_after": tokens_before,
            "discarded_tokens": 0,
            "truncated": False,
        }

    # ---- Шаг 4: обрезка при переполнении ----
    # Векторные записи лорбука уже обрезаны в select_lore_entries (всегда до vector_char_limit).
    # Если всё ещё не влезает — удаляем блоки саммари, начиная с самых старых.
    remaining_summary_blocks = sorted(chat.get("summary_blocks", []), key=lambda b: b.get("start_index", 0))

    while True:
        summary_block = ""
        if remaining_summary_blocks:
            body = "\n\n".join(
                b.get("summary", "").strip() for b in remaining_summary_blocks if (b.get("summary") or "").strip()
            )
            if body:
                summary_block = f"[Summary]\n{body}"

        full_prompt = _assemble([
            role_block, presets_block, character_block, user_block,
            lore_block, summary_block, context_block, current_message_block,
        ])
        tokens_now = count_tokens(full_prompt)

        if tokens_now <= token_limit or not remaining_summary_blocks:
            break

        # удаляем самый старый блок саммари
        remaining_summary_blocks.pop(0)

    tokens_after = count_tokens(full_prompt)
    discarded = max(0, tokens_before - tokens_after)

    _log("СГЕНЕРИРОВАННЫЙ ПРОМПТ (после обрезки)", full_prompt)
    print(f"[PromptBuilder] Токенов после обрезки: {tokens_after}, отброшено: {discarded}")

    return {
        "prompt": full_prompt,
        "tokens_before": tokens_before,
        "tokens_after": tokens_after,
        "discarded_tokens": discarded,
        "truncated": True,
    }
