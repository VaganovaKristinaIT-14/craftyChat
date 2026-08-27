# CraftyChat — Backend

Backend на Python (Flask) для локального веб-приложения CraftyChat.
Хранит все данные (пресеты, персонажей, персон, лорбуки, чаты, фоны) в JSON-файлах
на диске и предоставляет REST API для фронтенда. Формирует «мейн промпт» по алгоритму
из ТЗ (сборка → проверка лимита токенов → обрезка при переполнении).

## Структура проекта

```
backend/
├── app.py                     # точка входа (Flask-приложение, регистрация роутов)
├── config.py                  # глобальные настройки, пути к файлам данных
├── requirements.txt
├── utils/
│   ├── storage.py              # атомарное чтение/запись JSON на диск
│   ├── ids.py                  # генерация уникальных ID
│   ├── tokens.py                # подсчёт токенов (tiktoken / приблизительно)
│   └── repo.py                  # CRUD-репозитории всех сущностей
├── services/
│   ├── prompt_builder.py       # сборка главного промпта + обрезка при переполнении
│   ├── summary_service.py       # логика саммари (отдельный механизм)
│   └── avatar_service.py        # сжатие/конвертация аватарок и фонов
├── routes/
│   ├── presets_routes.py        # /api/presets
│   ├── characters_routes.py     # /api/characters
│   ├── personas_routes.py       # /api/personas
│   ├── lorebooks_routes.py      # /api/lorebooks
│   ├── chats_routes.py          # /api/chats
│   ├── background_routes.py     # /api/background
│   └── settings_routes.py       # /api/settings
└── data/                       # создаётся автоматически при первом запуске
    ├── presets.json
    ├── characters.json
    ├── personas.json
    ├── lorebooks.json
    ├── background.json
    ├── settings.json
    ├── chats_index.json
    ├── chats/                  # каждый чат — отдельный <id>.json
    └── backgrounds/            # полноразмерные фоны (миниатюры хранятся в background.json)
```

## Установка и запуск

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

По умолчанию сервер поднимается на `http://localhost:5000`.
Переменные окружения: `CRAFTYCHAT_HOST`, `CRAFTYCHAT_PORT`, `CRAFTYCHAT_DEBUG`.

Если библиотека `tiktoken` не установлена (или недоступна загрузка её таблиц
кодировки без интернета) — подсчёт токенов автоматически переключается на
приблизительный алгоритм (1 токен ≈ 3 символа для кириллицы, ≈ 4 символа для
остального текста), как и требует ТЗ.

## Основные эндпоинты

### Пресеты
- `GET /api/presets` — все коллекции пресетов
- `PUT /api/presets` — заменить целиком
- `POST /api/presets/collections` — создать коллекцию
- `PUT/DELETE /api/presets/collections/<id>`
- `POST /api/presets/collections/<id>/activate`
- `POST/PUT/DELETE /api/presets/collections/<id>/presets[/<preset_id>]` — мини-пресеты

### Персонажи
- `GET /api/characters?page=1&per_page=10`
- `GET/PUT/DELETE /api/characters/<id>`
- `POST /api/characters` / `POST /api/characters/import`
- `POST /api/characters/<id>/avatar` (multipart/form-data, поле `file`)
- `POST /api/characters/<id>/lorebook` — прикрепить/открепить лорбук
- `GET /api/characters/<id>/export`

### Персоны
- `GET /api/personas?page=1&per_page=10`
- `GET/PUT/DELETE /api/personas/<id>`
- `POST /api/personas` / `POST /api/personas/import`
- `POST /api/personas/<id>/avatar`
- `POST /api/personas/<id>/activate` — сделать активной
- `POST /api/personas/<id>/link-character` / `unlink-character`
- `GET /api/personas/for-character/<character_id>` — автопривязка при открытии чата

### Лорбуки
- `GET/POST /api/lorebooks`, `GET/PUT/DELETE /api/lorebooks/<id>`
- `POST /api/lorebooks/<id>/duplicate`
- `POST/PUT/DELETE /api/lorebooks/<id>/entries[/<entry_id>]`
- `PUT /api/lorebooks/<id>/entries/reorder`
- `POST/DELETE /api/lorebooks/<id>/entries/<entry_id>/keywords[/<keyword>]`

### Чаты
- `GET /api/chats/recent` — последние 10 чатов для главной
- `GET /api/chats?character_id=<id>` — все чаты персонажа
- `GET/PUT/DELETE /api/chats/<id>`
- `POST /api/chats` — новый чат (учитывает привязанную персону и вступительное сообщение)
- `POST /api/chats/<id>/checkpoint`
- `POST /api/chats/<id>/messages` / `PUT/DELETE .../messages/<index>`
- `DELETE /api/chats/<id>/messages` — массовое удаление `{"indices":[...]}`
- `POST /api/chats/<id>/mode` — `{"mode":"user"|"char"}`
- `POST /api/chats/<id>/generate-prompt` — **сборка мейн промпта**
- `GET /api/chats/<id>/export/json`, `GET /api/chats/<id>/export/txt`
- `GET /api/chats/<id>/summary/status`
- `POST /api/chats/<id>/summary/generate-prompt` — промпт для саммари (отдельный механизм)
- `POST/PUT/DELETE /api/chats/<id>/summary/blocks[/<id>]`

### Фон и настройки
- `GET /api/background`, `POST /api/background/upload`, `POST /api/background/<id>/select`,
  `DELETE /api/background/<id>`, `POST /api/background/reset`
- `GET/PUT /api/settings`, `POST /api/settings/count-tokens`

## Формат мейн промпта

```
[Role]      — Основной промпт + Дополнительный промпт (из активного пресета)
[Presets]   — включённые мини-пресеты
[Character] — карточка персонажа
[User]      — карточка активной персоны
[Lore]      — записи лорбука (постоянные → обычные по приоритету → векторные блоком)
[Summary]   — блоки саммари чата
[Context]   — последние N сообщений (по умолчанию 5)
(без метки) — текущее сообщение пользователя
```

При превышении лимита токенов (ползунок 5К–100К из пресета) обрезка идёт в порядке:
1. Векторные записи лорбука — обрезаются суммарно до `vector_entries_char_limit` символов (по умолчанию 3000).
2. Блоки саммари — удаляются от самых старых, пока промпт не влезет в лимит.

Системный промпт и текущее сообщение пользователя не обрезаются никогда.
Все сгенерированные промпты подробно логируются в консоль сервера.
