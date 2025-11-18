// src/services/diagramConnectionService.ts
import { v4 as uuidv4 } from 'uuid';
import { DiagramConnection, DiagramConnectionCreateInput } from '../types.js';
import { DiagramConnectionRepository } from '../repositories/diagramConnectionRepository.js';

export class DiagramConnectionService {
  private repo: DiagramConnectionRepository;

  constructor(repo: DiagramConnectionRepository) { 
    this.repo = repo;
  }

  async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
    return this.repo.getByDiagramId(diagramId);
  }

  async create(input: DiagramConnectionCreateInput): Promise<{ id: string }> {
    const id = uuidv4();
    await this.repo.create(id, input);
    return { id };
  }

  async delete(id: string): Promise<boolean> {
    const ok = await this.repo.delete(id);
    return ok;
  }
}