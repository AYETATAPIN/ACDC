# Stage 2 Handoff (ACDC)

Документ фиксирует текущее состояние проекта после серии правок Stage 2:
- что уже внедрено;
- как это работает сейчас;
- где лежит логика и данные;
- что осталось доделать.

## 1) Что изменилось с начала работ

## 1.1 Frontend: декомпозиция и структура
- Был монолитный `App.vue` на ~2500+ строк.
- Сейчас:
- шаблон и композиция экрана в [App.vue](/D:/prg/frontik/ACDC/frontend/src/App.vue);
- состояние и computed в [app-options.js](/D:/prg/frontik/ACDC/frontend/src/app-options.js);
- методы разнесены по модулям:
- [canvas-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/canvas-methods.js);
- [connection-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/connection-methods.js);
- [diagram-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/diagram-methods.js);
- [shared-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/shared-methods.js);
- объединение методов: [app-methods.js](/D:/prg/frontik/ACDC/frontend/src/app-methods.js).
- UI разбит на компоненты:
- [DiagramHeader.vue](/D:/prg/frontik/ACDC/frontend/src/components/DiagramHeader.vue);
- [DiagramToolbar.vue](/D:/prg/frontik/ACDC/frontend/src/components/DiagramToolbar.vue);
- [DiagramPropertiesPanel.vue](/D:/prg/frontik/ACDC/frontend/src/components/DiagramPropertiesPanel.vue);
- [DiagramHistoryPanel.vue](/D:/prg/frontik/ACDC/frontend/src/components/DiagramHistoryPanel.vue);
- [DiagramRulesTypesDialog.vue](/D:/prg/frontik/ACDC/frontend/src/components/DiagramRulesTypesDialog.vue).

## 1.2 Frontend: UX/функциональность редактора
- Тема светлая/тёмная:
- переключение в хедере;
- сохранение выбора в `localStorage` (`acdc.theme`);
- применение через `data-theme` на `documentElement`.
- Сетка/холст:
- фон и сетка переключаются по теме;
- холст автоматически расширяется при перетаскивании/resize через `ensureCanvasCanFitPoint`.
- Связи:
- расширена hit-area линии (невидимый толстый path);
- endpoint handles у выбранной связи (drag начала/конца);
- привязка к стороне блока через `fromAnchor/toAnchor`;
- ручные средние точки не теряются при `updateConnections`.
- Точки изгиба:
- добавление кнопкой и по клику по сегменту;
- drag точки;
- удаление выбранной/последней/через диалог;
- label точки (подпись) через диалог.
- Undo/Redo:
- гибрид: локальная история + серверная;
- горячие клавиши: `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`;
- `Delete/Backspace` удаляет bend point, связь, выделенные элементы.
- Правила и типы:
- отдельный диалог с вкладками `Diagram Type`, `Elements`, `Connections and Rules`;
- матрица правил, редактирование ячейки, bulk-операции;
- CRUD для custom diagram types / elements / connection types.
- Редактор custom element:
- вынесен в отдельный dialog;
- добавлены GUI-секции `Basic Settings`, `Ports`, `Fields`, `Preview`;
- добавлен drag-and-drop полей в preview (позиции `x/y` обновляются).

## 1.3 Backend: Stage 2 модель и API
- Добавлены сущности и миграции:
- `diagram_types`, `element_types`, `connection_types`, `connection_rules`;
- `users`, `share_tokens` (scaffolding под auth/share);
- `diagram_type_id` и `owner_user_id` у `diagrams`;
- `element_type_id` у `diagram_blocks`;
- `connection_type_id` и `rule_violation` у `diagram_connections`.
- Исправлен кейс миграции UUID/text при backfill `diagram_type_id` (касты к `::uuid` в runtime-миграции).
- Добавлен seed встроенных типов/элементов/связей/правил.
- Проверка правил связей включена на сервере:
- при create/update связи;
- при нарушении возвращается `CONNECTION_RULE_VIOLATION` с деталями.
- Доступны новые REST маршруты для каталога типов:
- router: [diagramTypes.ts](/D:/prg/frontik/ACDC/src/routes/diagramTypes.ts);
- controller: [diagramTypeController.ts](/D:/prg/frontik/ACDC/src/controllers/diagramTypeController.ts);
- service: [diagramTypeService.ts](/D:/prg/frontik/ACDC/src/services/diagramTypeService.ts);
- repository: [diagramTypeRepository.ts](/D:/prg/frontik/ACDC/src/repositories/diagramTypeRepository.ts).

## 1.4 Инфраструктура/запуск
- Docker build стабилизирован:
- образ `node:20-bookworm-slim`;
- `npm ci` в build/deps слоях;
- убраны хрупкие fallback-установки.
- API старт:
- если порт занят, сервер пробует следующий (`3000..3009`) в [index.ts](/D:/prg/frontik/ACDC/src/index.ts).
- Frontend proxy:
- `VITE_API_TARGET` в [vite.config.js](/D:/prg/frontik/ACDC/frontend/vite.config.js).

## 2) Как теперь это работает

