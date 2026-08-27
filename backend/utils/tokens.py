# ============================================
# TOKENS — подсчёт токенов через tiktoken (модель gpt-4),
# с fallback на приблизительный подсчёт, если библиотека недоступна
# ============================================
import re
import config

_encoder = None
_tiktoken_available = False

try:
    import tiktoken
    try:
        _encoder = tiktoken.encoding_for_model(config.DEFAULT_SETTINGS["tiktoken_model"])
    except Exception:
        _encoder = tiktoken.get_encoding("cl100k_base")
    _tiktoken_available = True
except Exception:
    # tiktoken не установлен, либо недоступна загрузка таблиц кодировки (нет сети) —
    # используем приблизительный подсчёт токенов
    _tiktoken_available = False


_CYRILLIC_RE = re.compile(r'[а-яёА-ЯЁ]')


def is_tiktoken_available():
    return _tiktoken_available


def count_tokens(text):
    """Считает количество токенов в тексте. Использует tiktoken если доступен,
    иначе — приблизительный подсчёт: ~1 токен на 3 символа для русского текста,
    ~1 токен на 4 символа для остального (латиница/цифры/символы)."""
    if not text:
        return 0

    if _tiktoken_available:
        try:
            return len(_encoder.encode(text))
        except Exception:
            pass  # откатываемся на приблизительный подсчёт

    return _approx_count_tokens(text)


def _approx_count_tokens(text):
    cyrillic_chars = len(_CYRILLIC_RE.findall(text))
    other_chars = len(text) - cyrillic_chars

    ru_per_token = config.DEFAULT_SETTINGS["approx_chars_per_token_ru"]
    en_per_token = config.DEFAULT_SETTINGS["approx_chars_per_token_en"]

    tokens = (cyrillic_chars / ru_per_token) + (other_chars / en_per_token)
    return max(1, round(tokens)) if text.strip() else 0
