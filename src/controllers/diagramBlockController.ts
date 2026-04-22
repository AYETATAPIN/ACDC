// src/controllers/diagramBlockController.ts
import {Request, Response} from 'express';
import {DiagramBlockService} from '../services/diagramBlockService.js';
import {validateBlockCreate, validateBlockUpdate} from '../utils/validators.js';

export class DiagramBlockController {
    private service: DiagramBlockService;

    constructor(service: DiagramBlockService) {
        this.service = service;
    }

    getByDiagramId = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const items = await this.service.getByDiagramId(req.auth.userId!, diagramId);
        res.json({items});
    };

    get = async (req: Request, res: Response) => {
        const {id} = req.params;
        const found = await this.service.get(req.auth.userId!, id);
        if (!found) return res.status(404).json({error: 'Diagram block not found'});
        return res.json(found);
    };

    create = async (req: Request, res: Response) => {
        const parsed = validateBlockCreate(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const result = await this.service.create(req.auth.userId!, parsed.data);
        return res.status(201).json(result);
    };

    update = async (req: Request, res: Response) => {
        const {id} = req.params;
        const parsed = validateBlockUpdate(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const updated = await this.service.update(req.auth.userId!, id, parsed.data);
        if (!updated) return res.status(404).json({error: 'Diagram block not found'});
        return res.json(updated);
    };

    remove = async (req: Request, res: Response) => {
        const {id} = req.params;
        const ok = await this.service.delete(req.auth.userId!, id);
        if (!ok) return res.status(404).json({error: 'Diagram block not found'});
        return res.status(200).json({success: true});
    };
}
