import { v4 as uuidv4 } from 'uuid';
import { DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput } from '../types.js';
import { DiagramBlockRepository } from '../repositories/diagramBlockRepository.js';
import { DiagramRepository } from '../repositories/diagramRepository.js';
import { DiagramHistoryService } from './diagramHistoryService.js';
import { DiagramTypeService } from './diagramTypeService.js';
import { HttpError } from '../middleware/errorHandler.js';

export class DiagramBlockService {
  private repo: DiagramBlockRepository;
  private diagramRepo: DiagramRepository;
  private historyService: DiagramHistoryService;
  private diagramTypeService: DiagramTypeService;

  constructor(
    repo: DiagramBlockRepository,
    diagramRepo: DiagramRepository,
    historyService: DiagramHistoryService,
    diagramTypeService: DiagramTypeService,
  ) {
    this.repo = repo;
    this.diagramRepo = diagramRepo;
    this.historyService = historyService;
    this.diagramTypeService = diagramTypeService;
  }

  async getByDiagramId(ownerUserId: string, diagramId: string): Promise<DiagramBlock[]> {
    return this.repo.getByDiagramIdForOwner(diagramId, ownerUserId);
  }

  async get(ownerUserId: string, id: string): Promise<DiagramBlock | null> {
    return this.repo.getByIdForOwner(id, ownerUserId);
  }

  async create(ownerUserId: string, input: DiagramBlockCreateInput): Promise<{ id: string }> {
    const diagram = await this.diagramRepo.getByIdForOwner(input.diagram_id, ownerUserId);
    if (!diagram) {
      throw new HttpError(404, 'Diagram not found');
    }

    const id = uuidv4();
    await this.repo.create(id, input);
    await this.diagramTypeService.recalculateRuleViolationsByDiagram(input.diagram_id);
    await this.historyService.recordSnapshot(input.diagram_id);
    return { id };
  }

  async update(ownerUserId: string, id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
    const block = await this.repo.getByIdForOwner(id, ownerUserId);
    if (!block) return null;

    const updated = await this.repo.update(id, input);
    if (updated) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(block.diagram_id);
      await this.historyService.recordSnapshot(block.diagram_id);
    }
    return updated;
  }

  async delete(ownerUserId: string, id: string): Promise<boolean> {
    const block = await this.repo.getByIdForOwner(id, ownerUserId);
    if (!block) return false;

    const ok = await this.repo.delete(id);
    if (ok) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(block.diagram_id);
      await this.historyService.recordSnapshot(block.diagram_id);
    }
    return ok;
  }
}
