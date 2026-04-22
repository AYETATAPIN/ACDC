import { Request, Response } from 'express';
import { DiagramTypeService } from '../services/diagramTypeService.js';
import type { ArrowMarker, ConnectionRuleBulkUpdateInput, ConnectionTypeCreateInput, ElementTypeCreateInput } from '../types.js';

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

const isBulkMode = (value: unknown): value is ConnectionRuleBulkUpdateInput['mode'] =>
  value === 'row' || value === 'column' || value === 'connection_type';

const isArrowMarker = (value: unknown): value is ArrowMarker =>
  value === 'none' || value === 'arrow' || value === 'empty_arrow' || value === 'filled_diamond' || value === 'empty_diamond';

export class DiagramTypeController {
  private service: DiagramTypeService;

  constructor(service: DiagramTypeService) {
    this.service = service;
  }

  list = async (req: Request, res: Response) => {
    const items = await this.service.list(req.auth.userId!);
    res.json({ items });
  };

  get = async (req: Request, res: Response) => {
    const item = await this.service.get(req.auth.userId!, req.params.id);
    if (!item) return res.status(404).json({ error: 'Diagram type not found' });
    return res.json(item);
  };

  create = async (req: Request, res: Response) => {
    if (!isObject(req.body) || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const created = await this.service.create(req.auth.userId!, {
      key: typeof req.body.key === 'string' ? req.body.key : null,
      name: req.body.name.trim(),
      description: typeof req.body.description === 'string' ? req.body.description : null,
      is_free_mode: Boolean(req.body.is_free_mode),
      metadata: isObject(req.body.metadata) ? req.body.metadata : {},
    });

    return res.status(201).json(created);
  };

  update = async (req: Request, res: Response) => {
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });

    const updated = await this.service.update(req.auth.userId!, req.params.id, {
      key: typeof req.body.key === 'string' ? req.body.key : undefined,
      name: typeof req.body.name === 'string' ? req.body.name : undefined,
      description: typeof req.body.description === 'string' ? req.body.description : undefined,
      is_free_mode: typeof req.body.is_free_mode === 'boolean' ? req.body.is_free_mode : undefined,
      metadata: isObject(req.body.metadata) ? req.body.metadata : undefined,
    });

    if (!updated) return res.status(404).json({ error: 'Diagram type not found' });
    return res.json(updated);
  };

  remove = async (req: Request, res: Response) => {
    const ok = await this.service.remove(req.auth.userId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Diagram type not found or is built-in' });
    return res.json({ success: true });
  };

  clone = async (req: Request, res: Response) => {
    if (!isObject(req.body) || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const cloned = await this.service.clone(req.auth.userId!, req.params.id, req.body.name.trim());
    if (!cloned) return res.status(404).json({ error: 'Diagram type not found' });
    return res.status(201).json(cloned);
  };

  listElements = async (req: Request, res: Response) => {
    const items = await this.service.listElements(req.auth.userId!, req.params.id);
    return res.json({ items });
  };

  createElement = async (req: Request, res: Response) => {
    if (!isObject(req.body) || typeof req.body.key !== 'string' || typeof req.body.name !== 'string') {
      return res.status(400).json({ error: 'key and name are required' });
    }

    const payload: ElementTypeCreateInput = {
      key: req.body.key,
      name: req.body.name,
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

    const created = await this.service.createElement(req.auth.userId!, req.params.id, payload);
    return res.status(201).json(created);
  };

  updateElement = async (req: Request, res: Response) => {
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });
    const updated = await this.service.updateElement(req.auth.userId!, req.params.elementId, req.body);
    if (!updated) return res.status(404).json({ error: 'Element type not found' });
    return res.json(updated);
  };

  deleteElement = async (req: Request, res: Response) => {
    const ok = await this.service.deleteElement(req.auth.userId!, req.params.elementId);
    if (!ok) return res.status(404).json({ error: 'Element type not found or is built-in' });
    return res.json({ success: true });
  };

  listConnectionTypes = async (req: Request, res: Response) => {
    const items = await this.service.listConnectionTypes(req.auth.userId!, req.params.id);
    return res.json({ items });
  };

  createConnectionType = async (req: Request, res: Response) => {
    if (!isObject(req.body) || typeof req.body.key !== 'string' || typeof req.body.name !== 'string') {
      return res.status(400).json({ error: 'key and name are required' });
    }

    const payload: ConnectionTypeCreateInput = {
      key: req.body.key,
      name: req.body.name,
      color: typeof req.body.color === 'string' ? req.body.color : undefined,
      dash: typeof req.body.dash === 'string' ? req.body.dash : undefined,
      arrow_start: isArrowMarker(req.body.arrow_start) ? req.body.arrow_start : undefined,
      arrow_end: isArrowMarker(req.body.arrow_end) ? req.body.arrow_end : undefined,
      directed: typeof req.body.directed === 'boolean' ? req.body.directed : undefined,
      default_style: isObject(req.body.default_style) ? req.body.default_style : undefined,
      is_builtin: typeof req.body.is_builtin === 'boolean' ? req.body.is_builtin : undefined,
    };

    const created = await this.service.createConnectionType(req.auth.userId!, req.params.id, payload);
    return res.status(201).json(created);
  };

  updateConnectionType = async (req: Request, res: Response) => {
    if (!isObject(req.body)) return res.status(400).json({ error: 'Body must be an object' });
    const updated = await this.service.updateConnectionType(req.auth.userId!, req.params.connectionTypeId, req.body);
    if (!updated) return res.status(404).json({ error: 'Connection type not found' });
    return res.json(updated);
  };

  deleteConnectionType = async (req: Request, res: Response) => {
    const ok = await this.service.deleteConnectionType(req.auth.userId!, req.params.connectionTypeId);
    if (!ok) return res.status(404).json({ error: 'Connection type not found or is built-in' });
    return res.json({ success: true });
  };

  getRulesMatrix = async (req: Request, res: Response) => {
    const matrix = await this.service.getRulesMatrix(req.auth.userId!, req.params.id);
    return res.json(matrix);
  };

  updateRuleCell = async (req: Request, res: Response) => {
    if (
      !isObject(req.body) ||
      typeof req.body.from_element_type_id !== 'string' ||
      typeof req.body.to_element_type_id !== 'string' ||
      !Array.isArray(req.body.rules)
    ) {
      return res.status(400).json({ error: 'from_element_type_id, to_element_type_id and rules are required' });
    }

    await this.service.updateRuleCell(req.auth.userId!, req.params.id, {
      from_element_type_id: req.body.from_element_type_id,
      to_element_type_id: req.body.to_element_type_id,
      rules: req.body.rules,
    });
    return res.json({ success: true });
  };

  bulkUpdateRules = async (req: Request, res: Response) => {
    if (!isObject(req.body) || !isBulkMode(req.body.mode) || typeof req.body.target_id !== 'string') {
      return res.status(400).json({ error: 'mode and target_id are required' });
    }

    await this.service.bulkUpdateRules(req.auth.userId!, req.params.id, {
      mode: req.body.mode,
      target_id: req.body.target_id,
      connection_type_ids: Array.isArray(req.body.connection_type_ids) ? req.body.connection_type_ids : undefined,
      allowed: Boolean(req.body.allowed),
    });

    return res.json({ success: true });
  };
}
