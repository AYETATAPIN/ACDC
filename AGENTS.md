# ACDC Project Guide

This file is a working map for future coding agents. Keep it current when the project structure, commands, auth model, or database schema changes.

## Project Snapshot

ACDC is a diagram editor with:

- Backend: Node.js 20, TypeScript, Express, PostgreSQL.
- Frontend: Vue 3 Options API, Vite, PrimeVue/PrimeIcons, SVG canvas rendering.
- Domain: diagrams, diagram blocks, diagram connections, diagram history, custom diagram types, element types, connection types, connection rules, users and sessions.
- Runtime shape: Express serves `/api/v1/*` and the built SPA from `public/`.

## Important Commands

From repo root:

- `npm run build`: compile backend TypeScript to `dist/`.
- `npm run typecheck`: TypeScript check without emitting.
- `npm run dev`: watch backend via `tsx watch src/index.ts`.
- `npm test`: run Node test runner through `scripts/run-tests.mjs`.
- `npm run build-frontend`: build frontend with `frontend/vite.config.js`.
- `npm run dev-frontend`: run frontend Vite dev server from root.
- `docker-compose up --build`: start PostgreSQL and API.

From `frontend/`:

- `npm run dev`: Vite on `0.0.0.0:5173`.
- `npm run build`: production frontend build.
- `npm run preview`: preview built frontend.

## Environment

- Backend default port: `3000`.
- Frontend dev port: `5173`.
- API base in frontend: `/api/v1` (`frontend/src/services/http.js`).
- DB config is read in `src/config.ts`.
- Local development usually needs `.env` based on `.env.example`.
- Docker DB defaults: `postgres/postgres`, database `acdc`.

## Backend Layout

Backend entrypoints:

- `src/index.ts`: starts the HTTP server, tries up to 10 ports from configured `PORT`.
- `src/app.ts`: builds Express app, initializes DB, wires repositories/services/controllers/routes, serves static frontend.
- `src/db.ts`: creates pg pool, runs schema migrations, seeds built-in diagram catalog.
- `sql/init.sql`: Docker first-run schema initialization. Keep in sync with runtime migrations in `src/db.ts` where relevant.

Layering:

- `src/routes/*`: Express route declarations only.
- `src/controllers/*`: request/response mapping.
- `src/services/*`: business rules, validation, history side effects.
- `src/repositories/*`: SQL and row mapping.
- `src/types.ts`: shared backend domain types.
- `src/middleware/*`: auth context, UUID validation, async wrapper, error handling.
- `src/catalog/builtins.ts`: built-in diagram/element/connection catalog and built-in rule policy.

Route wiring:

- `/api/v1/auth` is mounted before global `requireAuth`.
- All other `/api/v1/*` routes require an authenticated session.
- SPA fallback is `app.get('*')`, serving `public/index.html`.

## Backend Domain Notes

Core tables:

- `users`, `user_sessions`.
- `diagram_types`, `element_types`, `connection_types`, `connection_rules`.
- `diagrams`, `diagram_blocks`, `diagram_connections`, `diagram_history`.
- `share_tokens` exists in schema/types, but sharing behavior is currently scaffold-level.

Diagram kinds:

- `class`
- `use_case`
- `activity_diagram`
- `free_mode`

History:

- `DiagramHistoryService` stores snapshots of diagram, blocks, and connections.
- Mutating diagram/block/connection operations should preserve undo/redo behavior.
- Tests in `test/history.test.ts` cover history, but check current auth requirements before relying on them.

Connection rules:

- Backend validates custom diagram connection rules through `DiagramConnectionService` and `DiagramTypeService`.
- Rule violations may be stored with `rule_violation` on connections.
- Free mode is intended to be permissive.

Auth:

- Passwords use `scrypt` plus optional `PASSWORD_PEPPER`.
- Session tokens are stored as hashes and delivered through the `acdc_session` cookie by default.
- `attachAuthContext` populates `req.user`, `req.auth`, and `req.sessionToken`.
- `requireAuth` rejects unauthenticated API calls with `401`.

## Frontend Layout

Frontend entrypoints:

- `frontend/src/main.js`: mounts Vue app.
- `frontend/src/App.vue`: main template and SVG canvas.
- `frontend/src/app-options.js`: large Options API state/computed/mounted config.
- `frontend/src/app-methods.js`: merges method modules into App.

Frontend method modules:

