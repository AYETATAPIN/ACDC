import {v4 as uuidv4} from 'uuid';
import {DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput} from '../types.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';

export class DiagramBlockService {
    private repo: DiagramBlockRepository;

    constructor(repo: DiagramBlockRepository) {
        this.repo = repo;
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
        return {id};
    }

    async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
        const updated = await this.repo.update(id, input);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const ok = await this.repo.delete(id);
        return ok;
    }
}