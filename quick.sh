#!/bin/bash

echo "🔄 Quick restart of ACDC server..."

# Останавливаем текущий сервер
pkill -f "tsx watch" 2>/dev/null
pkill -f "node.*src/index.ts" 2>/dev/null

# Ждем завершения
sleep 2

# Проверяем зависимости
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Запускаем сервер
echo "🚀 Starting server..."
npm run dev