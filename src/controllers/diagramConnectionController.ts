import { Request, Response } from 'express';
import { DiagramConnectionService } from '../services/diagramConnectionService.js';
import { 
  validateConnectionCreate, 
  validateConnectionUpdate, 
  validateBendPointCreate 
} from '../utils/validators.js';

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
    const { id } = req.params;
    const ok = await this.service.delete(id);
    if (!ok) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.status(200).json({ success: true });
  };
  update = async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = validateConnectionUpdate(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const updated = await this.service.update(id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Diagram connection not found' });
    return res.json(updated);
  };
  addBendPoint = async (req: Request, res: Response) => {
      const { id } = req.params;
      const parsed = validateBendPointCreate(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      
      const connection = await this.service.getById(id);
      if (!connection) return res.status(404).json({ error: 'Diagram connection not found' });
      
      let points = connection.points;
      
      if (!points || !Array.isArray(points) || points.length === 0) {
          // Создаем дефолтные точки на основе блоков
          points = [
              { x: 200, y: 160 },
              { x: 500, y: 160 }
          ];
      }
      
      // Вычисляем середину линии
      const middlePoint = {
          x: (points[0].x + points[1].x) / 2,
          y: (points[0].y + points[1].y) / 2
      };
      
      // Создаем новый массив точек с серединой
      const newPoints = [
          points[0],
          middlePoint,
          points[1]
      ];
      
      const updated = await this.service.update(id, { points: newPoints });
      return res.json(updated);
  };
}
