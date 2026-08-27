# ============================================
# AVATAR SERVICE — обработка загружаемых аватарок:
# сжатие до 500x500, конвертация в JPEG 90%, base64
# ============================================
import base64
import io
import config

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


class AvatarProcessingError(Exception):
    pass


def process_avatar(file_bytes):
    """Принимает сырые байты изображения, возвращает data:image/jpeg;base64,... строку,
    сжатую до MAX_AVATAR_DIMENSION x MAX_AVATAR_DIMENSION, качество JPEG_QUALITY."""
    if len(file_bytes) > config.MAX_UPLOAD_SIZE_BYTES:
        raise AvatarProcessingError("Файл слишком большой! Максимум 5 МБ.")

    if not _PIL_AVAILABLE:
        # Без Pillow просто кодируем как есть (без ресайза) — деградация, но не падаем
        b64 = base64.b64encode(file_bytes).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    try:
        img = Image.open(io.BytesIO(file_bytes))
        img = img.convert("RGB")
    except Exception as e:
        raise AvatarProcessingError(f"Не удалось обработать изображение: {e}")

    max_dim = config.MAX_AVATAR_DIMENSION
    if img.width > max_dim or img.height > max_dim:
        ratio = min(max_dim / img.width, max_dim / img.height)
        new_size = (max(1, round(img.width * ratio)), max(1, round(img.height * ratio)))
        img = img.resize(new_size, Image.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=config.AVATAR_JPEG_QUALITY)
    b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def process_background_thumbnail(file_bytes, width=300):
    """Создаёт миниатюру фона (для панели «Фоны»)."""
    if not _PIL_AVAILABLE:
        b64 = base64.b64encode(file_bytes).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    try:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    except Exception as e:
        raise AvatarProcessingError(f"Не удалось обработать изображение: {e}")

    height = round(width * 9 / 16)
    ratio = min(width / img.width, height / img.height)
    new_size = (max(1, round(img.width * ratio)), max(1, round(img.height * ratio)))
    img = img.resize(new_size, Image.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=80)
    b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def full_image_to_base64(file_bytes, mime="image/jpeg"):
    b64 = base64.b64encode(file_bytes).decode("ascii")
    return f"data:{mime};base64,{b64}"
