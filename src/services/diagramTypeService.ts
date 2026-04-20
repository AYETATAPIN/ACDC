import { DiagramTypeRepository } from '../repositories/diagramTypeRepository.js';
import type {
  ConnectionRuleBulkUpdateInput,
  ConnectionRuleCellUpdateInput,
  ConnectionRulesMatrix,
  ConnectionTypeCreateInput,
  ConnectionTypeEntity,
  ConnectionTypeUpdateInput,
  DiagramTypeCreateInput,
  DiagramTypeEntity,
  DiagramTypeUpdateInput,
  ElementTypeCreateInput,
  ElementTypeEntity,
  ElementTypeUpdateInput,
} from '../types.js';
import { ConnectionRuleViolationError } from '../errors/connectionRuleViolationError.js';

export class DiagramTypeService {
  private repo: DiagramTypeRepository;

  constructor(repo: DiagramTypeRepository) {
    this.repo = repo;
  }

  async list(): Promise<DiagramTypeEntity[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<DiagramTypeEntity | null> {
    return this.repo.getById(id);
  }

  async create(input: DiagramTypeCreateInput): Promise<DiagramTypeEntity> {
    return this.repo.create(input);
  }

  async update(id: string, input: DiagramTypeUpdateInput): Promise<DiagramTypeEntity | null> {
    return this.repo.update(id, input);
  }

  async remove(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async clone(id: string, name: string): Promise<DiagramTypeEntity | null> {
    return this.repo.clone(id, name);
  }

  async listElements(diagramTypeId: string): Promise<ElementTypeEntity[]> {
    return this.repo.listElements(diagramTypeId);
  }

  async createElement(diagramTypeId: string, input: ElementTypeCreateInput): Promise<ElementTypeEntity> {
    const created = await this.repo.createElement(diagramTypeId, input);
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
    return created;
  }

  async updateElement(id: string, input: ElementTypeUpdateInput): Promise<ElementTypeEntity | null> {
    const updated = await this.repo.updateElement(id, input);
    if (updated) {
      await this.repo.recalculateRuleViolationsByDiagramType(updated.diagram_type_id);
    }
    return updated;
  }

  async deleteElement(id: string): Promise<boolean> {
    const existing = await this.repo.updateElement(id, {});
    const ok = await this.repo.deleteElement(id);
    if (ok && existing) {
      await this.repo.recalculateRuleViolationsByDiagramType(existing.diagram_type_id);
    }
    return ok;
  }

  async listConnectionTypes(diagramTypeId: string): Promise<ConnectionTypeEntity[]> {
    return this.repo.listConnectionTypes(diagramTypeId);
  }

  async createConnectionType(diagramTypeId: string, input: ConnectionTypeCreateInput): Promise<ConnectionTypeEntity> {
    const created = await this.repo.createConnectionType(diagramTypeId, input);
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
    return created;
  }

  async updateConnectionType(id: string, input: ConnectionTypeUpdateInput): Promise<ConnectionTypeEntity | null> {
    const updated = await this.repo.updateConnectionType(id, input);
    if (updated) {
      await this.repo.recalculateRuleViolationsByDiagramType(updated.diagram_type_id);
    }
    return updated;
  }

  async deleteConnectionType(id: string): Promise<boolean> {
    const existing = await this.repo.updateConnectionType(id, {});
    const ok = await this.repo.deleteConnectionType(id);
    if (ok && existing) {
      await this.repo.recalculateRuleViolationsByDiagramType(existing.diagram_type_id);
    }
    return ok;
  }

  async getRulesMatrix(diagramTypeId: string): Promise<ConnectionRulesMatrix> {
    return this.repo.getRulesMatrix(diagramTypeId);
  }

  async updateRuleCell(diagramTypeId: string, input: ConnectionRuleCellUpdateInput): Promise<void> {
    await this.repo.updateRuleCell(diagramTypeId, input);
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
  }

  async bulkUpdateRules(diagramTypeId: string, input: ConnectionRuleBulkUpdateInput): Promise<void> {
    await this.repo.bulkUpdateRules(diagramTypeId, input);
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
  }

  async ensureConnectionAllowed(diagramId: string, fromType: string, toType: string, connectionType: string): Promise<void> {
    const diagramTypeId = await this.repo.getDiagramTypeIdForDiagram(diagramId);
    if (!diagramTypeId) {
      throw new ConnectionRuleViolationError({ from: fromType, to: toType, connection_type: connectionType });
    }

    const allowed = await this.repo.resolveRuleByKeys(diagramTypeId, fromType, toType, connectionType);
    if (!allowed) {
      throw new ConnectionRuleViolationError({ from: fromType, to: toType, connection_type: connectionType });
    }
  }

  async recalculateRuleViolationsByDiagram(diagramId: string): Promise<void> {
    await this.repo.recalculateRuleViolationsByDiagram(diagramId);
  }
}
