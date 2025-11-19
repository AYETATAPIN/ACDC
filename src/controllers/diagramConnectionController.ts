import {Request, Response} from 'express';
import {DiagramConnectionService} from '../services/diagramConnectionService.js';
import {validateConnectionCreate} from '../utils/validators.js';

export class DiagramConnectionController {
    private service: DiagramConnectionService;

    constructor(service: DiagramConnectionService) {
        this.service = service;
    }

    getByDiagramId = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const items = await this.service.getByDiagramId(diagramId);
        res.json({items});
    };

    create = async (req: Request, res: Response) => {
        const parsed = validateConnectionCreate(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const result = await this.service.create(parsed.data);
        return res.status(201).json(result);
    };

    remove = async (req: Request, res: Response) => {
        const {id} = req.params;
        const ok = await this.service.delete(id);
        if (!ok) return res.status(404).json({error: 'Diagram connection not found'});
        return res.status(200).json({success: true});
    };
}