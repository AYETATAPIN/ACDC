import { Request, Response } from 'express';
import { DiagramConnectionService } from '../services/diagramConnectionService.js';
import { validateConnectionCreate, validateConnectionUpdate, validateBendPointCreate } from '../utils/validators.js';
import { ConnectionRuleViolationError } from '../errors/connectionRuleViolationError.js';

export class DiagramConnectionController {
  private service: DiagramConnectionService;

  constructor(service: DiagramConnectionService) {
    this.service = service;
  }

  getByDiagramId = async (req: Request, res: Response) => {
    const { diagramId } = req.params;
    const items = await this.service.getByDiagramId(diagramId);
    res.json({ items });
  };

  create = async (req: Request, res: Response) => {
    const parsed = validateConnectionCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
      const result = await this.service.create(parsed.data);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof ConnectionRuleViolationError) {
        return res.status(409).json({ error: error.message, code: error.code, details: error.details });
      }
      throw error;
    }
  };

  remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    const ok = await this.service.delete(id);
    if (!ok) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.status(200).json({ success: true });
  };

  update = async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = validateConnectionUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
      const updated = await this.service.update(id, parsed.data);
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
    const { id } = req.params;
    const parsed = validateBendPointCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const connection = await this.service.addBendPoint(id, parsed.data.position);
    if (!connection) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.json(connection);
  };
}
