# ============================================
# STORAGE — чтение/запись JSON файлов на диске (аналог dataManager.js,
# только на стороне сервера и с блокировкой от гонок записи)
# ============================================
import json
import os
import threading

_lock = threading.RLock()


def read_json(path, default=None):
    """Читает JSON файл. Если файла нет/битый — возвращает default."""
    with _lock:
        if not os.path.exists(path):
            return default
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return default
                return json.loads(content)
        except (json.JSONDecodeError, OSError):
            return default


def write_json(path, data):
    """Атомарно записывает JSON файл (сначала во временный, потом переименование)."""
    with _lock:
        tmp_path = path + '.tmp'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)


def delete_file(path):
    with _lock:
        if os.path.exists(path):
            os.remove(path)
