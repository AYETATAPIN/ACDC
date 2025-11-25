# ACDC Diagram Editor

### Backend
- **Node.js 20, TypeScript, Express**
- **PostgreSQL** - хранение диаграмм, блоков и связей
- **Docker, Docker Compose** - контейнеризация
- **REST API** - полный CRUD для диаграмм

### Frontend
- **Vue.js 3** - современный фреймворк
- **Vite** - быстрая сборка и dev сервер
- **SVG** - отрисовка диаграмм на холсте
- **Composition API** - реактивная логика

## Структура проекта

```
acdc-backend/
├── src/                    # Backend TypeScript код
│   ├── controllers/        # Контроллеры API
│   ├── services/          # Бизнес-логика
│   ├── repositories/      # Работа с базой данных
│   ├── routes/           # Маршруты Express
│   ├── middleware/       # Промежуточное ПО
│   └── types.ts          # TypeScript типы
├── frontend/              # Vue.js фронтенд
│   ├── src/
│   │   ├── components/   # Vue компоненты
│   │   ├── composables/  # Композиции Vue
│   │   ├── App.vue       # Главный компонент
│   │   └── main.js       # Точка входа
│   ├── index.html        # HTML шаблон
│   └── vite.config.js    # Конфигурация Vite
├── public/               # Собранный фронтенд
├── sql/init.sql          # Инициализация БД
└── docker-compose.yml    # Docker конфигурация
```

## Быстрый старт

### 1. Клонирование и настройка
```bash
# Скопируйте переменные окружения
cp .env.example .env

# Отредактируйте .env при необходимости
```

### 2. Запуск в Docker (рекомендуется)
```bash
# Запуск всех сервисов
docker-compose up --build

# Приложение будет доступно по адресам:
# - Frontend: http://localhost:5173 (Vue.js редактор)
# - Backend API: http://localhost:3000
# - PostgreSQL: localhost:5432
```

### 3. Ручной запуск для разработки

**Терминал 1 - Backend:**
```bash
# Установите зависимости
npm install

# Соберите TypeScript
npm run build

# Запустите сервер
npm run dev
```

**Терминал 2 - Frontend:**
```bash
cd frontend

# Установите зависимости
npm install

# Запустите dev сервер
npm run dev
```

## API Endpoints (v1)

### Диаграммы
- `GET /api/v1/diagrams` - список всех диаграмм
- `GET /api/v1/diagrams/:id` - получить диаграмму по ID
- `POST /api/v1/diagrams` - создать новую диаграмму
- `PUT /api/v1/diagrams/:id` - обновить диаграмму
- `DELETE /api/v1/diagrams/:id` - удалить диаграмму

### История диаграмм (undo/redo)
- `GET /api/v1/diagrams/:diagramId/history` - список доступных версий, текущая позиция
- `POST /api/v1/diagrams/:diagramId/undo` - откатить диаграмму на предыдущий снапшот
- `POST /api/v1/diagrams/:diagramId/redo` - вернуть диаграмму на следующую версию (если undo уже делался)

### Блоки диаграмм
- `GET /api/v1/diagram-blocks/diagram/:diagramId` - блоки диаграммы
- `GET /api/v1/diagram-blocks/:id` - получить блок
- `POST /api/v1/diagram-blocks` - создать блок
- `PUT /api/v1/diagram-blocks/:id` - обновить блок
- `DELETE /api/v1/diagram-blocks/:id` - удалить блок

### Связи между блоками
- `GET /api/v1/diagram-connections/diagram/:diagramId` - связи диаграммы
- `POST /api/v1/diagram-connections` - создать связь
- `DELETE /api/v1/diagram-connections/:id` - удалить связь

## Возможности редактора

### Типы диаграмм
- **Class Diagrams** - диаграммы классов UML
- **Use Case Diagrams** - диаграммы прецедентов
- **Free Mode** - свободное рисование

