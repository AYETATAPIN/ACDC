import { v4 as uuidv4 } from 'uuid';
import { DiagramConnection, DiagramConnectionCreateInput, DiagramConnectionUpdateInput } from '../types.js';
import { DiagramConnectionRepository } from '../repositories/diagramConnectionRepository.js';

export class DiagramConnectionService {
    private repo: DiagramConnectionRepository;

    constructor(repo: DiagramConnectionRepository) {
        this.repo = repo;
    }

    async getByDiagramId(diagramId: string): Promise<DiagramConnection[]> {
        return this.repo.getByDiagramId(diagramId);
    }

    async getById(id: string): Promise<DiagramConnection | null> {
        return this.repo.getById(id);
    }

    async create(input: DiagramConnectionCreateInput): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);
        return { id };
    }

    async update(id: string, input: DiagramConnectionUpdateInput): Promise<DiagramConnection | null> {
        return this.repo.update(id, input);
    }

    async delete(id: string): Promise<boolean> {
        const ok = await this.repo.delete(id);
        return ok;
    }

    async addBendPoint(id: string, position: string): Promise<DiagramConnection | null> {
        const connection = await this.repo.getById(id);
        if (!connection) return null;

        let points = connection.points;
        
        if (!points || points.length < 2) {
            // Если точек нет или их меньше 2, создаем дефолтные
            points = [
                { x: 200, y: 160 },
                { x: 500, y: 160 }
            ];
        }

        // Вычисляем среднюю точку
        const middlePoint = {
            x: Math.round((points[0].x + points[points.length - 1].x) / 2),
            y: Math.round((points[0].y + points[points.length - 1].y) / 2)
        };

        // Вставляем среднюю точку в середину массива
        const newPoints = [
            points[0],
            middlePoint,
            ...points.slice(1)
        ];

        return this.repo.update(id, { points: newPoints });
    }
}