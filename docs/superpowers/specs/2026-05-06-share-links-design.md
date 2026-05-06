# Share Links Design

## Goal

Add link sharing for diagrams with two live permissions:

- `read`: anyone with the link can open the current live diagram without logging in.
- `edit`: anyone with the link can edit after logging in.

The feature must keep owner-only actions protected. A collaborator using an edit link can edit the diagram and its related custom diagram type, element types, connection types, and connection rules, but cannot delete the diagram, replace it through import, or manage sharing links.

## Decisions

- Use a separate share-token access path instead of adding token checks to every owner endpoint.
- Use a modal sharing dialog, opened from the editor header.
- Maintain two independent live links per diagram: read and edit.
- Links do not expire in this version.
- Revoking a link rotates it: the old token is invalidated and a new token for the same permission is created immediately.
- Read links open the normal editor UI in read-only mode.
- Edit links require authentication. Anonymous users see the login/register screen and return to the same share URL after successful auth.
- Shared diagrams include the custom type/rules data needed to render and validate the diagram.

## Backend Model

Extend `share_tokens` to support permissioned live links:

- `id UUID PRIMARY KEY`
- `diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE`
- `permission TEXT NOT NULL CHECK (permission IN ('read', 'edit'))`
- `mode TEXT NOT NULL CHECK (mode IN ('live'))`
- `token_hash TEXT NOT NULL UNIQUE`
- `revoked_at TIMESTAMPTZ`
- `expires_at TIMESTAMPTZ` remains available for future use but is not exposed in the first UI.
- `created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Only token hashes are stored. Raw tokens are returned only after create or rotate.

## Owner Share API

Owner routes stay under authenticated `/api/v1` and require diagram ownership:

- `GET /api/v1/diagrams/:id/shares`
  - Returns read/edit link status and current share URLs if active links exist.
- `POST /api/v1/diagrams/:id/shares/:permission`
  - Creates an active read or edit link if missing, otherwise returns the existing active link.
- `POST /api/v1/diagrams/:id/shares/:permission/rotate`
  - Sets `revoked_at` on existing active links for that diagram/permission, creates a new token, and returns the new URL.

Only the owner can call these endpoints. Share-link users cannot manage links.

## Share API

Share routes are separate from owner routes:

- `GET /api/v1/shares/:token/state`
  - Validates token.
  - Returns diagram, blocks, connections, history metadata, related diagram type bundle, and access metadata.
  - Works anonymously for read links.
  - Requires authentication for edit links.
- Edit-only mutation routes under `/api/v1/shares/:token/...`
  - Update diagram name/type/svg data.
  - Create/update/delete blocks.
  - Create/update/delete connections and bend points.
  - Undo/redo.
  - Update the diagram's current custom type, element types, connection types, and rules.

Read tokens return `403` for all mutations. Edit tokens return `401` when no user is authenticated. Revoked, missing, or malformed tokens return a not-valid share-link response.

Owner-only actions are not exposed through share routes:

- Delete diagram.
- Import replace.
- Create or rotate share links.

## Access Semantics

Access metadata returned to the frontend:

- `mode`: `owner | shared`
- `permission`: `owner | read | edit`
- `canRead`
- `canWrite`
- `canShare`
- `canDelete`
- `canReplaceImport`
- `requiresLogin`

Owners using normal routes keep full access. Read links have `canRead=true`, `canWrite=false`, `canShare=false`. Edit links with auth have `canRead=true`, `canWrite=true`, `canShare=false`, `canDelete=false`, `canReplaceImport=false`.

## Frontend UX

Editor header:

- Add `Поделиться` button when a saved diagram is open and the current access allows sharing.
- Open a modal titled `Доступ по ссылке`.

Modal:

- Section `Просмотр`: explains that login is not required.
- Section `Редактирование`: explains that login is required.
- Each section can create/copy a link and rotate it through `Отозвать и создать новую`.
- After rotation, the input immediately shows the new link.

Share opening:

- Route or bootstrap logic recognizes share URLs.
- Read links load the normal editor in read-only mode.
- Edit links without login show the auth gate with a message that login is required for editing, then return to the same share URL after login/register.
- Invalid or revoked links show an explicit invalid-link state.

Read-only mode:

- Pan, zoom, select, and export remain usable.
- Saving, creating, deleting, property edits, undo/redo, import replace, and rules/type editing are disabled.
- Backend remains authoritative and rejects forbidden mutations.

## Testing

Backend integration tests:

- Owner can create read and edit links.
- Non-owner cannot create or rotate links.
- Read link state loads without auth.
- Edit link state without auth returns `401`.
- Edit link state with auth loads.
- Read link cannot mutate.
- Edit link can mutate diagram content and related custom rules/types.
- Edit link cannot delete, replace import, or manage shares.
- Rotate invalidates the old link and returns a different new link.

Frontend tests:

- Share service calls the expected owner and share endpoints.
- Share modal renders read/edit sections and updates links after rotation.
- Read-only access disables mutating controls.
- Edit share without auth routes through the auth gate and preserves redirect.

Verification commands:

- `npm run typecheck`
- `npm test`
- `npm run build-frontend`

## Out of Scope

- Link expiration UI.
- Named collaborators or account-level ACL grants.
- Snapshot share links.
- Real-time multi-user editing.
- Separate sharing for diagram types outside the shared diagram context.
