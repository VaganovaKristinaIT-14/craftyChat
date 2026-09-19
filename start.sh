#!/usr/bin/env bash
# ============================================
# Единая команда запуска CraftyChat (backend + frontend)
# Использование: ./start.sh
# ============================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

# Создаем venv с флагом доступа к системным пакетам (критично для Termux)
if [ ! -d "venv" ]; then
    echo "📦 Создаю виртуальное окружение..."
    python3 -m venv --system-site-packages venv || python -m venv --system-site-packages venv
fi

# Активируем виртуальное окружение
source venv/bin/activate

echo "📦 Проверяю зависимости..."
pip install --upgrade pip -q 2>/dev/null || true
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt || echo "⚠️ Некоторые зависимости не установились, продолжаю..."
else
    pip install flask Pillow
fi

echo "🚀 Запускаю CraftyChat..."
echo "   Откройте в браузере: http://localhost:5000"

# Запуск сервера
python app.py &
SERVER_PID=$!

# Функция открытия браузера (поддерживает и ПК, и Android Termux)
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