## 2.1 Где хранятся данные
- Диаграмма: таблица `diagrams`.
- Блоки: `diagram_blocks`.
- Связи: `diagram_connections`.
- `points` связи хранятся в `diagram_connections.points` как `JSONB`.
- `properties` связи/блока хранятся в `JSONB`.
- Кастомизация каталога:
- типы диаграмм: `diagram_types`;
- типы элементов: `element_types`;
- типы связей: `connection_types`;
- матрица правил: `connection_rules`.

## 2.2 Поток сохранения/загрузки
- Frontend формирует snapshot (`elements`, `connections`, `diagram_type_id`) и отправляет через [diagramsService.js](/D:/prg/frontik/ACDC/frontend/src/services/diagramsService.js).
- Backend сохраняет:
- сначала диаграмму;
- затем блоки;
- затем связи;
- после этого пересчитывает `rule_violation`;
- пишет снапшот в историю.

## 2.3 Поток проверки правил связей
- Frontend делает предварительную проверку (матрица/режим free mode).
- Backend делает обязательную проверку в [diagramConnectionService.ts](/D:/prg/frontik/ACDC/src/services/diagramConnectionService.ts) через `ensureConnectionAllowed`.
- В `free_mode` проверки bypass.

## 2.4 Undo/Redo
- До сохранения и между сохранениями используется локальный стек (`localHistory`).
- Для сохранённых диаграмм доступен серверный undo/redo через `diagram_history`.
- Горячие клавиши обрабатываются в [shared-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/shared-methods.js).

## 3) Важные файлы для входа новых разработчиков

## 3.1 Frontend
- Точка входа: [main.js](/D:/prg/frontik/ACDC/frontend/src/main.js)
- Главный экран: [App.vue](/D:/prg/frontik/ACDC/frontend/src/App.vue)
- Состояние приложения: [app-options.js](/D:/prg/frontik/ACDC/frontend/src/app-options.js)
- Бизнес-методы: [app-methods.js](/D:/prg/frontik/ACDC/frontend/src/app-methods.js)
- Модули методов:
- [shared-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/shared-methods.js)
- [diagram-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/diagram-methods.js)
- [canvas-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/canvas-methods.js)
- [connection-methods.js](/D:/prg/frontik/ACDC/frontend/src/methods/connection-methods.js)
- Правила матрицы: [connectionRules.js](/D:/prg/frontik/ACDC/frontend/src/rules/connectionRules.js)
- API-клиент: [services/index.js](/D:/prg/frontik/ACDC/frontend/src/services/index.js)
- Стили:
- [theme.css](/D:/prg/frontik/ACDC/frontend/src/styles/theme.css)
- [app.css](/D:/prg/frontik/ACDC/frontend/src/styles/app.css)

## 3.2 Backend
- Создание app/DI: [app.ts](/D:/prg/frontik/ACDC/src/app.ts)
- Старт сервера: [index.ts](/D:/prg/frontik/ACDC/src/index.ts)
- Инициализация схемы/seed: [db.ts](/D:/prg/frontik/ACDC/src/db.ts)
- Контракты: [types.ts](/D:/prg/frontik/ACDC/src/types.ts)
- Ключевые репозитории:
- [diagramRepository.ts](/D:/prg/frontik/ACDC/src/repositories/diagramRepository.ts)
- [diagramBlockRepository.ts](/D:/prg/frontik/ACDC/src/repositories/diagramBlockRepository.ts)
- [diagramConnectionRepository.ts](/D:/prg/frontik/ACDC/src/repositories/diagramConnectionRepository.ts)
- [diagramTypeRepository.ts](/D:/prg/frontik/ACDC/src/repositories/diagramTypeRepository.ts)

## 4) Что осталось сделать

## 4.1 Главные технические долги
- Продолжить декомпозицию:
- в [app-options.js](/D:/prg/frontik/ACDC/frontend/src/app-options.js) всё ещё много state/computed;
- в [app.css](/D:/prg/frontik/ACDC/frontend/src/styles/app.css) остаётся крупный файл + дубли/legacy-стили.
- Нормализовать кодировки:
- есть mojibake-строки в комментариях/части текстов (видно в `app-options.js`, `diagram-methods.js`, `connection-methods.js`, README).
- Причесать UX редактора custom element:
- текущий DnD работает для label-полей в preview, но нужен дальнейший polish (выровнять масштабирование/ограничения/автопрокрутку в very-large forms).

## 4.2 Качество и тесты
- Расширить автотесты:
- сейчас тестов мало (в основном `history`, `bend points`);
- нужны unit/integration/UI тесты для rules matrix, custom elements/types, connection anchors, DnD полей.
- Прогнать и зафиксировать единый CI pipeline:
- `typecheck`;
- backend tests;
- frontend build;
- smoke docker-compose.

## 4.3 Функции Stage 2, которые ещё не финализированы
- Auth/share не реализованы функционально:
- есть только DB+policy scaffolding;
- нужно добавить JWT/session middleware, ownership checks, share endpoints.
- ACL для кастомных типов/элементов:
- сейчас по факту глобальные;
- позже нужен owner/team scope.

## 5) Рекомендованный следующий шаг команды
- Стабилизация UI/UX custom element editor:
- довести сценарий создания элемента до production-уровня (без перегруженных форм, с очевидным flow).
- После этого:
- финальная очистка CSS/кодировок;
- закрытие тестового контура;
- затем auth/share финальным спринтом.

