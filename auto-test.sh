#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== ACDC API Auto-Tester (Fixed) ===${NC}"

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
    for i in {1..50}; do  # Увеличили таймаут
        if curl -s "$BASE_URL/diagrams" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "${RED}✗ Server failed to start after 50 seconds${NC}"
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
        cat server.log
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
fi

# Теперь выполняем тесты
echo -e "\n${YELLOW}Starting API tests...${NC}"

# 1. Создаем диаграмму
echo -e "\n${YELLOW}1. Creating test diagram...${NC}"
DIAGRAM_RESPONSE=$(curl -s -X POST "$BASE_URL/diagrams" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto-Test Diagram",
    "type": "class",
    "svg_data": "<svg></svg>"
  }')

# Проверяем успешность создания диаграммы
if echo "$DIAGRAM_RESPONSE" | grep -q '"id"'; then
    DIAGRAM_ID=$(echo "$DIAGRAM_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Diagram created: $DIAGRAM_ID${NC}"
else
    echo -e "${RED}✗ Failed to create diagram: $DIAGRAM_RESPONSE${NC}"
    exit 1
fi

# 2. Создаем блоки
echo -e "\n${YELLOW}2. Creating test blocks...${NC}"
BLOCK1_RESPONSE=$(curl -s -X POST "$BASE_URL/diagram-blocks" \
  -H "Content-Type: application/json" \
  -d '{
    "diagram_id": "'$DIAGRAM_ID'",
    "type": "class",
    "x": 100,
    "y": 100,
    "width": 200,
    "height": 120
  }')

if echo "$BLOCK1_RESPONSE" | grep -q '"id"'; then
    BLOCK1_ID=$(echo "$BLOCK1_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Block 1 created: $BLOCK1_ID${NC}"
else
    echo -e "${RED}✗ Failed to create block 1: $BLOCK1_RESPONSE${NC}"
    exit 1
fi

BLOCK2_RESPONSE=$(curl -s -X POST "$BASE_URL/diagram-blocks" \
  -H "Content-Type: application/json" \
  -d '{
    "diagram_id": "'$DIAGRAM_ID'",
    "type": "class",
    "x": 400, 
    "y": 100,
    "width": 200,
    "height": 120
  }')

if echo "$BLOCK2_RESPONSE" | grep -q '"id"'; then
    BLOCK2_ID=$(echo "$BLOCK2_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Block 2 created: $BLOCK2_ID${NC}"
else
    echo -e "${RED}✗ Failed to create block 2: $BLOCK2_RESPONSE${NC}"
    exit 1
fi

# 3. Создаем связь
echo -e "\n${YELLOW}3. Creating connection...${NC}"
CONN_RESPONSE=$(curl -s -X POST "$BASE_URL/diagram-connections" \
  -H "Content-Type: application/json" \
  -d '{
    "diagram_id": "'$DIAGRAM_ID'",
    "from_block_id": "'$BLOCK1_ID'",
    "to_block_id": "'$BLOCK2_ID'",
    "type": "association"
  }')

if echo "$CONN_RESPONSE" | grep -q '"id"'; then
    CONN_ID=$(echo "$CONN_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✓ Connection created: $CONN_ID${NC}"
else
    echo -e "${RED}✗ Failed to create connection: $CONN_RESPONSE${NC}"
    exit 1
fi

# 4. Тест изменения размера блока
echo -e "\n${YELLOW}4. Testing block resize...${NC}"
RESIZE_RESPONSE=$(curl -s -X PUT "$BASE_URL/diagram-blocks/$BLOCK1_ID" \
  -H "Content-Type: application/json" \
  -d '{"width": 300, "height": 180}')

if echo "$RESIZE_RESPONSE" | grep -q '"width":300'; then
    echo -e "${GREEN}✓ Block resize successful${NC}"
    echo "Response: $RESIZE_RESPONSE"
else
    echo -e "${RED}✗ Block resize failed${NC}"
    echo "Response: $RESIZE_RESPONSE"
fi

# 5. Тест добавления подписи к связи
echo -e "\n${YELLOW}5. Testing connection label...${NC}"
LABEL_RESPONSE=$(curl -s -X PUT "$BASE_URL/diagram-connections/$CONN_ID" \
  -H "Content-Type: application/json" \
  -d '{"label": "has one"}')

if echo "$LABEL_RESPONSE" | grep -q '"label":"has one"'; then
    echo -e "${GREEN}✓ Connection label successful${NC}"
    echo "Response: $LABEL_RESPONSE"
else
    echo -e "${RED}✗ Connection label failed${NC}"
    echo "Response: $LABEL_RESPONSE"
    echo -e "${YELLOW}Checking server logs...${NC}"
    tail -20 server.log
fi

# 6. Тест добавления точки изгиба
echo -e "\n${YELLOW}6. Testing bend point...${NC}"
BEND_RESPONSE=$(curl -s -X POST "$BASE_URL/diagram-connections/$CONN_ID/bend-points" \
  -H "Content-Type: application/json" \
  -d '{"position": "middle"}')

if echo "$BEND_RESPONSE" | grep -q '"points":'; then
    echo -e "${GREEN}✓ Bend point successful${NC}"
    echo "Response: $BEND_RESPONSE"
else
    echo -e "${RED}✗ Bend point failed${NC}"
    echo "Response: $BEND_RESPONSE"
    echo -e "${YELLOW}Checking server logs...${NC}"
    tail -20 server.log
fi

echo -e "\n${GREEN}=== Test sequence completed ===${NC}"