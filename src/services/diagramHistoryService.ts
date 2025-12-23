import {Pool, PoolClient} from 'pg';
import {v4 as uuidv4} from 'uuid';
import { Diagram, DiagramBlock, DiagramConnection, Point } from '../types.js';
import type { DiagramHistoryEntry, DiagramSnapshot } from '../types.js';

type UndoRedoResult =
    | { status: 'ok'; version: number; state: DiagramSnapshot }
    | { status: 'not_found' }
    | { status: 'no_history' };

type HistoryListResult =
    | { status: 'ok'; currentVersion: number; entries: Array<Pick<DiagramHistoryEntry, 'version' | 'created_at'>> }
    | { status: 'not_found' };

type CurrentStateResult =
    | { status: 'ok'; version: number; state: DiagramSnapshot }
    | { status: 'not_found' }
    | { status: 'no_history' };

type DiagramRow = {
    id: string;
    name: string;
    type: string;
    svg_data: string;
    created_at: string | Date;
    updated_at: string | Date;
    current_version: number;
};

const mapDiagramRow = (row: DiagramRow): Diagram => ({
    id: row.id,
    name: row.name,
    type: row.type as Diagram['type'],
    svg_data: row.svg_data,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

const toNumber = (value: any): number => Number(value ?? 0);

const parseProperties = (value: any): Record<string, any> => {
    if (value === undefined || value === null) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value;
    return {};
};

const mapBlockRow = (row: any): DiagramBlock => ({
    id: row.id,
    diagram_id: row.diagram_id,
    type: row.type,
    x: toNumber(row.x),
    y: toNumber(row.y),
    width: toNumber(row.width),
    height: toNumber(row.height),
    properties: parseProperties(row.properties),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

const mapConnectionRow = (row: any): DiagramConnection => {
    let points: Point[] = [];

    if (row.points) {
        if (typeof row.points === 'string') {
            try {
                points = JSON.parse(row.points);
            } catch {
                points = [];
            }
        } else if (Array.isArray(row.points)) {
            points = row.points.map((p: any) => ({
                x: Number(p.x) || 0,
                y: Number(p.y) || 0,
            }));
        }
    }

    const properties = parseProperties(row.properties);

    return {
        id: row.id,
        diagram_id: row.diagram_id,
        from_block_id: row.from_block_id,
        to_block_id: row.to_block_id,
        type: row.type,
        points,
        label: row.label,
        properties,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
};

export class DiagramHistoryService {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Сохраняет снапшот текущей диаграммы и очищает redo-стек, если мы были не на последней версии.
     */
    async recordSnapshot(diagramId: string): Promise<number> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const diagramRow = await this.getDiagramRow(client, diagramId, true);
            if (!diagramRow) throw new Error('Diagram not found');

            // После undo новая версия должна очистить redo-ветку
            await client.query(
                'DELETE FROM diagram_history WHERE diagram_id = $1 AND version > $2',
                [diagramId, diagramRow.current_version ?? 0]
            );

            // ОГРАНИЧЕНИЕ: Удаляем старые снапшоты, если их больше 50
            const maxSnapshots = 50;
            const countRes = await client.query(
                'SELECT COUNT(*) as count FROM diagram_history WHERE diagram_id = $1',
                [diagramId]
            );
            const snapshotCount = parseInt(countRes.rows[0].count);

            if (snapshotCount >= maxSnapshots) {
                // Удаляем самые старые снапшоты, оставляя maxSnapshots-1
                await client.query(
                    `DELETE FROM diagram_history 
                 WHERE diagram_id = $1 AND version IN (
                     SELECT version FROM diagram_history 
                     WHERE diagram_id = $1 
                     ORDER BY version ASC 
                     LIMIT $2
                 )`,
                    [diagramId, snapshotCount - maxSnapshots + 1]
                );
            }

            const snapshot = await this.buildSnapshot(client, diagramRow);
            const nextVersion = (diagramRow.current_version ?? 0) + 1;

            await client.query(
                `INSERT INTO diagram_history (id, diagram_id, version, state)
                 VALUES ($1, $2, $3, $4)`,
                [uuidv4(), diagramId, nextVersion, snapshot]
            );

            await client.query(
                'UPDATE diagrams SET current_version = $1 WHERE id = $2',
                [nextVersion, diagramId]
            );

            await client.query('COMMIT');
            return nextVersion;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async undo(diagramId: string): Promise<UndoRedoResult> {
        return this.restoreToVersion(diagramId, 'undo');
    }

    async redo(diagramId: string): Promise<UndoRedoResult> {
        return this.restoreToVersion(diagramId, 'redo');
    }

    async getHistory(diagramId: string): Promise<HistoryListResult> {
        const client = await this.pool.connect();
        try {
            const diagRes = await client.query<{ current_version: number }>(
                'SELECT current_version FROM diagrams WHERE id = $1',
                [diagramId]
            );
            if (diagRes.rows.length === 0) return {status: 'not_found'};

            const historyRes = await client.query<{ version: number; created_at: Date }>(
                'SELECT version, created_at FROM diagram_history WHERE diagram_id = $1 ORDER BY version',
                [diagramId]
            );

            return {
                status: 'ok',
                currentVersion: diagRes.rows[0].current_version ?? 0,
                entries: historyRes.rows.map((row) => ({
                    version: row.version,
                    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as unknown as string),
                })),
            };
        } finally {
            client.release();
        }
    }

    async getCurrentState(diagramId: string): Promise<CurrentStateResult> {
        const client = await this.pool.connect();
        try {
            const diagramRow = await this.getDiagramRow(client, diagramId);
            if (!diagramRow) return {status: 'not_found'};

            const version = diagramRow.current_version ?? 0;
            if (version === 0) {
                return {status: 'no_history'};
            }

            const snapshot = await this.getSnapshot(client, diagramId, version);
            if (!snapshot) return {status: 'no_history'};

            return {status: 'ok', version, state: snapshot};
        } finally {
            client.release();
        }
    }

    private async restoreToVersion(diagramId: string, direction: 'undo' | 'redo'): Promise<UndoRedoResult> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const diagramRow = await this.getDiagramRow(client, diagramId, true);
            if (!diagramRow) {
                await client.query('ROLLBACK');
                return {status: 'not_found'};
            }

            const currentVersion = diagramRow.current_version ?? 0;
            const targetVersion = direction === 'undo' ? currentVersion - 1 : currentVersion + 1;
            if (targetVersion < 1) {
                await client.query('ROLLBACK');
                return {status: 'no_history'};
            }

            const snapshot = await this.getSnapshot(client, diagramId, targetVersion);
            if (!snapshot) {
                await client.query('ROLLBACK');
                return {status: 'no_history'};
            }

            await this.applySnapshot(client, diagramId, snapshot, targetVersion);
            await client.query('COMMIT');
            return {status: 'ok', version: targetVersion, state: snapshot};
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    private async getDiagramRow(client: PoolClient, diagramId: string, forUpdate = false): Promise<DiagramRow | null> {
        const res = await client.query<DiagramRow>(
            `SELECT id, name, type, svg_data, created_at, updated_at, current_version
             FROM diagrams WHERE id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
            [diagramId]
        );
        return res.rows[0] ?? null;
    }

    private async buildSnapshot(client: PoolClient, diagramRow: DiagramRow): Promise<DiagramSnapshot> {
        const blocksRes = await client.query(
            `SELECT id, diagram_id, type, x, y, width, height, properties, created_at, updated_at
             FROM diagram_blocks WHERE diagram_id = $1 ORDER BY created_at`,
            [diagramRow.id]
        );
        const connectionsRes = await client.query(
            `SELECT id, diagram_id, from_block_id, to_block_id, type, points, label, properties, created_at
             FROM diagram_connections WHERE diagram_id = $1 ORDER BY created_at`,
            [diagramRow.id]
        );

        return {
            diagram: mapDiagramRow(diagramRow),
            blocks: blocksRes.rows.map(mapBlockRow),
            connections: connectionsRes.rows.map(mapConnectionRow),
        };
    }

    private async getSnapshot(client: PoolClient, diagramId: string, version: number): Promise<DiagramSnapshot | null> {
        const res = await client.query<{ state: DiagramSnapshot }>(
            'SELECT state FROM diagram_history WHERE diagram_id = $1 AND version = $2',
            [diagramId, version]
        );
        return res.rows[0]?.state ?? null;
    }

    private async applySnapshot(client: PoolClient, diagramId: string, snapshot: DiagramSnapshot, targetVersion: number): Promise<void> {
        // Удаляем связи и блоки, чтобы восстановить их из снапшота
        await client.query('DELETE FROM diagram_connections WHERE diagram_id = $1', [diagramId]);
        await client.query('DELETE FROM diagram_blocks WHERE diagram_id = $1', [diagramId]);

        for (const block of snapshot.blocks) {
            await client.query(
                `INSERT INTO diagram_blocks (id, diagram_id, type, x, y, width, height, properties, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    block.id,
                    block.diagram_id,
                    block.type,
                    Number(block.x ?? 0),
                    Number(block.y ?? 0),
                    Number(block.width ?? 0),
                    Number(block.height ?? 0),
                    JSON.stringify(block.properties), // ПРАВИЛЬНАЯ сериализация
                    block.created_at,
                    block.updated_at,
                ]
            );
        }

        for (const connection of snapshot.connections) {
            // Подготовка points
            let pointsJson = '[]';

            if (connection.points) {
                if (typeof connection.points === 'string') {
                    // Проверяем валидность JSON строки
                    try {
                        JSON.parse(connection.points);
                        pointsJson = connection.points;
                    } catch {
                        pointsJson = '[]';
                    }
                } else if (Array.isArray(connection.points)) {
                    // Сериализуем массив в JSON
                    pointsJson = JSON.stringify(connection.points);
                }
            }

            const propertiesJson = JSON.stringify(connection.properties || {});

            await client.query(
                `INSERT INTO diagram_connections (id, diagram_id, from_block_id, to_block_id, type, points, label, properties, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    connection.id,
                    connection.diagram_id,
                    connection.from_block_id,
                    connection.to_block_id,
                    connection.type,
                    pointsJson,
                    connection.label || null,
                    propertiesJson,
                    connection.created_at,
                ]
            );
        }

        await client.query(
            `UPDATE diagrams
             SET name = $1,
                 type = $2,
                 svg_data = $3,
                 updated_at = $4,
                 current_version = $5
             WHERE id = $6`,
            [
                snapshot.diagram.name,
                snapshot.diagram.type,
                snapshot.diagram.svg_data,
                snapshot.diagram.updated_at,
                targetVersion,
                diagramId,
            ]
        );
    }
}
