import {Request, Response} from 'express';
import {DiagramHistoryService} from '../services/diagramHistoryService.js';

export class DiagramHistoryController {
    private service: DiagramHistoryService;

    constructor(service: DiagramHistoryService) {
        this.service = service;
    }

    history = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const result = await this.service.getHistory(diagramId);

        if (result.status === 'not_found') {
            return res.status(404).json({error: 'Diagram not found'});
        }

        return res.json({
            current_version: result.currentVersion,
            entries: result.entries,
        });
    };

    undo = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const result = await this.service.undo(diagramId);

        if (result.status === 'not_found') return res.status(404).json({error: 'Diagram not found'});
        if (result.status === 'no_history') return res.status(400).json({error: 'Undo history is empty'});

        return res.json({version: result.version, state: result.state});
    };

    redo = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const result = await this.service.redo(diagramId);

        if (result.status === 'not_found') return res.status(404).json({error: 'Diagram not found'});
        if (result.status === 'no_history') return res.status(400).json({error: 'Redo history is empty'});

        return res.json({version: result.version, state: result.state});
    };

    current = async (req: Request, res: Response) => {
        const {diagramId} = req.params;
        const result = await this.service.getCurrentState(diagramId);

        if (result.status === 'not_found') return res.status(404).json({error: 'Diagram not found'});
        if (result.status === 'no_history') return res.status(404).json({error: 'Diagram has no history yet'});

        return res.json({version: result.version, state: result.state});
    };
}
