# ============================================
# CONFIG — глобальные настройки CraftyChat backend
# ============================================
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CHATS_DIR = os.path.join(DATA_DIR, 'chats')
BACKGROUNDS_DIR = os.path.join(DATA_DIR, 'backgrounds')
AVATARS_DIR = os.path.join(DATA_DIR, 'avatars')

for d in (DATA_DIR, CHATS_DIR, BACKGROUNDS_DIR, AVATARS_DIR):
    os.makedirs(d, exist_ok=True)

# Файлы метаданных
PRESETS_FILE = os.path.join(DATA_DIR, 'presets.json')
CHARACTERS_FILE = os.path.join(DATA_DIR, 'characters.json')
PERSONAS_FILE = os.path.join(DATA_DIR, 'personas.json')
LOREBOOKS_FILE = os.path.join(DATA_DIR, 'lorebooks.json')
CHATS_INDEX_FILE = os.path.join(DATA_DIR, 'chats_index.json')
BACKGROUND_FILE = os.path.join(DATA_DIR, 'background.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')

# Глобальные настройки по умолчанию
DEFAULT_SETTINGS = {
    # Ползунок лимита промпта (5К..100К токенов)
    "token_limit": 10000,
    "min_token_limit": 5000,
    "max_token_limit": 100000,
    # Ограничение суммарной длины векторных записей лорбука (в символах)
    "vector_entries_char_limit": 3000,
    # Сколько последних сообщений включать как "ближайший контекст"
    "context_messages_count": 5,
    # Размер блока саммари (сообщений)
    "summary_step_size": 10,
    # Модель для tiktoken
    "tiktoken_model": "gpt-4",
    # Приблизительный подсчёт токенов, если tiktoken недоступен
    "approx_chars_per_token_ru": 3,
    "approx_chars_per_token_en": 4,
}

MAX_AVATAR_DIMENSION = 500
AVATAR_JPEG_QUALITY = 90
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 МБ
MAX_BACKGROUND_THUMBNAILS = 10

HOST = os.environ.get('CRAFTYCHAT_HOST', '0.0.0.0')
PORT = int(os.environ.get('CRAFTYCHAT_PORT', 5000))
DEBUG = os.environ.get('CRAFTYCHAT_DEBUG', '1') == '1'
