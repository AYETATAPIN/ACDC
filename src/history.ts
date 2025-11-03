import type { RedisClientType } from 'redis';
import { config } from './config.js';
import { Diagram, DiagramType } from './types.js';

export interface DiagramSnapshot {
  name: string;
  type: DiagramType;
  svg_data: string;
  timestamp: string; // ISO
}

const undoKey = (id: string) => `diagram:history:undo:${id}`;
const redoKey = (id: string) => `diagram:history:redo:${id}`;

const clampHistory = async (client: RedisClientType, key: string) => {
  const limit = config.history.limit;
  await client.lTrim(key, 0, limit - 1);
};

export const toSnapshot = (d: Diagram): DiagramSnapshot => ({
  name: d.name,
  type: d.type,
  svg_data: d.svg_data,
  timestamp: new Date().toISOString(),
});

export const pushUndo = async (client: RedisClientType, id: string, snap: DiagramSnapshot) => {
  const key = undoKey(id);
  await client.lPush(key, JSON.stringify(snap));
  await clampHistory(client, key);
};

export const popUndo = async (client: RedisClientType, id: string): Promise<DiagramSnapshot | null> => {
  const raw = await client.lPop(undoKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw) as DiagramSnapshot; } catch { return null; }
};

export const pushRedo = async (client: RedisClientType, id: string, snap: DiagramSnapshot) => {
  const key = redoKey(id);
  await client.lPush(key, JSON.stringify(snap));
  await clampHistory(client, key);
};

export const popRedo = async (client: RedisClientType, id: string): Promise<DiagramSnapshot | null> => {
  const raw = await client.lPop(redoKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw) as DiagramSnapshot; } catch { return null; }
};

export const clearRedo = async (client: RedisClientType, id: string) => {
  await client.del(redoKey(id));
};

export const clearAllHistory = async (client: RedisClientType, id: string) => {
  await client.del(undoKey(id));
  await client.del(redoKey(id));
};

