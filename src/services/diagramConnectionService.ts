// src/services/diagramConnectionService.ts
import {v4 as uuidv4} from 'uuid';
import {DiagramConnection, DiagramConnectionCreateInput} from '../types.js';
import {DiagramConnectionRepository} from '../repositories/diagramConnectionRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramConnectionService {
    private repo: DiagramConnectionRepository;
    private history: DiagramHistoryService;

    constructor(repo: DiagramConnectionRepository, history: DiagramHistoryService) {
        this.repo = repo;
        this.history = history;
    }

    async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
        return this.repo.getByDiagramId(diagramId);
    }

    async create(input: DiagramConnectionCreateInput): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);
        await this.history.recordSnapshot(input.diagram_id);
        return {id};
    }

    async delete(id: string): Promise<boolean> {
        const existing = await this.repo.getById(id);
        if (!existing) return false;
        const ok = await this.repo.delete(id);
        if (ok) {
            await this.history.recordSnapshot(existing.diagram_id);
        }
        return ok;
    }
}
