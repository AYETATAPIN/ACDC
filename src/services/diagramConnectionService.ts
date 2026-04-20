import { v4 as uuidv4 } from 'uuid';
import { DiagramConnection, DiagramConnectionCreateInput, DiagramConnectionUpdateInput, Point } from '../types.js';
import { DiagramConnectionRepository } from '../repositories/diagramConnectionRepository.js';
import { DiagramBlockRepository } from '../repositories/diagramBlockRepository.js';
import { DiagramTypeService } from './diagramTypeService.js';
import { DiagramHistoryService } from './diagramHistoryService.js';

export class DiagramConnectionService {
  private repo: DiagramConnectionRepository;
  private blockRepo: DiagramBlockRepository;
  private diagramTypeService: DiagramTypeService;
  private historyService: DiagramHistoryService;

  constructor(
    repo: DiagramConnectionRepository,
    blockRepo: DiagramBlockRepository,
    diagramTypeService: DiagramTypeService,
    historyService: DiagramHistoryService,
  ) {
    this.repo = repo;
    this.blockRepo = blockRepo;
    this.diagramTypeService = diagramTypeService;
    this.historyService = historyService;
  }

  async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
    return this.repo.getByDiagramId(diagramId);
  }

  async getById(id: string): Promise<DiagramConnection | null> {
    return this.repo.getById(id);
  }

  async create(input: DiagramConnectionCreateInput): Promise<{ id: string }> {
    const fromBlock = await this.blockRepo.getById(input.from_block_id);
    const toBlock = await this.blockRepo.getById(input.to_block_id);

    if (!fromBlock || !toBlock || fromBlock.diagram_id !== input.diagram_id || toBlock.diagram_id !== input.diagram_id) {
      throw new Error('Blocks do not exist in the provided diagram');
    }

    await this.diagramTypeService.ensureConnectionAllowed(input.diagram_id, fromBlock.type, toBlock.type, input.type);

    const id = uuidv4();
    await this.repo.create(id, input);
    await this.diagramTypeService.recalculateRuleViolationsByDiagram(input.diagram_id);
    await this.historyService.recordSnapshot(input.diagram_id);
    return { id };
  }

  async update(id: string, input: DiagramConnectionUpdateInput): Promise<DiagramConnection | null> {
    const existing = await this.repo.getById(id);
    if (!existing) return null;

    const nextType = input.type ?? existing.type;
    const fromBlock = await this.blockRepo.getById(existing.from_block_id);
    const toBlock = await this.blockRepo.getById(existing.to_block_id);

    if (!fromBlock || !toBlock) {
      throw new Error('Connection blocks are missing');
    }

    await this.diagramTypeService.ensureConnectionAllowed(existing.diagram_id, fromBlock.type, toBlock.type, nextType);

    const updated = await this.repo.update(id, input);
    if (updated) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(existing.diagram_id);
      await this.historyService.recordSnapshot(existing.diagram_id);
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.repo.getById(id);
    if (!existing) return false;

    const ok = await this.repo.delete(id);
    if (ok) {
      await this.diagramTypeService.recalculateRuleViolationsByDiagram(existing.diagram_id);
      await this.historyService.recordSnapshot(existing.diagram_id);
    }
    return ok;
  }

  async addBendPoint(id: string, _position: string): Promise<DiagramConnection | null> {
    const connection = await this.repo.getById(id);
    if (!connection) return null;

    let points = connection.points as Point[];
    if (!points || points.length < 2) {
      points = [
        { x: 200, y: 160 },
        { x: 500, y: 160 },
      ];
    }

    const middlePoint = {
      x: Math.round((points[0].x + points[points.length - 1].x) / 2),
      y: Math.round((points[0].y + points[points.length - 1].y) / 2),
    };

    const newPoints = [points[0], middlePoint, ...points.slice(1)];
    const updated = await this.repo.update(id, { points: newPoints });
    if (updated) {
      await this.historyService.recordSnapshot(connection.diagram_id);
    }
    return updated;
  }
}
