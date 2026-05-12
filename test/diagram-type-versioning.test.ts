import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'http';
import { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { getPool } from '../src/db.js';

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
    console.warn('Skipping diagram type versioning integration tests: database is not available.', error);
  }
});

beforeEach(async () => {
  if (!dbReady) return;
  await resetDb(pool);
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((err: any) => (err ? reject(err) : resolve()));
    });
  }

  if (pool) {
    await pool.end();
  }
});

test('diagram pins diagram type version and reports upgrade issues without changing the pinned version', async (t) => {
  if (!dbReady) {
    t.skip('Database is not available in this environment');
    return;
  }

  const cookie = await register('versioning-owner@example.test');
  const catalog = await createCatalog(cookie);
  const diagramId = await createDiagram(cookie, catalog.type.id);
  const firstPair = await createBlockPair(cookie, diagramId, catalog);

  await postJson('/api/v1/diagram-connections', {
    diagram_id: diagramId,
    from_block_id: firstPair.from.id,
    to_block_id: firstPair.to.id,
    connection_type_id: catalog.connection.id,
    type: catalog.connection.key,
    label: 'v1 connection',
  }, cookie, 201);

  const initialStatus = await getJson(`/api/v1/diagrams/${diagramId}/type-version-status`, cookie);
  assert.equal(initialStatus.current_version_number, initialStatus.latest_version_number);
  assert.equal(initialStatus.has_update, false);

  await putJson(`/api/v1/diagram-types/${catalog.type.id}/rules/cell`, {
    from_element_type_id: catalog.source.id,
    to_element_type_id: catalog.sink.id,
    rules: [{ connection_type_id: catalog.connection.id, allowed: false }],
  }, cookie);

  const staleStatus = await getJson(`/api/v1/diagrams/${diagramId}/type-version-status`, cookie);
  assert.equal(staleStatus.current_version_number, initialStatus.current_version_number);
  assert.equal(staleStatus.latest_version_number, initialStatus.latest_version_number + 1);
  assert.equal(staleStatus.has_update, true);

  const secondPair = await createBlockPair(cookie, diagramId, catalog);
  await postJson('/api/v1/diagram-connections', {
    diagram_id: diagramId,
    from_block_id: secondPair.from.id,
    to_block_id: secondPair.to.id,
    connection_type_id: catalog.connection.id,
    type: catalog.connection.key,
    label: 'still allowed by pinned v1',
  }, cookie, 201);

  const failedUpgrade = await postJson(`/api/v1/diagrams/${diagramId}/type-version-update`, undefined, cookie, 409);
  assert.equal(failedUpgrade.current_version_number, initialStatus.current_version_number);
  assert.equal(failedUpgrade.latest_version_number, staleStatus.latest_version_number);
  assert.equal(failedUpgrade.issues.length, 2);
  assert.equal(failedUpgrade.issues[0].kind, 'connection_rule_violation');

  const afterFailedUpgrade = await getJson(`/api/v1/diagrams/${diagramId}/type-version-status`, cookie);
  assert.equal(afterFailedUpgrade.current_version_number, initialStatus.current_version_number);
  assert.equal(afterFailedUpgrade.has_update, true);

  await putJson(`/api/v1/diagram-types/${catalog.type.id}/rules/cell`, {
    from_element_type_id: catalog.source.id,
    to_element_type_id: catalog.sink.id,
    rules: [{ connection_type_id: catalog.connection.id, allowed: true }],
  }, cookie);

  const successfulUpgrade = await postJson(`/api/v1/diagrams/${diagramId}/type-version-update`, undefined, cookie, 200);
  assert.equal(successfulUpgrade.success, true);
  assert.equal(successfulUpgrade.version_number, staleStatus.latest_version_number + 1);

  const finalStatus = await getJson(`/api/v1/diagrams/${diagramId}/type-version-status`, cookie);
  assert.equal(finalStatus.current_version_number, successfulUpgrade.version_number);
  assert.equal(finalStatus.latest_version_number, successfulUpgrade.version_number);
  assert.equal(finalStatus.has_update, false);
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

async function createCatalog(cookie: string) {
  const type = await postJson('/api/v1/diagram-types', {
    key: `versioned_type_${Date.now()}`,
    name: 'Versioned Type',
    is_free_mode: false,
  }, cookie, 201);
  const source = await postJson(`/api/v1/diagram-types/${type.id}/elements`, {
    key: 'source_node',
    name: 'Source Node',
    shape: 'rect',
  }, cookie, 201);
  const sink = await postJson(`/api/v1/diagram-types/${type.id}/elements`, {
    key: 'sink_node',
    name: 'Sink Node',
    shape: 'rect',
  }, cookie, 201);
  const connection = await postJson(`/api/v1/diagram-types/${type.id}/connection-types`, {
    key: 'versioned_link',
    name: 'Versioned Link',
    directed: true,
  }, cookie, 201);
  return { type, source, sink, connection };
}

async function createDiagram(cookie: string, diagramTypeId: string) {
  const res = await postJson('/api/v1/diagrams', {
    name: 'Version pinned diagram',
    type: 'class',
    diagram_type_id: diagramTypeId,
    svg_data: '<svg/>',
  }, cookie, 201);
  return res.id;
}

async function createBlockPair(cookie: string, diagramId: string, catalog: Awaited<ReturnType<typeof createCatalog>>) {
  const from = await postJson('/api/v1/diagram-blocks', {
    diagram_id: diagramId,
    element_type_id: catalog.source.id,
    type: catalog.source.key,
    x: 10,
    y: 10,
    width: 120,
    height: 60,
    properties: { text: 'Source' },
  }, cookie, 201);
  const to = await postJson('/api/v1/diagram-blocks', {
    diagram_id: diagramId,
    element_type_id: catalog.sink.id,
    type: catalog.sink.key,
    x: 200,
    y: 10,
    width: 120,
    height: 60,
    properties: { text: 'Sink' },
  }, cookie, 201);
  return { from, to };
}

async function getJson(path: string, cookie: string, expectedStatus = 200) {
  const res = await fetch(baseUrl + path, { headers: { Cookie: cookie } });
  if (res.status !== expectedStatus) {
    assert.equal(res.status, expectedStatus, `GET ${path} returned ${res.status}: ${await res.text()}`);
  }
  return parseJsonResponse(res, `GET ${path}`);
}

async function postJson(path: string, body: Record<string, any> | undefined, cookie: string, expectedStatus = 200) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status !== expectedStatus) {
    assert.equal(res.status, expectedStatus, `POST ${path} returned ${res.status}: ${await res.text()}`);
  }
  return parseJsonResponse(res, `POST ${path}`);
}

async function putJson(path: string, body: Record<string, any>, cookie: string, expectedStatus = 200) {
  const res = await fetch(baseUrl + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (res.status !== expectedStatus) {
    assert.equal(res.status, expectedStatus, `PUT ${path} returned ${res.status}: ${await res.text()}`);
  }
  return parseJsonResponse(res, `PUT ${path}`);
}

async function parseJsonResponse(res: Response, label: string) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    assert.fail(`${label} returned non-JSON response: ${text.slice(0, 120)}`);
  }
}
