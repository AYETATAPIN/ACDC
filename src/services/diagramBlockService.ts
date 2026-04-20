import { v4 as uuidv4 } from 'uuid';
import { DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput } from '../types.js';
import { DiagramBlockRepository } from '../repositories/diagramBlockRepository.js';
import { DiagramHistoryService } from './diagramHistoryService.js';
import { DiagramTypeService } from './diagramTypeService.js';

export class DiagramBlockService {
  private repo: DiagramBlockRepository;
  private historyService: DiagramHistoryService;
  private diagramTypeService: DiagramTypeService;

  constructor(repo: DiagramBlockRepository, historyService: DiagramHistoryService, diagramTypeService: DiagramTypeService) {
    this.repo = repo;
    this.historyService = historyService;
    this.diagramTypeService = diagramTypeService;
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
    await this.diagramTypeService.recalculateRuleViolationsByDiagram(input.diagram_id);
    await this.historyService.recordSnapshot(input.diagram_id);
    return { id };
  }

  async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
    const block = await this.repo.getById(id);
    if (!block) return null;

    const updated = await this.repo.update(id, input);
    if (updated) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(block.diagram_id);
      await this.historyService.recordSnapshot(block.diagram_id);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const block = await this.repo.getById(id);
    if (!block) return false;

    const ok = await this.repo.delete(id);
    if (ok) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(block.diagram_id);
      await this.historyService.recordSnapshot(block.diagram_id);
    }
    return ok;
  }
}