- `frontend/src/methods/auth-methods.js`: login/register/session/logout flow.
- `frontend/src/methods/diagram-methods.js`: diagram loading/saving/history/type application.
- `frontend/src/methods/canvas-methods.js`: canvas pointer, selection, drag, pan/zoom behavior.
- `frontend/src/methods/connection-methods.js`: connection creation/editing/bend points.
- `frontend/src/methods/shared-methods.js`: formatting, style helpers, shared UI helpers.

Frontend services:

- `frontend/src/services/http.js`: central `fetch` wrapper with `credentials: 'include'`.
- `frontend/src/services/authService.js`: auth endpoints.
- `frontend/src/services/diagramsService.js`: diagrams and history state.
- `frontend/src/services/elementsService.js`: diagram blocks.
- `frontend/src/services/connectionsService.js`: diagram connections.
- `frontend/src/services/diagramTypesService.js`: diagram type CRUD/catalog.
- `frontend/src/services/rulesService.js`: connection rules API.

Frontend rules/utilities:

- `frontend/src/rules/connectionRules.js`: matrix normalization and lookup.
- `frontend/src/utils/bendPoints.js`: bend-point geometry; covered by `test/bend-points.test.ts`.
- `frontend/src/app-constants.js`: built-in diagram type IDs.

## API Surface

Auth:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

Diagrams:

- `GET /api/v1/diagrams`
- `GET /api/v1/diagrams/:id`
- `POST /api/v1/diagrams`
- `PUT /api/v1/diagrams/:id`
- `DELETE /api/v1/diagrams/:id`
- `GET /api/v1/diagrams/:diagramId/history`
- `GET /api/v1/diagrams/:diagramId/state`
- `POST /api/v1/diagrams/:diagramId/undo`
- `POST /api/v1/diagrams/:diagramId/redo`

Blocks and connections:

- `GET /api/v1/diagram-blocks/diagram/:diagramId`
- `GET /api/v1/diagram-blocks/:id`
- `POST /api/v1/diagram-blocks`
- `PUT /api/v1/diagram-blocks/:id`
- `DELETE /api/v1/diagram-blocks/:id`
- `GET /api/v1/diagram-connections/diagram/:diagramId`
- `POST /api/v1/diagram-connections`
- `PUT /api/v1/diagram-connections/:id`
- `POST /api/v1/diagram-connections/:id/bend-points`
- `DELETE /api/v1/diagram-connections/:id`

Diagram types:

- `GET /api/v1/diagram-types`
- `POST /api/v1/diagram-types`
- `GET /api/v1/diagram-types/:id`
- `PUT /api/v1/diagram-types/:id`
- `DELETE /api/v1/diagram-types/:id`
- `POST /api/v1/diagram-types/:id/clone`
- `GET|POST /api/v1/diagram-types/:id/elements`
- `PUT|DELETE /api/v1/diagram-types/:id/elements/:elementId`
- `GET|POST /api/v1/diagram-types/:id/connection-types`
- `PUT|DELETE /api/v1/diagram-types/:id/connection-types/:connectionTypeId`
- `GET /api/v1/diagram-types/:id/rules/matrix`
- `PUT /api/v1/diagram-types/:id/rules/cell`
- `POST /api/v1/diagram-types/:id/rules/bulk`

## Tests And Verification

- Use `npm run typecheck` after TypeScript backend edits.
- Use `npm test` for available tests.
- Integration tests need PostgreSQL. Some tests may skip when DB is unavailable.
- Because protected API routes now require auth, integration tests that call `/api/v1/*` may need a register/login step before they can be trusted.
- Use `npm run build-frontend` after Vue/template/service changes.

## Known Gotchas

- Some existing frontend comments/text appear mojibake-encoded. Avoid spreading that encoding issue; new text should be UTF-8 and concise.
- `project_structure.txt` appears stale and includes generated/vendor paths; prefer `rg --files` for current structure.
- `dist/` and `public/assets/` are generated outputs. Do not edit generated files unless the task specifically targets built artifacts.
- The repo has both root and `frontend/` package manifests. Root scripts call the frontend Vite config when possible.
- Keep runtime migrations in `src/db.ts` and first-run schema in `sql/init.sql` aligned when schema changes.
- Do not bypass the repository/service layering for backend changes unless there is a clear reason.
- When changing persisted block/connection/diagram behavior, check history snapshots and frontend serialization together.
