import {before, after, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import type {Server} from 'http';
import {AddressInfo} from 'node:net';
import {Pool} from 'pg';
import {buildApp} from '../src/app.js';
import {getPool} from '../src/db.js';

let pool: Pool;
let baseUrl = '';
let server: Server | undefined;

before(async () => {
    pool = getPool();
    await resetDb(pool);
    const app = await buildApp();
    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
});

beforeEach(async () => {
    await resetDb(pool);
});

after(async () => {
    if (server) {
        await new Promise<void>((resolve, reject) => {
            server.close((err: any) => (err ? reject(err) : resolve()));
        });
    }
    await pool.end();
});

test('undo/redo возвращают предыдущие состояния диаграммы', async () => {
    const diagramId = await createDiagram('Initial Diagram', 'class', '<svg>v1</svg>');

    await updateDiagram(diagramId, {name: 'Updated Diagram', svg_data: '<svg>v2</svg>'});

    const history = await getHistory(diagramId);
    assert.equal(history.current_version, 2);
    assert.equal(history.entries.length, 2);

    const undo = await postJson(`/api/v1/diagrams/${diagramId}/undo`);
    assert.equal(undo.version, 1);
    assert.equal(undo.state.diagram.name, 'Initial Diagram');
    assert.equal(undo.state.diagram.svg_data, '<svg>v1</svg>');

    const redo = await postJson(`/api/v1/diagrams/${diagramId}/redo`);
    assert.equal(redo.version, 2);
    assert.equal(redo.state.diagram.name, 'Updated Diagram');
    assert.equal(redo.state.diagram.svg_data, '<svg>v2</svg>');
});

test('undo после создания блока очищает блоки', async () => {
    const diagramId = await createDiagram('With block', 'class', '<svg/>');

    await postJson('/api/v1/diagram-blocks', {
        diagram_id: diagramId,
        type: 'node',
        x: 10,
        y: 15,
        width: 120,
        height: 60,
        properties: {label: 'Block'},
    });

    const history = await getHistory(diagramId);
    assert.equal(history.current_version, 2);

    const undo = await postJson(`/api/v1/diagrams/${diagramId}/undo`);
    assert.equal(undo.version, 1);
    assert.equal(undo.state.blocks.length, 0);
});

async function resetDb(p: Pool) {
    await p.query('DELETE FROM diagram_history');
    await p.query('DELETE FROM diagram_connections');
    await p.query('DELETE FROM diagram_blocks');
    await p.query('DELETE FROM diagrams');
}

async function createDiagram(name: string, type: string, svg: string): Promise<string> {
    const res = await postJson('/api/v1/diagrams', {name, type, svg_data: svg});
    return res.id;
}

async function updateDiagram(id: string, body: Record<string, any>) {
    await putJson(`/api/v1/diagrams/${id}`, body);
}

async function getHistory(diagramId: string) {
    return getJson(`/api/v1/diagrams/${diagramId}/history`);
}

async function getJson(path: string) {
    const res = await fetch(baseUrl + path);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
}

async function postJson(path: string, body?: Record<string, any>) {
    const res = await fetch(baseUrl + path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
}

async function putJson(path: string, body: Record<string, any>) {
    const res = await fetch(baseUrl + path, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
}
