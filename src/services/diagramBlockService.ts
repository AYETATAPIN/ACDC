import {v4 as uuidv4} from 'uuid';
import {DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput} from '../types.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramBlockService {
    private repo: DiagramBlockRepository;
    private historyService: DiagramHistoryService;

    constructor(repo: DiagramBlockRepository, historyService: DiagramHistoryService) {
        this.repo = repo;
        this.historyService = historyService;
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
        await this.historyService.recordSnapshot(input.diagram_id);
        return {id};
    }

    async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
        const block = await this.repo.getById(id);
        if (!block) return null;
        
        const updated = await this.repo.update(id, input);
        if (updated) {
            await this.historyService.recordSnapshot(block.diagram_id);
        }
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const block = await this.repo.getById(id);
        if (!block) return false;
        
        const ok = await this.repo.delete(id);
        if (ok) {
            await this.historyService.recordSnapshot(block.diagram_id);
        }
        return ok;
    }
}
