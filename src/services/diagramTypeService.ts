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
import { HttpError } from '../middleware/errorHandler.js';

export class DiagramTypeService {
  private repo: DiagramTypeRepository;

  constructor(repo: DiagramTypeRepository) {
    this.repo = repo;
  }

  private ensureReadable(type: DiagramTypeEntity | null, userId: string): DiagramTypeEntity | null {
    if (!type) return null;
    if (!type.is_builtin && type.owner_user_id !== userId) {
      throw new HttpError(403, 'No access to this diagram type');
    }
    return type;
  }

  private ensureMutable(type: DiagramTypeEntity | null, userId: string): DiagramTypeEntity | null {
    const readable = this.ensureReadable(type, userId);
    if (!readable) return null;
    if (readable.is_builtin) {
      throw new HttpError(403, 'Built-in diagram types cannot be modified');
    }
    return readable;
  }

  async list(userId: string): Promise<DiagramTypeEntity[]> {
    return this.repo.listAccessibleToUser(userId);
  }

  async get(userId: string, id: string): Promise<DiagramTypeEntity | null> {
    return this.repo.getAccessibleById(id, userId);
  }

  async create(userId: string, input: DiagramTypeCreateInput): Promise<DiagramTypeEntity> {
    return this.repo.create({
      ...input,
      is_builtin: false,
      owner_user_id: userId,
    });
  }

  async update(userId: string, id: string, input: DiagramTypeUpdateInput): Promise<DiagramTypeEntity | null> {
    const existing = this.ensureMutable(await this.repo.getById(id), userId);
    if (!existing) return null;
    return this.repo.update(id, input);
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const existing = this.ensureMutable(await this.repo.getById(id), userId);
    if (!existing) return false;
    return this.repo.delete(id);
  }

  async clone(userId: string, id: string, name: string): Promise<DiagramTypeEntity | null> {
    const existing = this.ensureReadable(await this.repo.getById(id), userId);
    if (!existing) return null;
    return this.repo.clone(id, name, userId);
  }

  async listElements(userId: string, diagramTypeId: string): Promise<ElementTypeEntity[]> {
    const type = this.ensureReadable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    return this.repo.listElements(diagramTypeId);
  }

  async createElement(userId: string, diagramTypeId: string, input: ElementTypeCreateInput): Promise<ElementTypeEntity> {
    const type = this.ensureMutable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    const created = await this.repo.createElement(diagramTypeId, {
      ...input,
      is_builtin: false,
    });
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
    return created;
  }

  async updateElement(userId: string, id: string, input: ElementTypeUpdateInput): Promise<ElementTypeEntity | null> {
    const existing = await this.repo.getElementById(id);
    if (!existing) return null;
    this.ensureMutable(await this.repo.getById(existing.diagram_type_id), userId);

    const updated = await this.repo.updateElement(id, input);
    if (updated) {
      await this.repo.recalculateRuleViolationsByDiagramType(updated.diagram_type_id);
    }
    return updated;
  }

  async deleteElement(userId: string, id: string): Promise<boolean> {
    const existing = await this.repo.getElementById(id);
    if (!existing) return false;
    this.ensureMutable(await this.repo.getById(existing.diagram_type_id), userId);

    const ok = await this.repo.deleteElement(id);
    if (ok && existing) {
      await this.repo.recalculateRuleViolationsByDiagramType(existing.diagram_type_id);
    }
    return ok;
  }

  async listConnectionTypes(userId: string, diagramTypeId: string): Promise<ConnectionTypeEntity[]> {
    const type = this.ensureReadable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    return this.repo.listConnectionTypes(diagramTypeId);
  }

  async createConnectionType(userId: string, diagramTypeId: string, input: ConnectionTypeCreateInput): Promise<ConnectionTypeEntity> {
    const type = this.ensureMutable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    const created = await this.repo.createConnectionType(diagramTypeId, {
      ...input,
      is_builtin: false,
    });
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
    return created;
  }

  async updateConnectionType(userId: string, id: string, input: ConnectionTypeUpdateInput): Promise<ConnectionTypeEntity | null> {
    const existing = await this.repo.getConnectionTypeById(id);
    if (!existing) return null;
    this.ensureMutable(await this.repo.getById(existing.diagram_type_id), userId);

    const updated = await this.repo.updateConnectionType(id, input);
    if (updated) {
      await this.repo.recalculateRuleViolationsByDiagramType(updated.diagram_type_id);
    }
    return updated;
  }

  async deleteConnectionType(userId: string, id: string): Promise<boolean> {
    const existing = await this.repo.getConnectionTypeById(id);
    if (!existing) return false;
    this.ensureMutable(await this.repo.getById(existing.diagram_type_id), userId);

    const ok = await this.repo.deleteConnectionType(id);
    if (ok && existing) {
      await this.repo.recalculateRuleViolationsByDiagramType(existing.diagram_type_id);
    }
    return ok;
  }

  async getRulesMatrix(userId: string, diagramTypeId: string): Promise<ConnectionRulesMatrix> {
    const type = this.ensureReadable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    return this.repo.getRulesMatrix(diagramTypeId);
  }

  async updateRuleCell(userId: string, diagramTypeId: string, input: ConnectionRuleCellUpdateInput): Promise<void> {
    const type = this.ensureMutable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
    await this.repo.updateRuleCell(diagramTypeId, input);
    await this.repo.recalculateRuleViolationsByDiagramType(diagramTypeId);
  }

  async bulkUpdateRules(userId: string, diagramTypeId: string, input: ConnectionRuleBulkUpdateInput): Promise<void> {
    const type = this.ensureMutable(await this.repo.getById(diagramTypeId), userId);
    if (!type) throw new HttpError(404, 'Diagram type not found');
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
