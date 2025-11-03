# ACDC Backend (MVP)

Backend на Node.js/TypeScript для веб-редактора диаграмм. Хранит диаграммы в PostgreSQL (как текст SVG), использует Redis только для истории изменений (undo/redo) по id. Запуск через Docker Compose.

## Запуск

1. Скопируйте переменные окружения:

   cp .env.example .env

2. Запустите в Docker:

   docker-compose up --build

API будет доступно на `http://localhost:3000`.

## Технологии

- Node.js 20, TypeScript, Express
- PostgreSQL (таблица `diagrams`)
- Redis (история изменений undo/redo)
- Docker, docker-compose

## Переменные окружения

- `PORT` — порт API (по умолчанию 3000)
- Параметры БД: `DATABASE_URL` или `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Параметры Redis: `REDIS_URL` или `REDIS_HOST`, `REDIS_PORT`
- Лимит истории: `HISTORY_LIMIT` (по умолчанию 50)

См. пример: `.env.example`.

## Структура

- Код сервера: `src/index.ts`, `src/app.ts`
- Конфиг/клиенты: `src/config.ts`, `src/db.ts`, `src/cache.ts`
- Сущность Diagram: `src/types.ts`
- Репозиторий/сервис/контроллер: `src/repositories/diagramRepository.ts`, `src/services/diagramService.ts`, `src/controllers/diagramController.ts`
- Маршруты: `src/routes/diagrams.ts`
- Мидлвары: `src/middleware/errorHandler.ts`, `src/middleware/validateUUID.ts`
- Инициализация БД: `sql/init.sql`

## API (v1)

- GET `/api/v1/diagrams` — список диаграмм
- GET `/api/v1/diagrams/:id` — получить диаграмму
- POST `/api/v1/diagrams` — создать
- PUT `/api/v1/diagrams/:id` — обновить (инвалидирует кеш)
- DELETE `/api/v1/diagrams/:id` — удалить (инвалидирует кеш)
 - POST `/api/v1/diagrams/:id/undo` — откатить одно изменение; возвращает обновлённую диаграмму
 - POST `/api/v1/diagrams/:id/redo` — вернуть откат (повторить изменение); возвращает обновлённую диаграмму

### Примеры

Создать:

curl -X POST http://localhost:3000/api/v1/diagrams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Diagram",
    "type": "class",
    "svg_data": "<svg>...</svg>"
  }'

Получить:

curl http://localhost:3000/api/v1/diagrams/{id}

Обновить:

curl -X PUT http://localhost:3000/api/v1/diagrams/{id} \
  -H "Content-Type: application/json" \
  -d '{ "name": "New Name" }'

Удалить:

curl -X DELETE http://localhost:3000/api/v1/diagrams/{id}

Undo (назад):

curl -X POST http://localhost:3000/api/v1/diagrams/{id}/undo

Redo (вперёд):

curl -X POST http://localhost:3000/api/v1/diagrams/{id}/redo

## Docker

- Образ API: `Dockerfile`
- Компоновка: `docker-compose.yml`
- Postgres получает инициализацию через `sql/init.sql`

## Примечания

- Все ответы — JSON. Для удаления — `{ "success": true }`.
- `id` — UUID, генерируется на backend при создании.
- Redis хранит только историю изменений для undo/redo (стек до `HISTORY_LIMIT`).
