import type { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { Diagram, DiagramCreateInput, DiagramUpdateInput } from '../types.js';
import { DiagramRepository } from '../repositories/diagramRepository.js';
import { clearAllHistory, clearRedo, popRedo, popUndo, pushRedo, pushUndo, toSnapshot } from '../history.js';

export class DiagramService {
  private repo: DiagramRepository;
  private redis: RedisClientType;

  constructor(repo: DiagramRepository, redis: RedisClientType) {
    this.repo = repo;
    this.redis = redis;
  }

  async list(): Promise<Diagram[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<Diagram | null> {
    return this.repo.getById(id);
  }

  async create(input: DiagramCreateInput): Promise<{ id: string }> {
    const id = uuidv4();
    await this.repo.create(id, input);
    return { id };
  }

  async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
    // get current to snapshot for undo stack
    const current = await this.repo.getById(id);
    if (!current) return null;
    await pushUndo(this.redis, id, toSnapshot(current));
    // apply update
    const updated = await this.repo.update(id, input);
    // clear redo stack after a new change
    await clearRedo(this.redis, id);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ok = await this.repo.delete(id);
    await clearAllHistory(this.redis, id);
    return ok;
  }

  async undo(id: string): Promise<Diagram | null> {
    const current = await this.repo.getById(id);
    if (!current) return null;
    const prev = await popUndo(this.redis, id);
    if (!prev) return null; // nothing to undo
    // push current to redo
    await pushRedo(this.redis, id, toSnapshot(current));
    // update DB with previous snapshot
    const updated = await this.repo.update(id, { name: prev.name, type: prev.type, svg_data: prev.svg_data });
    return updated;
  }

  async redo(id: string): Promise<Diagram | null> {
    const current = await this.repo.getById(id);
    if (!current) return null;
    const next = await popRedo(this.redis, id);
    if (!next) return null; // nothing to redo
    // push current to undo
    await pushUndo(this.redis, id, toSnapshot(current));
    // update DB with next snapshot
    const updated = await this.repo.update(id, { name: next.name, type: next.type, svg_data: next.svg_data });
    return updated;
  }
}
