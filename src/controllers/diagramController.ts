import {Request, Response} from 'express';
import {DiagramService} from '../services/diagramService.js';
import {DiagramImportService} from '../services/diagramImportService.js';
import {validateCreate, validateDiagramImport, validateUpdate} from '../utils/validators.js';

export class DiagramController {
    private service: DiagramService;
    private importService: DiagramImportService;

    constructor(service: DiagramService, importService: DiagramImportService) {
        this.service = service;
        this.importService = importService;
    }

    list = async (req: Request, res: Response) => {
        const items = await this.service.list(req.auth.userId!);
        res.json({items});
    };

    get = async (req: Request, res: Response) => {
        const {id} = req.params;
        const found = await this.service.get(req.auth.userId!, id);
        if (!found) return res.status(404).json({error: 'Diagram not found'});
        return res.json(found);
    };

    create = async (req: Request, res: Response) => {
        const parsed = validateCreate(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const result = await this.service.create(req.auth.userId!, parsed.data);
        return res.status(201).json(result);
    };

    importDiagram = async (req: Request, res: Response) => {
        const parsed = validateDiagramImport(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const result = await this.importService.importDiagram(req.auth.userId!, parsed.data);
        return res.status(201).json(result);
    };

    update = async (req: Request, res: Response) => {
        const {id} = req.params;
        const parsed = validateUpdate(req.body);
        if (!parsed.ok) return res.status(400).json({error: parsed.error});
        const updated = await this.service.update(req.auth.userId!, id, parsed.data);
        if (!updated) return res.status(404).json({error: 'Diagram not found'});
        return res.json(updated);
    };

    remove = async (req: Request, res: Response) => {
        const {id} = req.params;
        const ok = await this.service.delete(req.auth.userId!, id);
        if (!ok) return res.status(404).json({error: 'Diagram not found'});
        return res.status(200).json({success: true});
    };

    getTypeVersionStatus = async (req: Request, res: Response) => {
        const {id} = req.params;
        const status = await this.service.getTypeVersionStatus(req.auth.userId!, id);
        if (!status) return res.status(404).json({error: 'Diagram not found'});
        return res.json(status);
    };

    updateTypeVersion = async (req: Request, res: Response) => {
        const {id} = req.params;
        const result = await this.service.updateToLatestTypeVersion(req.auth.userId!, id);
        if (!result) return res.status(404).json({error: 'Diagram not found'});
        if (!result.success) {
            return res.status(409).json({
                error: 'Diagram cannot be upgraded to the latest diagram type version',
                current_version_number: result.current_version_number,
                latest_version_number: result.latest_version_number,
                issues: result.issues || [],
            });
        }
        return res.json(result);
    };
}
