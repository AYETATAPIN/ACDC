import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'http';
import { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { getPool } from '../src/db.js';
import type { AcdcDiagramFileV1 } from '../src/types.js';

let pool: Pool;
let baseUrl = '';
let server: Server | undefined;
let dbReady = false;

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
    console.warn('Skipping diagram import integration tests: database is not available.', error);
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

test('create import creates diagram content and history snapshot', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const cookie = await register('create-import@example.test');
  const imported = await postJson(
    '/api/v1/diagrams/import',
    {
      mode: 'create',
      file: buildCustomFile({ name: 'Imported Create' }),
    },
    cookie,
  );

  assert.equal(imported.mode, 'create');
  assert.equal(imported.version, 1);

  const state = await getJson(`/api/v1/diagrams/${imported.id}/state`, cookie);
  assert.equal(state.version, 1);
  assert.equal(state.state.diagram.name, 'Imported Create');
  assert.equal(state.state.blocks.length, 2);
  assert.equal(state.state.connections.length, 1);
  assert.equal(state.state.connections[0].label, 'main');

  const historyRes = await pool.query('SELECT COUNT(*)::int AS count FROM diagram_history WHERE diagram_id = $1', [imported.id]);
  assert.equal(historyRes.rows[0].count, 1);
});

test('replace import requires ownership and replaces only current owner diagram', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const ownerCookie = await register('owner@example.test');
  const intruderCookie = await register('intruder@example.test');
  const imported = await postJson(
    '/api/v1/diagrams/import',
    {
      mode: 'create',
      file: buildCustomFile({ name: 'Owned Before Replace' }),
    },
    ownerCookie,
  );

  const forbidden = await fetch(baseUrl + '/api/v1/diagrams/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: intruderCookie },
    body: JSON.stringify({
      mode: 'replace',
      target_diagram_id: imported.id,
      file: buildCustomFile({ name: 'Intruder Replace' }),
    }),
  });
  assert.equal(forbidden.status, 404);

  const replaced = await postJson(
    '/api/v1/diagrams/import',
    {
      mode: 'replace',
      target_diagram_id: imported.id,
      file: buildCustomFile({ name: 'Owned After Replace', blockText: 'Replacement' }),
    },
    ownerCookie,
  );
  assert.equal(replaced.id, imported.id);
  assert.equal(replaced.mode, 'replace');

  const state = await getJson(`/api/v1/diagrams/${imported.id}/state`, ownerCookie);
  assert.equal(state.state.diagram.name, 'Owned After Replace');
  assert.equal(state.state.blocks[0].properties.text, 'Replacement');
});

test('custom diagram type import clones catalog and remaps type ids', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const cookie = await register('custom-remap@example.test');
  const file = buildCustomFile({ name: 'Custom Catalog' });
  const imported = await postJson('/api/v1/diagrams/import', { mode: 'create', file }, cookie);

  const diagramRes = await pool.query('SELECT diagram_type_id FROM diagrams WHERE id = $1', [imported.id]);
  const importedTypeId = diagramRes.rows[0].diagram_type_id;
  assert.notEqual(importedTypeId, file.diagram_type_bundle.diagram_type.id);

  const typeRes = await pool.query('SELECT is_builtin, owner_user_id FROM diagram_types WHERE id = $1', [importedTypeId]);
  assert.equal(typeRes.rows[0].is_builtin, false);
  assert.ok(typeRes.rows[0].owner_user_id);

  const blockRes = await pool.query('SELECT element_type_id FROM diagram_blocks WHERE diagram_id = $1 ORDER BY created_at LIMIT 1', [imported.id]);
  const connectionRes = await pool.query('SELECT connection_type_id FROM diagram_connections WHERE diagram_id = $1 ORDER BY created_at LIMIT 1', [
    imported.id,
  ]);
  assert.notEqual(blockRes.rows[0].element_type_id, file.diagram_type_bundle.element_types[0].id);
  assert.notEqual(connectionRes.rows[0].connection_type_id, file.diagram_type_bundle.connection_types[0].id);
});

test('invalid import format returns 400', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const cookie = await register('invalid-format@example.test');
  const res = await fetch(baseUrl + '/api/v1/diagrams/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      mode: 'create',
      file: { ...buildCustomFile({ name: 'Invalid' }), version: 999 },
    }),
  });

  assert.equal(res.status, 400);
});

async function resetDb(p: Pool) {
  await p.query('DELETE FROM diagram_history');
  await p.query('DELETE FROM diagram_connections');
  await p.query('DELETE FROM diagram_blocks');
  await p.query('DELETE FROM diagrams');
  await p.query('DELETE FROM diagram_types WHERE is_builtin = FALSE');
  await p.query('DELETE FROM user_sessions');
  await p.query('DELETE FROM users');
}

