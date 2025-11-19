import {v4 as uuidv4} from 'uuid';
import {Diagram, DiagramCreateInput, DiagramUpdateInput} from '../types.js';
import {DiagramRepository} from '../repositories/diagramRepository.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramConnectionRepository} from '../repositories/diagramConnectionRepository.js';

export class DiagramService {
    private repo: DiagramRepository;
    private blockRepo: DiagramBlockRepository;
    private connectionRepo: DiagramConnectionRepository;

    constructor(
        repo: DiagramRepository,
        blockRepo: DiagramBlockRepository,
        connectionRepo: DiagramConnectionRepository
    ) {
        this.repo = repo;
        this.blockRepo = blockRepo;
        this.connectionRepo = connectionRepo;
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
        return {id};
    }

    async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
        const updated = await this.repo.update(id, input);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        // Сначала удаляем связи и блоки, затем диаграмму
        await this.connectionRepo.deleteByDiagramId(id);
        await this.blockRepo.deleteByDiagramId(id);
        const ok = await this.repo.delete(id);
        return ok;
    }
}