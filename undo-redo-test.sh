#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== ACDC Undo/Redo API Tester ===${NC}"

BASE_URL="http://localhost:3000/api/v1"

# Функция для красивого вывода
print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1${NC}"
    fi
}

# Функция для ожидания сервера с таймаутом
wait_for_server() {
    echo -e "${YELLOW}Waiting for server to start...${NC}"
    for i in {1..30}; do
        if curl -s "$BASE_URL/diagrams" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "${RED}✗ Server failed to start after 30 seconds${NC}"
    echo -e "${YELLOW}Check server.log for errors${NC}"
    return 1
}

# Проверяем, запущен ли уже сервер
if curl -s "$BASE_URL/diagrams" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is already running${NC}"
else
    echo -e "${YELLOW}Starting server...${NC}"
    npm run dev > server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > server.pid
    
    if ! wait_for_server; then
        echo -e "${RED}Server startup failed. Check server.log:${NC}"
        tail -20 server.log
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
fi

# Теперь выполняем тесты undo/redo
echo -e "\n${BLUE}Starting Undo/Redo tests...${NC}"

# 1. Создаем диаграмму (версия 1)
echo -e "\n${YELLOW}1. Creating initial diagram (v1)...${NC}"
DIAGRAM_RESPONSE=$(curl -s -X POST "$BASE_URL/diagrams" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Undo/Redo Test Diagram",
    "type": "class", 
    "svg_data": "<svg>version1</svg>"
  }')

if echo "$DIAGRAM_RESPONSE" | grep -q '"id"'; then
    DIAGRAM_ID=$(echo "$DIAGRAM_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Diagram created: $DIAGRAM_ID${NC}"
    echo "Response: $DIAGRAM_RESPONSE"
else
    echo -e "${RED}✗ Failed to create diagram: $DIAGRAM_RESPONSE${NC}"
    exit 1
fi

# 2. Обновляем диаграмму (версия 2)
echo -e "\n${YELLOW}2. Updating diagram (v2)...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/diagrams/$DIAGRAM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Undo/Redo Test Diagram",
    "svg_data": "<svg>version2</svg>"
  }')

if echo "$UPDATE_RESPONSE" | grep -q '"id"'; then
    echo -e "${GREEN}✓ Diagram updated successfully${NC}"
    echo "Response: $UPDATE_RESPONSE"
else
    echo -e "${RED}✗ Failed to update diagram: $UPDATE_RESPONSE${NC}"
    exit 1
fi

# 3. Проверяем историю (должно быть 2 версии)
echo -e "\n${YELLOW}3. Checking history (should have 2 versions)...${NC}"
HISTORY_RESPONSE=$(curl -s "$BASE_URL/diagrams/$DIAGRAM_ID/history")

if echo "$HISTORY_RESPONSE" | grep -q '"current_version":2'; then
    echo -e "${GREEN}✓ History shows 2 versions${NC}"
    echo "History: $HISTORY_RESPONSE"
else
    echo -e "${RED}✗ History check failed${NC}"
    echo "Response: $HISTORY_RESPONSE"
fi

# 4. Выполняем UNDO (должен вернуть версию 1)
echo -e "\n${YELLOW}4. Testing UNDO (should return to v1)...${NC}"
UNDO_RESPONSE=$(curl -s -X POST "$BASE_URL/diagrams/$DIAGRAM_ID/undo")

if echo "$UNDO_RESPONSE" | grep -q '"version":1'; then
    if echo "$UNDO_RESPONSE" | grep -q '"name":"Undo/Redo Test Diagram"'; then
        echo -e "${GREEN}✓ UNDO successful - returned to version 1${NC}"
        echo "UNDO Response: $UNDO_RESPONSE"
    else
        echo -e "${RED}✗ UNDO failed - wrong name${NC}"
        echo "Response: $UNDO_RESPONSE"
    fi
else
    echo -e "${RED}✗ UNDO failed - wrong version${NC}"
    echo "Response: $UNDO_RESPONSE"
fi

# 5. Проверяем текущее состояние после UNDO
echo -e "\n${YELLOW}5. Checking current state after UNDO...${NC}"
CURRENT_RESPONSE=$(curl -s "$BASE_URL/diagrams/$DIAGRAM_ID")

if echo "$CURRENT_RESPONSE" | grep -q '"name":"Undo/Redo Test Diagram"'; then
    echo -e "${GREEN}✓ Current state correct after UNDO${NC}"
    echo "Current: $CURRENT_RESPONSE"
else
    echo -e "${RED}✗ Current state incorrect after UNDO${NC}"
    echo "Response: $CURRENT_RESPONSE"
fi

# 6. Выполняем REDO (должен вернуть версию 2)
echo -e "\n${YELLOW}6. Testing REDO (should return to v2)...${NC}"
REDO_RESPONSE=$(curl -s -X POST "$BASE_URL/diagrams/$DIAGRAM_ID/redo")

