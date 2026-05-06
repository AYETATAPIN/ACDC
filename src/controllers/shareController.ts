import { Request, Response } from 'express';
import { ShareTokenService, isSharePermission } from '../services/shareTokenService.js';
import { DiagramService } from '../services/diagramService.js';
import { DiagramBlockService } from '../services/diagramBlockService.js';
import { DiagramConnectionService } from '../services/diagramConnectionService.js';
import { DiagramHistoryService } from '../services/diagramHistoryService.js';
import { DiagramTypeService } from '../services/diagramTypeService.js';
import {
  validateBendPointCreate,
  validateBlockCreate,
  validateBlockUpdate,
  validateConnectionCreate,
  validateConnectionUpdate,
  validateUpdate,
} from '../utils/validators.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ConnectionRuleViolationError } from '../errors/connectionRuleViolationError.js';
import type { ArrowMarker, ConnectionRuleBulkUpdateInput, ConnectionTypeCreateInput, ElementTypeCreateInput } from '../types.js';

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

const isBulkMode = (value: unknown): value is ConnectionRuleBulkUpdateInput['mode'] =>
  value === 'row' || value === 'column' || value === 'connection_type';

const isArrowMarker = (value: unknown): value is ArrowMarker =>
  value === 'none' || value === 'arrow' || value === 'empty_arrow' || value === 'filled_diamond' || value === 'empty_diamond';

export class ShareController {
  private shares: ShareTokenService;
  private diagrams: DiagramService;
  private blocks: DiagramBlockService;
  private connections: DiagramConnectionService;
  private history: DiagramHistoryService;
  private diagramTypes: DiagramTypeService;

  constructor(
    shares: ShareTokenService,
    diagrams: DiagramService,
    blocks: DiagramBlockService,
    connections: DiagramConnectionService,
    history: DiagramHistoryService,
    diagramTypes: DiagramTypeService,
  ) {
    this.shares = shares;
    this.diagrams = diagrams;
    this.blocks = blocks;
    this.connections = connections;
    this.history = history;
    this.diagramTypes = diagramTypes;
  }

  private origin(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }

  private authenticatedUserId(req: Request): string | null {
    return req.auth?.userId ?? null;
  }

  private async writeAccess(req: Request) {
    return this.shares.resolveWriteAccess(req.params.token, this.authenticatedUserId(req));
  }

  private async ensureElementTypeBelongs(ownerUserId: string, diagramTypeId: string, elementTypeId: string | null | undefined): Promise<void> {
    if (!elementTypeId) return;
    const elements = await this.diagramTypes.listElements(ownerUserId, diagramTypeId);
    if (!elements.some((item) => item.id === elementTypeId)) {
      throw new HttpError(403, 'Element type does not belong to the shared diagram type');
    }
  }

  private async ensureConnectionTypeBelongs(
    ownerUserId: string,
    diagramTypeId: string,
    connectionTypeId: string | null | undefined,
  ): Promise<void> {
    if (!connectionTypeId) return;
    const connectionTypes = await this.diagramTypes.listConnectionTypes(ownerUserId, diagramTypeId);
    if (!connectionTypes.some((item) => item.id === connectionTypeId)) {
      throw new HttpError(403, 'Connection type does not belong to the shared diagram type');
    }
  }

  private async ensureBulkSavePayloadBelongsToCurrentType(
    ownerUserId: string,
    diagramTypeId: string,
    input: {
      elements?: Array<{ element_type_id?: string | null }>;
      connections?: Array<{ connection_type_id?: string | null }>;
    },
  ): Promise<void> {
    const hasElementTypeIds = input.elements?.some((item) => item.element_type_id) ?? false;
    const hasConnectionTypeIds = input.connections?.some((item) => item.connection_type_id) ?? false;

    if (hasElementTypeIds) {
      const elements = await this.diagramTypes.listElements(ownerUserId, diagramTypeId);
      const elementIds = new Set(elements.map((item) => item.id));
      if (!input.elements?.every((item) => !item.element_type_id || elementIds.has(item.element_type_id))) {
        throw new HttpError(403, 'Element type does not belong to the shared diagram type');
      }
    }

    if (hasConnectionTypeIds) {
      const connectionTypes = await this.diagramTypes.listConnectionTypes(ownerUserId, diagramTypeId);
      const connectionTypeIds = new Set(connectionTypes.map((item) => item.id));
      if (!input.connections?.every((item) => !item.connection_type_id || connectionTypeIds.has(item.connection_type_id))) {
        throw new HttpError(403, 'Connection type does not belong to the shared diagram type');
      }
    }
  }

