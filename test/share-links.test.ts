import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'http';
import { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { getPool } from '../src/db.js';
import { ShareController } from '../src/controllers/shareController.js';
import { validateUpdate } from '../src/utils/validators.js';

let pool: Pool;
let baseUrl = '';
let server: Server | undefined;
let dbReady = false;

const BLOCK_A = '20000000-0000-4000-8000-000000000101';
const BLOCK_B = '20000000-0000-4000-8000-000000000102';
const CURRENT_TYPE_ID = '10000000-0000-4000-8000-000000000100';
const CURRENT_ELEMENT_ID = '10000000-0000-4000-8000-000000000101';
const CURRENT_CONNECTION_TYPE_ID = '10000000-0000-4000-8000-000000000102';
const OTHER_ELEMENT_ID = '10000000-0000-4000-8000-000000000201';
const OTHER_CONNECTION_TYPE_ID = '10000000-0000-4000-8000-000000000202';

before(async () => {
  pool = getPool();

  try {
    await pool.query('SELECT 1');

    const app = await buildApp();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    await resetDb(pool);
    dbReady = true;
  } catch (error) {
    dbReady = false;
    // eslint-disable-next-line no-console
    console.warn('Skipping share links integration tests: database is not available.', error);
  }
});

beforeEach(async () => {
  if (!dbReady) return;
  await resetDb(pool);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err: any) => (err ? reject(err) : resolve()));
    });
  }

  if (pool) {
    await pool.end();
  }
});

