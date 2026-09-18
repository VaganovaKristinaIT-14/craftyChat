# ============================================
# PROMPT BUILDER — сборка мейн промпта:
# [Role] -> [System] -> [Character] -> [User] -> [Lore] -> [Summary] -> [Context] -> [Instruction] -> сообщение
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
    content = "\n\n".join(parts)
    return f"[Role]\n{{{{ {content} }}}}"


def build_presets_block(collection):
    """Пресеты теперь называются [System] — это системные указания"""
    if not collection:
        return ""
    enabled = [p for p in collection.get("presets", []) if p.get("enabled", True) and (p.get("content") or "").strip()]
    if not enabled:
        return ""
    body = "\n\n".join(p["content"].strip() for p in enabled)
    return f"[System]\n{{{{ {body} }}}}"


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
    content = "\n".join(lines)
    return f"[Character]\n{{{{ {content} }}}}"


def build_user_block(persona):
    if not persona:
        return ""
    desc = (persona.get("description") or "").strip()
    if not desc:
        return ""
    name = persona.get("name", "")
    header = f"Имя: {name}\n" if name else ""
    return f"[User]\n{{{{ {header}{desc} }}}}"


def _get_history_window(messages, scan_depth_percent):
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

    selected_normal.sort(key=lambda e: e.get("priority", 5))
    body_parts = []

    for e in constant_entries:
        if (e.get("content") or "").strip():
            body_parts.append(e["content"].strip())
    for e in selected_normal:
        if (e.get("content") or "").strip():
            body_parts.append(e["content"].strip())

    vector_text = "\n".join(e["content"].strip() for e in vector_entries if (e.get("content") or "").strip())
    vector_discarded = 0
    if vector_text:
        if len(vector_text) > vector_char_limit:
            vector_discarded = len(vector_text) - vector_char_limit
            vector_text = vector_text[:vector_char_limit]
        body_parts.append(vector_text)

    if not body_parts:
        return "", vector_discarded

    content = "\n\n".join(body_parts)
    block = f"[Lore]\n{{{{ Информация о мире:\n\n{content} }}}}"
    return block, vector_discarded


def build_summary_block(chat):
    blocks = chat.get("summary_blocks", [])
    if not blocks:
        return ""
    ordered = sorted(blocks, key=lambda b: b.get("start_index", 0))
    body = "\n\n".join(b.get("summary", "").strip() for b in ordered if (b.get("summary") or "").strip())
    if not body:
        return ""
    return f"[Summary]\n{{{{ {body} }}}}"


def build_context_block(chat, context_count):
    active = [m for m in chat.get("messages", []) if not m.get("deleted")]
    recent = active[-context_count:] if context_count > 0 else []
    if not recent:
        return ""
    lines = []
    for m in recent:
        speaker = "User" if m.get("role") == "user" else "Char"
        lines.append(f"{speaker}: {m.get('content', '')}")
    content = "\n".join(lines)
    return f"[Context]\n{{{{ {content} }}}}"


def build_final_instruction_block():
    """Финальная инструкция, чтобы модель не писала лишнего"""
    return "[Instruction]\n{{ Отвечай только от лица персонажа. Не используй вводные фразы вроде 'Конечно', 'Вот твой ответ' или 'Я готов продолжать'. Пиши только текст сообщения. }}"


def _assemble(parts):
    return "\n\n".join(p for p in parts if p)


def build_main_prompt(chat_id, user_message):
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

    # Формируем блоки
    role_block = build_role_block(collection)
    system_block = build_presets_block(collection) # Бывший Presets
    character_block = build_character_block(character)
    user_block = build_user_block(persona)
    lore_block, _ = select_lore_entries(lorebook, chat.get("messages", []), user_message, vector_char_limit)
    summary_block = build_summary_block(chat)
    context_block = build_context_block(chat, context_count)
    instruction_block = build_final_instruction_block()
    current_message_block = (user_message or "").strip()

    def assemble_full(s_block):
        return _assemble([
            role_block, system_block, character_block, user_block,
            lore_block, s_block, context_block, instruction_block, current_message_block,
        ])

    # ---- Шаг 1: сборка ----
    full_prompt = assemble_full(summary_block)
    tokens_before = count_tokens(full_prompt)
    _log("СГЕНЕРИРОВАННЫЙ ПРОМПТ (до обрезки)", full_prompt)

    if tokens_before <= token_limit:
        return {
            "prompt": full_prompt,
            "tokens_before": tokens_before,
            "tokens_after": tokens_before,
            "discarded_tokens": 0,
            "truncated": False,
        }

    # ---- Шаг 4: обрезка Саммари при переполнении ----
    remaining_summary_blocks = sorted(chat.get("summary_blocks", []), key=lambda b: b.get("start_index", 0))

    while True:
        current_s_content = ""
        if remaining_summary_blocks:
            body = "\n\n".join(
                b.get("summary", "").strip() for b in remaining_summary_blocks if (b.get("summary") or "").strip()
            )
            if body:
                current_s_content = f"[Summary]\n{{{{ {body} }}}}"

        full_prompt = assemble_full(current_s_content)
        tokens_now = count_tokens(full_prompt)

        if tokens_now <= token_limit or not remaining_summary_blocks:
            break

        # удаляем самый старый блок саммари
        remaining_summary_blocks.pop(0)

    tokens_after = count_tokens(full_prompt)
    discarded = max(0, tokens_before - tokens_after)

    _log("СГЕНЕРИРОВАННЫЙ ПРОМПТ (после обрезки)", full_prompt)
    return {
        "prompt": full_prompt,
        "tokens_before": tokens_before,
        "tokens_after": tokens_after,
        "discarded_tokens": discarded,
        "truncated": True,
    }