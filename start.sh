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
python app.py