test('frontend diagram save validator preserves valid element_type_id values', () => {
  const parsed = validateUpdate({
    svg_data: '<svg>payload</svg>',
    elements: [
      {
        id: BLOCK_A,
        type: 'custom_node',
        element_type_id: CURRENT_ELEMENT_ID,
        x: 10,
        y: 20,
        width: 120,
        height: 60,
        text: 'Node',
        properties: { text: 'Node' },
      },
    ],
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal((parsed.data.elements?.[0] as any).element_type_id, CURRENT_ELEMENT_ID);
});

test('share bulk diagram save rejects element and connection types outside the current diagram type before persistence', async () => {
  const updateCalls: any[] = [];
  const controller = new ShareController(
    {
      resolveWriteAccess: async () => ({
        ownerUserId: 'owner-1',
        tokenPermission: 'edit',
        diagram: {
          id: '30000000-0000-4000-8000-000000000001',
          name: 'Shared',
          type: 'class',
          diagram_type_id: CURRENT_TYPE_ID,
          owner_user_id: 'owner-1',
          svg_data: '<svg/>',
          created_at: '2026-05-06T00:00:00.000Z',
          updated_at: '2026-05-06T00:00:00.000Z',
        },
        access: { mode: 'shared', permission: 'edit', canRead: true, canWrite: true, canShare: false },
      }),
    } as any,
    {
      update: async (...args: any[]) => {
        updateCalls.push(args);
        return { id: args[1], name: 'Should not persist' };
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {
      listElements: async () => [{ id: CURRENT_ELEMENT_ID }],
      listConnectionTypes: async () => [{ id: CURRENT_CONNECTION_TYPE_ID }],
    } as any,
  );

  await assert.rejects(
    () =>
      controller.updateDiagram(
        {
          params: { token: 'share-token' },
          auth: { userId: 'collaborator-1', isAuthenticated: true },
          body: {
            diagram_type_id: CURRENT_TYPE_ID,
            svg_data: '<svg>bulk</svg>',
            elements: [
              {
                id: BLOCK_A,
                type: 'custom_node',
                element_type_id: OTHER_ELEMENT_ID,
                x: 10,
                y: 10,
                width: 120,
                height: 60,
              },
              {
                id: BLOCK_B,
                type: 'custom_sink',
                element_type_id: CURRENT_ELEMENT_ID,
                x: 220,
                y: 10,
                width: 120,
                height: 60,
              },
            ],
            connections: [
              {
                from: BLOCK_A,
                to: BLOCK_B,
                type: 'custom_link',
                connection_type_id: OTHER_CONNECTION_TYPE_ID,
              },
            ],
          },
        } as any,
        responseStub() as any,
      ),
    (error: any) => error?.status === 403,
  );
  assert.equal(updateCalls.length, 0);
});

test('owner creates read and edit shares and existing active links are listed without raw URLs', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-create@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Share owner create');

  const initial = await getJson(`/api/v1/diagrams/${diagramId}/shares`, owner.cookie);
  assert.deepEqual(
    initial.items.map((item: any) => ({ permission: item.permission, active: item.active, url: item.url })),
    [
      { permission: 'read', active: false, url: null },
      { permission: 'edit', active: false, url: null },
    ],
  );

  const read = await postJson(`/api/v1/diagrams/${diagramId}/shares/read`, undefined, owner.cookie, 201);
  const edit = await postJson(`/api/v1/diagrams/${diagramId}/shares/edit`, undefined, owner.cookie, 201);
  assert.equal(read.permission, 'read');
  assert.equal(edit.permission, 'edit');
  assert.match(read.url, new RegExp(`^${baseUrl}/share/`));
  assert.match(edit.url, new RegExp(`^${baseUrl}/share/`));
  assert.ok(read.token);
  assert.ok(edit.token);

  const listed = await getJson(`/api/v1/diagrams/${diagramId}/shares`, owner.cookie);
  assert.deepEqual(
    listed.items.map((item: any) => ({ permission: item.permission, active: item.active, url: item.url })),
    [
      { permission: 'read', active: true, url: null },
      { permission: 'edit', active: true, url: null },
    ],
  );

  const existing = await postJson(`/api/v1/diagrams/${diagramId}/shares/read`, undefined, owner.cookie, 200);
  assert.equal(existing.active, true);
  assert.equal(existing.url, null);
  assert.equal(existing.token, undefined);
});

test('non-owner cannot create or rotate share links', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-denial@example.test');
  const intruder = await register('share-intruder-denial@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Owner only shares');

  await postJson(`/api/v1/diagrams/${diagramId}/shares/read`, undefined, intruder.cookie, 404);
  await postJson(`/api/v1/diagrams/${diagramId}/shares/edit/rotate`, undefined, intruder.cookie, 404);
});

test('read share state loads anonymously while edit share state requires authentication', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-state@example.test');
  const collaborator = await register('share-collab-state@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Shared state');
  const read = await createShare(owner.cookie, diagramId, 'read');
  const edit = await createShare(owner.cookie, diagramId, 'edit');

  const readState = await getJson(`/api/v1/shares/${read.token}/state`);
  assert.equal(readState.diagram.id, diagramId);
  assert.equal(readState.access.permission, 'read');
  assert.equal(readState.access.canWrite, false);
  assert.equal(readState.access.canShare, false);

  const anonymousEdit = await fetch(baseUrl + `/api/v1/shares/${edit.token}/state`);
  assert.equal(anonymousEdit.status, 401);
  assert.equal((await anonymousEdit.json()).code, 'share_login_required');

  const editState = await getJson(`/api/v1/shares/${edit.token}/state`, collaborator.cookie);
  assert.equal(editState.diagram.id, diagramId);
  assert.equal(editState.access.permission, 'edit');
  assert.equal(editState.access.canWrite, true);
  assert.equal(editState.access.canDelete, false);
  assert.equal(editState.access.canReplaceImport, false);
});

test('read share cannot mutate and authenticated edit share can update diagram content', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-mutate@example.test');
  const collaborator = await register('share-collab-mutate@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Read only');
  const read = await createShare(owner.cookie, diagramId, 'read');
  const edit = await createShare(owner.cookie, diagramId, 'edit');

  await putJson(`/api/v1/shares/${read.token}/diagram`, { name: 'Forbidden' }, collaborator.cookie, 403);

  const updated = await putJson(
    `/api/v1/shares/${edit.token}/diagram`,
    { name: 'Edited through share', svg_data: '<svg>edited</svg>' },
    collaborator.cookie,
    200,
  );
  assert.equal(updated.name, 'Edited through share');

  const state = await getJson(`/api/v1/shares/${edit.token}/state`, collaborator.cookie);
  assert.equal(state.diagram.name, 'Edited through share');
  assert.equal(state.diagram.svg_data, '<svg>edited</svg>');
});

