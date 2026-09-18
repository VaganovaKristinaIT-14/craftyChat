# ============================================
# CENSOR SERVICE — замена первых N гласных в словах на "+"
# для обхода входных фильтров модерации LLM.
# ============================================
import re

VOWELS = set("аеёиоуыэюяaeiouyАЕЁИОУЫЭЮЯAEIOUY")
NAME_LINE_RE = re.compile(r'^\s*Имя\s*:\s*.+$')
WORD_RE = re.compile(r'[a-zA-Zа-яА-ЯёЁ]+')


def censor_word(word: str) -> str:
    """Цензурирует отдельное слово:
    - Длина < 6 букв  -> заменяется 1-я гласная на '+'
    - Длина >= 6 букв -> заменяются первые 2 гласные на '+'
    - Если гласных меньше N — заменяются все имеющиеся гласные.
    - Согласные и их регистр не меняются. Плюсы — всегда '+'.
    """
    if not word:
        return word

    n = 1 if len(word) < 6 else 2
    replaced = 0
    chars = list(word)

    for i, ch in enumerate(chars):
        if ch in VOWELS:
            chars[i] = '+'
            replaced += 1
            if replaced >= n:
                break

    return "".join(chars)


def censor_text(text: str) -> str:
    """Цензурирует многострочный текст:
    - Строки формата 'Имя: <значение>' остаются БЕЗ изменений.
    - В остальных строках каждое слово (последовательность букв) цензурируется.
    - Цифры, пробелы, знаки препинания и переводы строк сохраняются как есть.
    """
    if not text:
        return text

    lines = text.splitlines(keepends=True)
    result_lines = []

    for line in lines:
        line_content = line.rstrip('\r\n')
        if NAME_LINE_RE.match(line_content):
            result_lines.append(line)
        else:
            censored_line = WORD_RE.sub(lambda m: censor_word(m.group(0)), line)
            result_lines.append(censored_line)

    return "".join(result_lines)