### Элементы
- **Классы, Интерфейсы, Enum** - для диаграмм классов
- **Акторы, Use Case** - для диаграмм прецедентов
- **Заметки, Пакеты** - дополнительные элементы
- **Ассоциации, Наследование, Композиция** - типы связей

### Функциональность
- Создание и редактирование элементов
- Установка связей между элементами
- Drag & Drop перемещение
- Изменение размеров и свойств
- Сохранение и загрузка диаграмм
- Масштабирование холста

## Команды разработки

```bash
# Backend
npm run build          # Сборка TypeScript
npm run dev           # Запуск в режиме разработки
npm run typecheck     # Проверка типов
npm test              # Интеграционные тесты undo/redo (нужен запущенный PostgreSQL)

# Frontend
cd frontend
npm run dev          # Dev сервер Vite
npm run build        # Сборка для production
npm run preview      # Превью собранной версии
```

## Переменные окружения

Создайте `.env` файл на основе `.env.example`:

```env
# Backend
PORT=3000
NODE_ENV=development

# Database (используйте DATABASE_URL или отдельные параметры)
DATABASE_URL=postgresql://user:pass@localhost:5432/acdc
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=acdc
DB_SSL=false

# Docker PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=acdc
```

## Docker

### Сервисы
- **api** - Node.js бэкенд на порту 3000
- **db** - PostgreSQL база данных на порту 5432

### Команды
```bash
# Запуск
docker-compose up --build

# Остановка
docker-compose down

# Пересборка
docker-compose build --no-cache
```

## База данных

### Основные таблицы
- `diagrams` - диаграммы (id, name, type, svg_data)
- `diagram_blocks` - блоки диаграмм
- `diagram_connections` - связи между блоками
- `diagram_history` - снапшоты диаграмм для undo/redo

### Инициализация
База данных автоматически инициализируется через `sql/init.sql` при первом запуске.

## Ручные проверки в браузере (после `docker-compose up`)
- API базовый URL: `http://localhost:3000/api/v1`
- Диаграммы: `GET /diagrams`, `GET /diagrams/{id}`, `POST /diagrams`, `PUT /diagrams/{id}`, `DELETE /diagrams/{id}`
- История: `GET /diagrams/{id}/history`, `POST /diagrams/{id}/undo`, `POST /diagrams/{id}/redo`
- Блоки: `GET /diagram-blocks/diagram/{diagramId}`, `POST /diagram-blocks`, `PUT /diagram-blocks/{id}`, `DELETE /diagram-blocks/{id}`
- Связи: `GET /diagram-connections/diagram/{diagramId}`, `POST /diagram-connections`, `DELETE /diagram-connections/{id}`
- Фронтенд (если dev-сервер): `http://localhost:5173`
- Собранный SPA из `public` (serve бекендом): `http://localhost:3000`

## Примеры использования

### Создание диаграммы через API
```bash
curl -X POST http://localhost:3000/api/v1/diagrams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Class Diagram",
    "type": "class",
    "svg_data": "<svg>...</svg>"
  }'
```

### Получение списка диаграмм
```bash
curl http://localhost:3000/api/v1/diagrams
```

## Разработка

### Добавление новых типов элементов
1. Добавьте тип в `src/types.ts`
2. Создайте компонент во `frontend/src/components/`
3. Добавьте обработку в `frontend/src/composables/useDiagramEditor.js`

### Расширение API
1. Добавьте роут в `src/routes/`
2. Создайте контроллер в `src/controllers/`
3. Реализуйте сервис и репозиторий

## Примечания

- Все ID генерируются как UUID на бэкенде
- Ответы API в формате JSON
- Frontend использует proxy к API в режиме разработки
- CORS настроен для локальной разработки

## Проблемы

1. **Порт занят** - убедитесь что порты 3000 и 5173 свободны
2. **CORS ошибки** - проверьте настройки CORS в бэкенде
3. **База данных не подключена** - проверьте переменные окружения
4. **Frontend не собирается** - проверьте зависимости во фронтенде

### Логи
- Backend логи выводятся в консоль Docker
- Frontend логи доступны в браузерной консоли (F12)

---