test('rotate invalidates the old link and returns a different new link', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-rotate@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Rotated share');
  const first = await createShare(owner.cookie, diagramId, 'read');
  const rotated = await postJson(`/api/v1/diagrams/${diagramId}/shares/read/rotate`, undefined, owner.cookie, 201);

  assert.notEqual(rotated.token, first.token);
  assert.notEqual(rotated.url, first.url);
  assert.match(rotated.url, new RegExp(`^${baseUrl}/share/`));

  await getJson(`/api/v1/shares/${first.token}/state`, undefined, 404);
  const state = await getJson(`/api/v1/shares/${rotated.token}/state`);
  assert.equal(state.diagram.id, diagramId);
});

test('edit share routes do not expose delete, import replace, or share management', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-owner-actions@example.test');
  const collaborator = await register('share-collab-owner-actions@example.test');
  const diagramId = await createDiagram(owner.cookie, 'Owner action denial');
  const edit = await createShare(owner.cookie, diagramId, 'edit');

  await request('DELETE', `/api/v1/shares/${edit.token}/diagram`, collaborator.cookie, undefined, 404);
  await request('POST', `/api/v1/shares/${edit.token}/diagrams/import`, collaborator.cookie, { mode: 'replace' }, 404);
  await request('POST', `/api/v1/shares/${edit.token}/shares/read`, collaborator.cookie, undefined, 404);
});

test('edit share bulk save preserves valid frontend element_type_id values', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-preserve-element-type@example.test');
  const collaborator = await register('share-collab-preserve-element-type@example.test');
  const catalog = await createCustomCatalog(owner.cookie, 'Preserve Type');
  const diagramId = await createDiagram(owner.cookie, 'Preserve element type', catalog.type.id);
  const edit = await createShare(owner.cookie, diagramId, 'edit');

  await putJson(`/api/v1/shares/${edit.token}/diagram`, buildBulkSave(catalog), collaborator.cookie, 200);

  const state = await getJson(`/api/v1/shares/${edit.token}/state`, collaborator.cookie);
  assert.equal(state.blocks[0].element_type_id, catalog.elements[0].id);
  assert.equal(state.blocks[1].element_type_id, catalog.elements[1].id);
  assert.equal(state.connections[0].connection_type_id, catalog.connectionType.id);
});

test('edit share bulk save rejects element and connection types outside the shared diagram type', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const owner = await register('share-owner-scope@example.test');
  const collaborator = await register('share-collab-scope@example.test');
  const currentCatalog = await createCustomCatalog(owner.cookie, 'Current Type');
  const otherCatalog = await createCustomCatalog(owner.cookie, 'Other Type');
  const diagramId = await createDiagram(owner.cookie, 'Scoped bulk save', currentCatalog.type.id);
  const edit = await createShare(owner.cookie, diagramId, 'edit');

  await putJson(
    `/api/v1/shares/${edit.token}/diagram`,
    buildBulkSave(currentCatalog, {
      elementTypeId: otherCatalog.elements[0].id,
      connectionTypeId: otherCatalog.connectionType.id,
    }),
    collaborator.cookie,
    403,
  );

  const state = await getJson(`/api/v1/shares/${edit.token}/state`, collaborator.cookie);
  assert.equal(state.blocks.length, 0);
  assert.equal(state.connections.length, 0);
});

async function resetDb(p: Pool) {
  await p.query('DELETE FROM share_tokens');
  await p.query('DELETE FROM diagram_history');
  await p.query('DELETE FROM diagram_connections');
  await p.query('DELETE FROM diagram_blocks');
  await p.query('DELETE FROM diagrams');
  await p.query('DELETE FROM diagram_types WHERE is_builtin = FALSE');
  await p.query('DELETE FROM user_sessions');
  await p.query('DELETE FROM users');
}