  private async ensureRulePayloadBelongsToCurrentType(
    ownerUserId: string,
    diagramTypeId: string,
    input: { from_element_type_id: string; to_element_type_id: string; rules: Array<{ connection_type_id: string }> },
  ): Promise<void> {
    const [elements, connectionTypes] = await Promise.all([
      this.diagramTypes.listElements(ownerUserId, diagramTypeId),
      this.diagramTypes.listConnectionTypes(ownerUserId, diagramTypeId),
    ]);
    const elementIds = new Set(elements.map((item) => item.id));
    const connectionTypeIds = new Set(connectionTypes.map((item) => item.id));

    if (!elementIds.has(input.from_element_type_id) || !elementIds.has(input.to_element_type_id)) {
      throw new HttpError(403, 'Rule elements must belong to the shared diagram type');
    }
    if (!input.rules.every((rule) => connectionTypeIds.has(rule.connection_type_id))) {
      throw new HttpError(403, 'Rule connection types must belong to the shared diagram type');
    }
  }

  private async ensureBulkRulePayloadBelongsToCurrentType(
    ownerUserId: string,
    diagramTypeId: string,
    input: { mode: ConnectionRuleBulkUpdateInput['mode']; target_id: string; connection_type_ids?: string[] },
  ): Promise<void> {
    const [elements, connectionTypes] = await Promise.all([
      this.diagramTypes.listElements(ownerUserId, diagramTypeId),
      this.diagramTypes.listConnectionTypes(ownerUserId, diagramTypeId),
    ]);
    const elementIds = new Set(elements.map((item) => item.id));
    const connectionTypeIds = new Set(connectionTypes.map((item) => item.id));

    if ((input.mode === 'row' || input.mode === 'column') && !elementIds.has(input.target_id)) {
      throw new HttpError(403, 'Rule target element must belong to the shared diagram type');
    }
    if (input.mode === 'connection_type' && !connectionTypeIds.has(input.target_id)) {
      throw new HttpError(403, 'Rule target connection type must belong to the shared diagram type');
    }
    if (input.connection_type_ids && !input.connection_type_ids.every((id) => connectionTypeIds.has(id))) {
      throw new HttpError(403, 'Rule connection types must belong to the shared diagram type');
    }
  }

  listOwnerShares = async (req: Request, res: Response) => {
    const result = await this.shares.listForOwner(req.auth.userId!, req.params.id);
    return res.json(result);
  };

  createOwnerShare = async (req: Request, res: Response) => {
    if (!isSharePermission(req.params.permission)) {
      return res.status(400).json({ error: 'permission must be read or edit' });
    }

    const result = await this.shares.createForOwner(req.auth.userId!, req.params.id, req.params.permission, this.origin(req));
    return res.status(result.token ? 201 : 200).json(result);
  };

  rotateOwnerShare = async (req: Request, res: Response) => {
    if (!isSharePermission(req.params.permission)) {
      return res.status(400).json({ error: 'permission must be read or edit' });
    }

    const result = await this.shares.rotateForOwner(req.auth.userId!, req.params.id, req.params.permission, this.origin(req));
    return res.status(201).json(result);
  };

  state = async (req: Request, res: Response) => {
    const result = await this.shares.getState(req.params.token, this.authenticatedUserId(req));
    return res.json(result);
  };

  updateDiagram = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const parsed = validateUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (parsed.data.diagram_type_id !== undefined && parsed.data.diagram_type_id !== access.diagram.diagram_type_id) {
      throw new HttpError(403, 'Share link cannot rebind diagram type');
    }
    await this.ensureBulkSavePayloadBelongsToCurrentType(access.ownerUserId, access.diagram.diagram_type_id, parsed.data);

    const updated = await this.diagrams.update(access.ownerUserId, access.diagram.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Diagram not found' });
    return res.json(updated);
  };

  createBlock = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const parsed = validateBlockCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (parsed.data.diagram_id !== access.diagram.id) {
      throw new HttpError(403, 'Share link cannot mutate another diagram');
    }
    await this.ensureElementTypeBelongs(access.ownerUserId, access.diagram.diagram_type_id, parsed.data.element_type_id);

