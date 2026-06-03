import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { clearShareContext, getShareContext, ruleSharesService, setShareContext, sharesService } from '../frontend/src/services/sharesService.js';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearShareContext();
});

test('sharesService calls owner endpoints for list/create/rotate', async () => {
  await sharesService.listOwnerShares('diagram-1');
  await sharesService.createOwnerShare('diagram-1', 'read');
  await sharesService.rotateOwnerShare('diagram-1', 'edit');

  assert.deepEqual(
    calls.map((call) => [call.url, call.init?.method || 'GET']),
    [
      ['/api/v1/diagrams/diagram-1/shares', 'GET'],
      ['/api/v1/diagrams/diagram-1/shares/read', 'POST'],
      ['/api/v1/diagrams/diagram-1/shares/edit/rotate', 'POST'],
    ],
  );
});

test('share context stores active token and access metadata', () => {
  setShareContext({
    token: 'token-1',
    access: { mode: 'shared', permission: 'edit', canWrite: true },
    diagramTypeBundle: { diagram_type: { id: 'type-1' }, element_types: [], connection_types: [], rules_matrix: { cells: [] } },
  });

  assert.equal(getShareContext().token, 'token-1');
  assert.equal(getShareContext().access?.canWrite, true);
  assert.equal(getShareContext().diagramTypeBundle?.diagram_type?.id, 'type-1');
});

test('ruleSharesService calls rule share owner and public endpoints', async () => {
  await ruleSharesService.listOwnerShares('type-1');
  await ruleSharesService.createOwnerShare('type-1');
  await ruleSharesService.rotateOwnerShare('type-1');
  await ruleSharesService.getState('token-1');
  await ruleSharesService.accept('token-1');

  assert.deepEqual(
    calls.map((call) => [call.url, call.init?.method || 'GET']),
    [
      ['/api/v1/diagram-types/type-1/shares', 'GET'],
      ['/api/v1/diagram-types/type-1/shares/read', 'POST'],
      ['/api/v1/diagram-types/type-1/shares/read/rotate', 'POST'],
      ['/api/v1/rule-shares/token-1/state', 'GET'],
      ['/api/v1/rule-shares/token-1/accept', 'POST'],
    ],
  );
});
