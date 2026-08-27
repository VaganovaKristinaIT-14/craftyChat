# ============================================
# ID — генерация уникальных идентификаторов
# (аналог generateId() из фронтендового dataManager.js:
#  Date.now().toString(36) + random)
# ============================================
import time
import random
import string


def generate_id():
    ts = int(time.time() * 1000)
    ts36 = _to_base36(ts)
    rand_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{ts36}{rand_part}"


def _to_base36(number):
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if number == 0:
        return "0"
    result = ""
    n = number
    while n > 0:
        n, rem = divmod(n, 36)
        result = digits[rem] + result
    return result
