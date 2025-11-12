import { v4 as uuidv4 } from 'uuid';
import { Diagram, DiagramCreateInput, DiagramUpdateInput } from '../types.js';
import { DiagramRepository } from '../repositories/diagramRepository.js';

export class DiagramService {
  private repo: DiagramRepository;
  constructor(repo: DiagramRepository) { this.repo = repo; }

  async list(): Promise<Diagram[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<Diagram | null> { return this.repo.getById(id); }

  async create(input: DiagramCreateInput): Promise<{ id: string }> {
    const id = uuidv4();
    await this.repo.create(id, input);
    return { id };
  }

  async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
    const updated = await this.repo.update(id, input);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ok = await this.repo.delete(id);
    return ok;
  }
}
