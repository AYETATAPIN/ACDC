import {v4 as uuidv4} from 'uuid';
import {DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput} from '../types.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramBlockService {
    private repo: DiagramBlockRepository;
    private history: DiagramHistoryService;

    constructor(repo: DiagramBlockRepository, history: DiagramHistoryService) {
        this.repo = repo;
        this.history = history;
    }

    async getByDiagramId(diagramId: string): Promise<DiagramBlock[]> {
        return this.repo.getByDiagramId(diagramId);
    }

    async get(id: string): Promise<DiagramBlock | null> {
        return this.repo.getById(id);
    }

    async create(input: DiagramBlockCreateInput): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);
        await this.history.recordSnapshot(input.diagram_id);
        return {id};
    }

    async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
        const updated = await this.repo.update(id, input);
        if (updated) {
            await this.history.recordSnapshot(updated.diagram_id);
        }
        return updated;
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