async function register(email: string): Promise<{ cookie: string }> {
  const res = await fetch(baseUrl + '/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', display_name: email }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('register did not return a session cookie');
  return { cookie: setCookie.split(';')[0] };
}

async function createDiagram(cookie: string, name: string, diagramTypeId?: string): Promise<string> {
  const res = await postJson(
    '/api/v1/diagrams',
    { name, type: 'class', diagram_type_id: diagramTypeId, svg_data: '<svg>initial</svg>' },
    cookie,
    201,
  );
  return res.id;
}

async function createShare(cookie: string, diagramId: string, permission: 'read' | 'edit') {
  return postJson(`/api/v1/diagrams/${diagramId}/shares/${permission}`, undefined, cookie, 201);
}

async function createCustomCatalog(cookie: string, name: string) {
  const suffix = name.toLowerCase().replace(/\s+/g, '_');
  const type = await postJson(
    '/api/v1/diagram-types',
    { key: `type_${suffix}`, name, is_free_mode: true, metadata: { test: true } },
    cookie,
    201,
  );
  const first = await postJson(
    `/api/v1/diagram-types/${type.id}/elements`,
    { key: `source_${suffix}`, name: `${name} Source`, shape: 'rect' },
    cookie,
    201,
  );
  const second = await postJson(
    `/api/v1/diagram-types/${type.id}/elements`,
    { key: `sink_${suffix}`, name: `${name} Sink`, shape: 'rect' },
    cookie,
    201,
  );
  const connectionType = await postJson(
    `/api/v1/diagram-types/${type.id}/connection-types`,
    { key: `link_${suffix}`, name: `${name} Link`, color: '#334155', arrow_end: 'arrow', directed: true },
    cookie,
    201,
  );

  return { type, elements: [first, second], connectionType };
}

function buildBulkSave(
  catalog: Awaited<ReturnType<typeof createCustomCatalog>>,
  overrides: { elementTypeId?: string; connectionTypeId?: string } = {},
) {
  return {
    name: 'Bulk saved',
    diagram_type_id: catalog.type.id,
    svg_data: '<svg>bulk</svg>',
    elements: [
      {
        id: BLOCK_A,
        type: catalog.elements[0].key,
        element_type_id: overrides.elementTypeId ?? catalog.elements[0].id,
        x: 10,
        y: 10,
        width: 120,
        height: 60,
        text: 'A',
        properties: { label: 'A' },
      },
      {
        id: BLOCK_B,
        type: catalog.elements[1].key,
        element_type_id: catalog.elements[1].id,
        x: 220,
        y: 10,
        width: 120,
        height: 60,
        text: 'B',
        properties: { label: 'B' },
      },
    ],
    connections: [
      {
        from: BLOCK_A,
        to: BLOCK_B,
        type: catalog.connectionType.key,
        connection_type_id: overrides.connectionTypeId ?? catalog.connectionType.id,
        label: 'link',
        points: [
          { x: 130, y: 40 },
          { x: 220, y: 40 },
        ],
        properties: { labelColor: '#111827' },
      },
    ],
  };
}

async function getJson(path: string, cookie?: string, expectedStatus = 200) {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(baseUrl + path, { headers });
  if (res.status !== expectedStatus) {
    assert.equal(res.status, expectedStatus, `GET ${path} returned ${res.status}: ${await res.text()}`);
  }
  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
  return null;
}

async function postJson(path: string, body?: Record<string, any>, cookie?: string, expectedStatus = 200) {
  return request('POST', path, cookie, body, expectedStatus);
}

async function putJson(path: string, body: Record<string, any>, cookie?: string, expectedStatus = 200) {
  return request('PUT', path, cookie, body, expectedStatus);
}

async function request(method: string, path: string, cookie?: string, body?: Record<string, any>, expectedStatus = 200) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status !== expectedStatus) {
    assert.equal(res.status, expectedStatus, `${method} ${path} returned ${res.status}: ${await res.text()}`);
  }
  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
  return null;
}

function responseStub() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}