    const result = await this.blocks.create(access.ownerUserId, parsed.data);
    return res.status(201).json(result);
  };

  updateBlock = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const existing = await this.blocks.get(access.ownerUserId, req.params.id);
    if (!existing || existing.diagram_id !== access.diagram.id) {
      return res.status(404).json({ error: 'Diagram block not found' });
    }

    const parsed = validateBlockUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    await this.ensureElementTypeBelongs(access.ownerUserId, access.diagram.diagram_type_id, parsed.data.element_type_id);

    const updated = await this.blocks.update(access.ownerUserId, req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Diagram block not found' });
    return res.json(updated);
  };

  deleteBlock = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const existing = await this.blocks.get(access.ownerUserId, req.params.id);
    if (!existing || existing.diagram_id !== access.diagram.id) {
      return res.status(404).json({ error: 'Diagram block not found' });
    }

    const ok = await this.blocks.delete(access.ownerUserId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Diagram block not found' });
    return res.json({ success: true });
  };

  createConnection = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const parsed = validateConnectionCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (parsed.data.diagram_id !== access.diagram.id) {
      throw new HttpError(403, 'Share link cannot mutate another diagram');
    }
    await this.ensureConnectionTypeBelongs(access.ownerUserId, access.diagram.diagram_type_id, parsed.data.connection_type_id);

    try {
      const result = await this.connections.create(access.ownerUserId, parsed.data);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof ConnectionRuleViolationError) {
        return res.status(409).json({ error: error.message, code: error.code, details: error.details });
      }
      throw error;
    }
  };

  updateConnection = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const existing = await this.connections.getById(access.ownerUserId, req.params.id);
    if (!existing || existing.diagram_id !== access.diagram.id) {
      return res.status(404).json({ error: 'Diagram connection not found' });
    }

    const parsed = validateConnectionUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    await this.ensureConnectionTypeBelongs(access.ownerUserId, access.diagram.diagram_type_id, parsed.data.connection_type_id);

    try {
      const updated = await this.connections.update(access.ownerUserId, req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Diagram connection not found' });
      return res.json(updated);
    } catch (error) {
      if (error instanceof ConnectionRuleViolationError) {
        return res.status(409).json({ error: error.message, code: error.code, details: error.details });
      }
      throw error;
    }
  };

  addBendPoint = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const existing = await this.connections.getById(access.ownerUserId, req.params.id);
    if (!existing || existing.diagram_id !== access.diagram.id) {
      return res.status(404).json({ error: 'Diagram connection not found' });
    }

    const parsed = validateBendPointCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const connection = await this.connections.addBendPoint(access.ownerUserId, req.params.id, parsed.data.position);
    if (!connection) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.json(connection);
  };

  deleteConnection = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const existing = await this.connections.getById(access.ownerUserId, req.params.id);
    if (!existing || existing.diagram_id !== access.diagram.id) {
      return res.status(404).json({ error: 'Diagram connection not found' });
    }

    const ok = await this.connections.delete(access.ownerUserId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.json({ success: true });
  };

  undo = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const result = await this.history.undo(access.ownerUserId, access.diagram.id);

    if (result.status === 'not_found') return res.status(404).json({ error: 'Diagram not found' });
    if (result.status === 'no_history') return res.status(400).json({ error: 'Undo history is empty' });

    return res.json({ version: result.version, state: result.state });
  };

  redo = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const result = await this.history.redo(access.ownerUserId, access.diagram.id);

    if (result.status === 'not_found') return res.status(404).json({ error: 'Diagram not found' });
    if (result.status === 'no_history') return res.status(400).json({ error: 'Redo history is empty' });

    return res.json({ version: result.version, state: result.state });
  };

  updateCurrentDiagramType = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });

    const updated = await this.diagramTypes.update(access.ownerUserId, access.diagram.diagram_type_id, {
      key: typeof req.body.key === 'string' ? req.body.key : undefined,
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      description: typeof req.body.description === 'string' ? req.body.description : undefined,
      is_free_mode: typeof req.body.is_free_mode === 'boolean' ? req.body.is_free_mode : undefined,
      metadata: isObject(req.body.metadata) ? req.body.metadata : undefined,
    });

    if (!updated) return res.status(404).json({ error: 'Diagram type not found' });
    return res.json(updated);
  };

  createElement = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body) || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const payload: ElementTypeCreateInput = {
      key: typeof req.body.key === 'string' ? req.body.key.trim() : undefined,
      name: req.body.name.trim(),
      shape: typeof req.body.shape === 'string' ? req.body.shape : undefined,
      svg_path: typeof req.body.svg_path === 'string' ? req.body.svg_path : undefined,
      default_style: isObject(req.body.default_style) ? req.body.default_style : undefined,
      default_size: isObject(req.body.default_size)
        ? { width: Number(req.body.default_size.width), height: Number(req.body.default_size.height) }
        : undefined,
      ports: Array.isArray(req.body.ports) ? req.body.ports : undefined,
      field_schema: Array.isArray(req.body.field_schema) ? req.body.field_schema : undefined,
      is_builtin: typeof req.body.is_builtin === 'boolean' ? req.body.is_builtin : undefined,
    };

    const created = await this.diagramTypes.createElement(access.ownerUserId, access.diagram.diagram_type_id, payload);
    return res.status(201).json(created);
  };

  updateElement = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });

    const elements = await this.diagramTypes.listElements(access.ownerUserId, access.diagram.diagram_type_id);
    if (!elements.some((item) => item.id === req.params.elementId)) {
      return res.status(404).json({ error: 'Element type not found' });
    }

    const updated = await this.diagramTypes.updateElement(access.ownerUserId, req.params.elementId, req.body);
    if (!updated) return res.status(404).json({ error: 'Element type not found' });
    return res.json(updated);
  };

  deleteElement = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const elements = await this.diagramTypes.listElements(access.ownerUserId, access.diagram.diagram_type_id);
    if (!elements.some((item) => item.id === req.params.elementId)) {
      return res.status(404).json({ error: 'Element type not found' });
    }

    const ok = await this.diagramTypes.deleteElement(access.ownerUserId, req.params.elementId);
    if (!ok) return res.status(404).json({ error: 'Element type not found or is built-in' });
    return res.json({ success: true });
  };

  createConnectionType = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body) || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const payload: ConnectionTypeCreateInput = {
      key: typeof req.body.key === 'string' ? req.body.key.trim() : undefined,
      name: req.body.name.trim(),
      color: typeof req.body.color === 'string' ? req.body.color : undefined,
      dash: typeof req.body.dash === 'string' ? req.body.dash : undefined,
      arrow_start: isArrowMarker(req.body.arrow_start) ? req.body.arrow_start : undefined,
      arrow_end: isArrowMarker(req.body.arrow_end) ? req.body.arrow_end : undefined,
      directed: typeof req.body.directed === 'boolean' ? req.body.directed : undefined,
      default_style: isObject(req.body.default_style) ? req.body.default_style : undefined,
      is_builtin: typeof req.body.is_builtin === 'boolean' ? req.body.is_builtin : undefined,
    };

    const created = await this.diagramTypes.createConnectionType(access.ownerUserId, access.diagram.diagram_type_id, payload);
    return res.status(201).json(created);
  };

  updateConnectionType = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });

    const connectionTypes = await this.diagramTypes.listConnectionTypes(access.ownerUserId, access.diagram.diagram_type_id);
    if (!connectionTypes.some((item) => item.id === req.params.connectionTypeId)) {
      return res.status(404).json({ error: 'Connection type not found' });
    }

    const updated = await this.diagramTypes.updateConnectionType(access.ownerUserId, req.params.connectionTypeId, req.body);
    if (!updated) return res.status(404).json({ error: 'Connection type not found' });
    return res.json(updated);
  };

  deleteConnectionType = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    const connectionTypes = await this.diagramTypes.listConnectionTypes(access.ownerUserId, access.diagram.diagram_type_id);
    if (!connectionTypes.some((item) => item.id === req.params.connectionTypeId)) {
      return res.status(404).json({ error: 'Connection type not found' });
    }

    const ok = await this.diagramTypes.deleteConnectionType(access.ownerUserId, req.params.connectionTypeId);
    if (!ok) return res.status(404).json({ error: 'Connection type not found or is built-in' });
    return res.json({ success: true });
  };

  updateRuleCell = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (
      !isObject(req.body) ||
      typeof req.body.from_element_type_id !== 'string' ||
      typeof req.body.to_element_type_id !== 'string' ||
      !Array.isArray(req.body.rules)
    ) {
      return res.status(400).json({ error: 'from_element_type_id, to_element_type_id and rules are required' });
    }

    const payload = {
      from_element_type_id: req.body.from_element_type_id,
      to_element_type_id: req.body.to_element_type_id,
      rules: req.body.rules,
    };

    await this.ensureRulePayloadBelongsToCurrentType(access.ownerUserId, access.diagram.diagram_type_id, payload);
    await this.diagramTypes.updateRuleCell(access.ownerUserId, access.diagram.diagram_type_id, payload);
    return res.json({ success: true });
  };

  bulkUpdateRules = async (req: Request, res: Response) => {
    const access = await this.writeAccess(req);
    if (!isObject(req.body) || !isBulkMode(req.body.mode) || typeof req.body.target_id !== 'string') {
      return res.status(400).json({ error: 'mode and target_id are required' });
    }

    const payload = {
      mode: req.body.mode,
      target_id: req.body.target_id,
      connection_type_ids: Array.isArray(req.body.connection_type_ids) ? req.body.connection_type_ids : undefined,
      allowed: Boolean(req.body.allowed),
    };

    await this.ensureBulkRulePayloadBelongsToCurrentType(access.ownerUserId, access.diagram.diagram_type_id, payload);
    await this.diagramTypes.bulkUpdateRules(access.ownerUserId, access.diagram.diagram_type_id, payload);

    return res.json({ success: true });
  };
}