async function register(email: string): Promise<string> {
  const res = await fetch(baseUrl + '/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', display_name: email }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('register did not return a session cookie');
  return setCookie.split(';')[0];
}

async function getJson(path: string, cookie: string) {
  const res = await fetch(baseUrl + path, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function postJson(path: string, body: Record<string, any>, cookie: string) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function buildCustomFile({ name, blockText = 'Source' }: { name: string; blockText?: string }): AcdcDiagramFileV1 {
  const exportedAt = '2026-05-06T00:00:00.000Z';
  return {
    format: 'acdc.diagram',
    version: 1,
    exported_at: exportedAt,
    diagram: {
      name,
      type: 'class',
      diagram_type_id: '10000000-0000-4000-8000-000000000001',
      svg_data: '<svg/>',
    },
    blocks: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        diagram_id: '30000000-0000-4000-8000-000000000001',
        element_type_id: '10000000-0000-4000-8000-000000000011',
        type: 'custom_node',
        x: 10,
        y: 20,
        width: 120,
        height: 60,
        properties: { text: blockText },
        created_at: exportedAt,
        updated_at: exportedAt,
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        diagram_id: '30000000-0000-4000-8000-000000000001',
        element_type_id: '10000000-0000-4000-8000-000000000012',
        type: 'custom_sink',
        x: 220,
        y: 20,
        width: 120,
        height: 60,
        properties: { text: 'Sink' },
        created_at: exportedAt,
        updated_at: exportedAt,
      },
    ],
    connections: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        diagram_id: '30000000-0000-4000-8000-000000000001',
        from_block_id: '20000000-0000-4000-8000-000000000001',
        to_block_id: '20000000-0000-4000-8000-000000000002',
        connection_type_id: '10000000-0000-4000-8000-000000000021',
        type: 'custom_link',
        points: [{ x: 130, y: 50 }, { x: 220, y: 50 }],
        label: 'main',
        properties: { labelColor: '#111827', labelFontSize: 12 },
        rule_violation: false,
        created_at: exportedAt,
      },
    ],
    diagram_type_bundle: {
      diagram_type: {
        id: '10000000-0000-4000-8000-000000000001',
        key: 'custom_process',
        name: 'Custom Process',
        description: 'Imported custom type',
        is_builtin: false,
        is_free_mode: false,
        clone_source_id: null,
        owner_user_id: null,
        metadata: { source: 'test' },
        created_at: exportedAt,
        updated_at: exportedAt,
      },
      element_types: [
        {
          id: '10000000-0000-4000-8000-000000000011',
          diagram_type_id: '10000000-0000-4000-8000-000000000001',
          key: 'custom_node',
          name: 'Custom Node',
          shape: 'rect',
          svg_path: null,
          default_style: {},
          default_size: { width: 120, height: 60 },
          ports: [],
          field_schema: [],
          is_builtin: false,
          created_at: exportedAt,
          updated_at: exportedAt,
        },
        {
          id: '10000000-0000-4000-8000-000000000012',
          diagram_type_id: '10000000-0000-4000-8000-000000000001',
          key: 'custom_sink',
          name: 'Custom Sink',
          shape: 'rect',
          svg_path: null,
          default_style: {},
          default_size: { width: 120, height: 60 },
          ports: [],
          field_schema: [],
          is_builtin: false,
          created_at: exportedAt,
          updated_at: exportedAt,
        },
      ],
      connection_types: [
        {
          id: '10000000-0000-4000-8000-000000000021',
          diagram_type_id: '10000000-0000-4000-8000-000000000001',
          key: 'custom_link',
          name: 'Custom Link',
          color: '#34495e',
          dash: '',
          arrow_start: 'none',
          arrow_end: 'arrow',
          directed: true,
          default_style: {},
          is_builtin: false,
          created_at: exportedAt,
          updated_at: exportedAt,
        },
      ],
      rules_matrix: {
        elements: [
          { id: '10000000-0000-4000-8000-000000000011', key: 'custom_node', name: 'Custom Node', shape: 'rect' },
          { id: '10000000-0000-4000-8000-000000000012', key: 'custom_sink', name: 'Custom Sink', shape: 'rect' },
        ],
        connection_types: [
          {
            id: '10000000-0000-4000-8000-000000000021',
            key: 'custom_link',
            name: 'Custom Link',
            color: '#34495e',
            dash: '',
            arrow_start: 'none',
            arrow_end: 'arrow',
            directed: true,
          },
        ],
        cells: [
          {
            from_element_type_id: '10000000-0000-4000-8000-000000000011',
            to_element_type_id: '10000000-0000-4000-8000-000000000012',
            rules: [{ connection_type_id: '10000000-0000-4000-8000-000000000021', allowed: true }],
          },
        ],
      },
    },
  };
}
