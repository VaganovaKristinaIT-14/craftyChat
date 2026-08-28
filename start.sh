#!/usr/bin/env bash
# ============================================
# Единая команда запуска CraftyChat (backend + frontend)
# Использование: ./start.sh
# ============================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

if [ ! -d "venv" ]; then
    echo "📦 Создаю виртуальное окружение..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "📦 Проверяю зависимости..."
pip install -q -r requirements.txt

echo "🚀 Запускаю CraftyChat..."
echo "   Откройте в браузере: http://localhost:5000"

# Запускаем сервер в фоне, ждём, пока он поднимется, и открываем браузер
python app.py &
SERVER_PID=$!

open_browser() {
  URL="http://localhost:5000"
  for i in $(seq 1 20); do
    if curl -s -o /dev/null "$URL"; then
      break
    fi
    sleep 0.3
  done
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  fi
}
open_browser &

wait $SERVER_PID