if echo "$REDO_RESPONSE" | grep -q '"version":2'; then
    if echo "$REDO_RESPONSE" | grep -q '"name":"Updated Undo/Redo Test Diagram"'; then
        echo -e "${GREEN}✓ REDO successful - returned to version 2${NC}"
        echo "REDO Response: $REDO_RESPONSE"
    else
        echo -e "${RED}✗ REDO failed - wrong name${NC}"
        echo "Response: $REDO_RESPONSE"
    fi
else
    echo -e "${RED}✗ REDO failed - wrong version${NC}"
    echo "Response: $REDO_RESPONSE"
fi

# 7. Проверяем текущее состояние после REDO
echo -e "\n${YELLOW}7. Checking current state after REDO...${NC}"
CURRENT_RESPONSE=$(curl -s "$BASE_URL/diagrams/$DIAGRAM_ID")

if echo "$CURRENT_RESPONSE" | grep -q '"name":"Updated Undo/Redo Test Diagram"'; then
    echo -e "${GREEN}✓ Current state correct after REDO${NC}"
    echo "Current: $CURRENT_RESPONSE"
else
    echo -e "${RED}✗ Current state incorrect after REDO${NC}"
    echo "Response: $CURRENT_RESPONSE"
fi

# 8. Тест: UNDO после создания блока
echo -e "\n${YELLOW}8. Testing UNDO after creating a block...${NC}"

# Создаем блок
echo -e "${YELLOW}   Creating a block...${NC}"
BLOCK_RESPONSE=$(curl -s -X POST "$BASE_URL/diagram-blocks" \
  -H "Content-Type: application/json" \
  -d '{
    "diagram_id": "'$DIAGRAM_ID'",
    "type": "node",
    "x": 50,
    "y": 50,
    "width": 100,
    "height": 60,
    "properties": {"label": "Test Block"}
  }')

if echo "$BLOCK_RESPONSE" | grep -q '"id"'; then
    BLOCK_ID=$(echo "$BLOCK_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}   ✓ Block created: $BLOCK_ID${NC}"
else
    echo -e "${RED}   ✗ Failed to create block: $BLOCK_RESPONSE${NC}"
    exit 1
fi

# Проверяем историю после создания блока
HISTORY_AFTER_BLOCK=$(curl -s "$BASE_URL/diagrams/$DIAGRAM_ID/history")
echo "   History after block: $HISTORY_AFTER_BLOCK"

# Выполняем UNDO после создания блока
echo -e "${YELLOW}   Performing UNDO after block creation...${NC}"
UNDO_AFTER_BLOCK=$(curl -s -X POST "$BASE_URL/diagrams/$DIAGRAM_ID/undo")

if echo "$UNDO_AFTER_BLOCK" | grep -q '"version":2'; then
    # Проверяем, что блоков нет в состоянии после UNDO
    if echo "$UNDO_AFTER_BLOCK" | grep -q '"blocks":\[\]' || ! echo "$UNDO_AFTER_BLOCK" | grep -q '"blocks":'; then
        echo -e "${GREEN}   ✓ UNDO after block creation successful - blocks cleared${NC}"
        echo "   UNDO Response: $UNDO_AFTER_BLOCK"
    else
        echo -e "${RED}   ✗ UNDO failed - blocks not cleared${NC}"
        echo "   Response: $UNDO_AFTER_BLOCK"
    fi
else
    echo -e "${RED}   ✗ UNDO after block failed - wrong version${NC}"
    echo "   Response: $UNDO_AFTER_BLOCK"
fi

# 9. Финальная проверка истории
echo -e "\n${YELLOW}9. Final history check...${NC}"
FINAL_HISTORY=$(curl -s "$BASE_URL/diagrams/$DIAGRAM_ID/history")
echo "Final History: $FINAL_HISTORY"

echo -e "\n${GREEN}=== Undo/Redo Test Sequence Completed ===${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "  - Created and updated diagram"
echo -e "  - Tested UNDO functionality" 
echo -e "  - Tested REDO functionality"
echo -e "  - Tested UNDO after block creation"
echo -e "  - Verified history tracking"

# Очистка (опционально)
echo -e "\n${YELLOW}Cleaning up...${NC}"
read -p "Delete test diagram $DIAGRAM_ID? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/diagrams/$DIAGRAM_ID")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test diagram deleted${NC}"
    else
        echo -e "${RED}✗ Failed to delete test diagram${NC}"
    fi
fi

# Остановка сервера если мы его запускали
if [ -f server.pid ]; then
    read -p "Stop the server? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill $(cat server.pid) 2>/dev/null
        rm server.pid
        echo -e "${GREEN}✓ Server stopped${NC}"
    fi
fi