#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

# 1. Если запуск НЕ на телефоне (Termux), создаем venv.
# На Android в Termux venv не нужен, чтобы не ломать пути к системным пакетам.
if [ ! -d "/data/data/com.termux" ]; then
    if [ ! -d "venv" ]; then
        echo "📦 Создаю виртуальное окружение..."
        python3 -m venv venv || python -m venv venv
    fi
    source venv/bin/activate
fi

# 2. Проверяем наличие ТОЛЬКО необходимых библиотек (flask, flask-cors, Pillow)
# Tiktoken исключен — при его отсутствии бэкенд использует встроенный подсчет (1 токен ≈ 3 символа)
python -c "import flask, flask_cors, PIL" 2>/dev/null || {
    echo "📦 Устанавливаю минимальные зависимости (flask, flask-cors, Pillow)..."
    pip install flask flask-cors Pillow 2>/dev/null || true
}

echo "🚀 Запускаю CraftyChat..."
echo "   Откройте в браузере: http://localhost:5000"

# 3. Запуск сервера
python app.py &
SERVER_PID=$!

# 4. Открытие браузера (поддерживает Termux на Android, Linux и macOS)
open_browser() {
  URL="http://localhost:5000"
  for i in $(seq 1 30); do
    if curl -s -o /dev/null "$URL"; then
      break
    fi
    sleep 0.3
  done

  if command -v termux-open-url >/dev/null 2>&1; then
    termux-open-url "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  fi
}

open_browser &

wait $SERVER_PID