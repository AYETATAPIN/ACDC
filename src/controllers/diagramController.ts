import { Request, Response } from 'express';
import { DiagramService } from '../services/diagramService.js';
import { validateCreate, validateUpdate } from '../utils/validators.js';

export class DiagramController {
  private service: DiagramService;

  constructor(service: DiagramService) {
    this.service = service;
  }

  list = async (_req: Request, res: Response) => {
    const items = await this.service.list();
    res.json({ items });
  };

  get = async (req: Request, res: Response) => {
    const { id } = req.params;
    const found = await this.service.get(id);
    if (!found) return res.status(404).json({ error: 'Diagram not found' });
    return res.json(found);
  };

  create = async (req: Request, res: Response) => {
    const parsed = validateCreate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const result = await this.service.create(parsed.data);
    return res.status(201).json(result);
  };

  update = async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = validateUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const updated = await this.service.update(id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Diagram not found' });
    return res.json(updated);
  };

  remove = async (req: Request, res: Response) => {
    const { id } = req.params;
    const ok = await this.service.delete(id);
    if (!ok) return res.status(404).json({ error: 'Diagram not found' });
    return res.status(200).json({ success: true });
  };

  undo = async (req: Request, res: Response) => {
    const { id } = req.params;
    const d = await this.service.undo(id);
    if (!d) return res.status(409).json({ error: 'Nothing to undo or diagram not found' });
    return res.json(d);
  };

  redo = async (req: Request, res: Response) => {
    const { id } = req.params;
    const d = await this.service.redo(id);
    if (!d) return res.status(409).json({ error: 'Nothing to redo or diagram not found' });
    return res.json(d);
  };
}
