# ============================================
# SUMMARY SERVICE — блоки саммари чата (долгосрочная память)
# ============================================
from utils import repo
from utils.ids import generate_id
from utils.tokens import count_tokens

# ЖЕСТКИЙ ШАГ: ровно 15 сообщений на блок саммари
STEP_SIZE = 15

DEFAULT_SUMMARY_PROMPT = (
    "Ты — летописец и архивариус ролевой игры. Твоя задача — составить предельно плотную, "
    "фактологическую и психологическую выжимку (Summary) последних событий из сообщений ниже.\n\n"
    "КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:\n"
    "- Пересказывать базовые описания карточек персонажей и лорбука (система их уже знает).\n"
    "- Использовать воду, метафоры и общие фразы ('они долго говорили').\n"
    "- Писать вводные фразы ('Вот пересказ', 'В этих сообщениях...').\n\n"
    "СТРУКТУРА ВЫВОДА (следуй строго по пунктам):\n"
    "1. ХРОНИКА СОБЫТИЙ: ключевые поворотные факты (кто куда пошел, что нашел, приказы, выстрелы).\n"
    "2. ПСИХОЛОГИЯ И ОТНОШЕНИЯ: внутреннее состояние (страхи, срывы, паника), сдвиги в доверии, обиды, подозрения, утаенная правда.\n"
    "3. ФИЗИЧЕСКИЙ СТАТУС И ВЕЩИ: ранения, травмы, утомление, принятые препараты/яд/алкоголь, важные предметы.\n"
    "4. АКТИВНЫЕ ОБЕЩАНИЯ И ЦЕЛИ: о чем договорились, невыполненные обещания, куда запланировали поехать.\n\n"
    "Стиль: предельно краткий, сухой, телеграфный русский язык с максимальной концентрацией смысла."
)


def get_summary_status(chat):
    """Актуальность памяти чата."""
    active_msgs = [m for m in chat.get("messages", []) if not m.get("deleted")]
    last_index = active_msgs[-1]["index"] if active_msgs else -1
    unsummarized = [m for m in active_msgs if m["index"] > chat.get("last_summarized_index", -1)]

    step_size = STEP_SIZE
    is_stale = len(unsummarized) >= step_size

    return {
        "is_actual": not is_stale,
        "label": "Память актуальна" if not is_stale else "Не хватает данных",
        "unsummarized_count": len(unsummarized),
        "step_size": step_size,
        "last_summarized_index": chat.get("last_summarized_index", -1),
        "last_message_index": last_index,
    }


def build_summary_prompt(chat_id, summary_prompt_text=None):
    """Формирует промпт строго на 15 сообщений."""
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")

    step_size = STEP_SIZE
    active_msgs = [m for m in chat.get("messages", []) if not m.get("deleted")]
    unsummarized = [m for m in active_msgs if m["index"] > chat.get("last_summarized_index", -1)]

    if len(unsummarized) < step_size:
        remaining = step_size - len(unsummarized)
        return {
            "ok": False,
            "message": f"Нужно накопить {step_size} сообщений для пересказа (осталось {remaining})",
        }

    batch = unsummarized[:step_size]
    start_index = batch[0]["index"]
    end_index = batch[-1]["index"]

    character = repo.get_character(chat.get("character_id"))
    persona = repo.get_persona(chat.get("persona_id")) if chat.get("persona_id") else None
    lorebook = repo.get_lorebook(character.get("lorebook_id")) if character and character.get("lorebook_id") else None

    prompt_text = summary_prompt_text or DEFAULT_SUMMARY_PROMPT

    parts = [prompt_text]

    if character:
        from services.prompt_builder import build_character_block
        char_block = build_character_block(character)
        if char_block:
            parts.append(char_block)

    if persona:
        from services.prompt_builder import build_user_block
        user_block = build_user_block(persona)
        if user_block:
            parts.append(user_block)

    if lorebook:
        entries = [e for e in lorebook.get("entries", []) if e.get("active", True)]
        lore_text = "\n\n".join(e["content"].strip() for e in entries if (e.get("content") or "").strip())
        if lore_text:
            parts.append(f"[Lore]\n{lore_text}")

    messages_text = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Char'} (#{m['index']}): {m['content']}" for m in batch
    )
    parts.append(f"[Сообщения для пересказа (диапазон #{start_index} - #{end_index})]\n{messages_text}")

    full_prompt = "\n\n".join(parts)
    print(f"\n===== ПРОМПТ ДЛЯ САММАРИ (#{start_index}-#{end_index}, {len(batch)} сообщений) =====\n{full_prompt}\n===== /ПРОМПТ ДЛЯ САММАРИ =====\n")

    return {
        "ok": True,
        "prompt": full_prompt,
        "start_index": start_index,
        "end_index": end_index,
        "tokens": count_tokens(full_prompt),
    }


def save_summary_block(chat_id, start_index, end_index, summary_text, title=None):
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")

    block_number = len(chat.get("summary_blocks", [])) + 1
    block = {
        "id": generate_id(),
        "name": title or f"Chat History {block_number}",
        "start_index": start_index,
        "end_index": end_index,
        "summary": summary_text,
    }
    chat.setdefault("summary_blocks", []).append(block)
    chat["last_summarized_index"] = max(chat.get("last_summarized_index", -1), end_index)
    chat["step_size"] = STEP_SIZE
    repo.save_chat(chat)
    return block


def add_empty_summary_block(chat_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")
    block_number = len(chat.get("summary_blocks", [])) + 1
    block = {
        "id": generate_id(),
        "name": f"Chat History {block_number}",
        "start_index": None,
        "end_index": None,
        "summary": "",
    }
    chat.setdefault("summary_blocks", []).append(block)
    repo.save_chat(chat)
    return block


def delete_summary_block(chat_id, block_id):
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")
    chat["summary_blocks"] = [b for b in chat.get("summary_blocks", []) if b["id"] != block_id]
    _recalculate_last_summarized_index(chat)
    repo.save_chat(chat)
    return chat["summary_blocks"]


def _recalculate_last_summarized_index(chat):
    ends = [b["end_index"] for b in chat.get("summary_blocks", []) if b.get("end_index") is not None]
    chat["last_summarized_index"] = max(ends) if ends else -1


def handle_messages_deletion(chat_id, deleted_indices):
    chat = repo.get_chat(chat_id)
    if not chat:
        raise ValueError(f"Чат {chat_id} не найден")

    deleted_set = set(deleted_indices)
    kept_blocks = []
    removed_blocks = []
    for block in chat.get("summary_blocks", []):
        s, e = block.get("start_index"), block.get("end_index")
        if s is not None and e is not None and any(s <= idx <= e for idx in deleted_set):
            removed_blocks.append(block)
        else:
            kept_blocks.append(block)

    chat["summary_blocks"] = kept_blocks
    _recalculate_last_summarized_index(chat)
    repo.save_chat(chat)

    return {
        "removed_blocks": removed_blocks,
        "remaining_blocks": kept_blocks,
        "last_summarized_index": chat["last_summarized_index"],
    }