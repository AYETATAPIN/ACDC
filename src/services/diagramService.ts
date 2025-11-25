import {v4 as uuidv4} from 'uuid';
import {Diagram, DiagramCreateInput, DiagramUpdateInput} from '../types.js';
import {DiagramRepository} from '../repositories/diagramRepository.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramConnectionRepository} from '../repositories/diagramConnectionRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramService {
    private repo: DiagramRepository;
    private blockRepo: DiagramBlockRepository;
    private connectionRepo: DiagramConnectionRepository;
    private historyService: DiagramHistoryService;

    constructor(
        repo: DiagramRepository,
        blockRepo: DiagramBlockRepository,
        connectionRepo: DiagramConnectionRepository,
        historyService: DiagramHistoryService
    ) {
        this.repo = repo;
        this.blockRepo = blockRepo;
        this.connectionRepo = connectionRepo;
        this.historyService = historyService;
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
        await this.historyService.recordSnapshot(id);
        return {id};
    }

    async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
        const updated = await this.repo.update(id, input);
        if (updated) {
            await this.historyService.recordSnapshot(id);
        }
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        await this.connectionRepo.deleteByDiagramId(id);
        await this.blockRepo.deleteByDiagramId(id);
        const ok = await this.repo.delete(id);
        return ok;
    }
}
