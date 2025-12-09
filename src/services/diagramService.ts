import {v4 as uuidv4} from 'uuid';
import {Diagram, DiagramCreateInput, DiagramUpdateInput} from '../types.js';
import {DiagramRepository} from '../repositories/diagramRepository.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramConnectionRepository} from '../repositories/diagramConnectionRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramService {
    private repo: DiagramRepository;
    private blockRepo: DiagramBlockRepository;
    private connectionRepo: DiagramConnectionRepository;
    private historyService: DiagramHistoryService;

    constructor(
        repo: DiagramRepository,
        blockRepo: DiagramBlockRepository,
        connectionRepo: DiagramConnectionRepository,
        historyService: DiagramHistoryService
    ) {
        this.repo = repo;
        this.blockRepo = blockRepo;
        this.connectionRepo = connectionRepo;
        this.historyService = historyService;
    }

    async list(): Promise<Diagram[]> {
        return this.repo.list();
    }

    async get(id: string): Promise<Diagram | null> {
        return this.repo.getById(id);
    }

    async create(input: DiagramCreateInput & { elements?: any[], connections?: any[] }): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);

        // Если переданы элементы, создаем блоки
        if (input.elements && Array.isArray(input.elements)) {
            for (const element of input.elements) {
                await this.blockRepo.create(uuidv4(), {
                    diagram_id: id,
                    type: element.type,
                    x: element.x,
                    y: element.y,
                    width: element.width || 100,
                    height: element.height || 60,
                    properties: {
                        text: element.text,
                        ...element.properties
                    }
                });
            }
        }

        await this.historyService.recordSnapshot(id);
        return {id};
    }

    async update(id: string, input: DiagramUpdateInput & { elements?: any[], connections?: any[] }): Promise<Diagram | null> {
        // Сначала обновляем диаграмму
        const updated = await this.repo.update(id, input);
        if (!updated) return null;

        // Если переданы элементы, удаляем старые блоки и создаем новые
        if (input.elements !== undefined) {
            await this.connectionRepo.deleteByDiagramId(id);
            await this.blockRepo.deleteByDiagramId(id);

            if (Array.isArray(input.elements)) {
                for (const element of input.elements) {
                    await this.blockRepo.create(uuidv4(), {
                        diagram_id: id,
                        type: element.type,
                        x: element.x,
                        y: element.y,
                        width: element.width || 100,
                        height: element.height || 60,
                        properties: {
                            text: element.text,
                            ...element.properties
                        }
                    });
                }

                // Если есть связи, создаем их
                if (input.connections && Array.isArray(input.connections)) {
                    // Для этого нужно получить ID созданных блоков
                    const blocks = await this.blockRepo.getByDiagramId(id);

                    for (const connection of input.connections) {
                        // Находим блоки по координатам или другим свойствам
                        const fromBlock = blocks.find(b =>
                            Math.abs(b.x - connection.fromElement?.x) < 10 &&
                            Math.abs(b.y - connection.fromElement?.y) < 10
                        );

                        const toBlock = blocks.find(b =>
                            Math.abs(b.x - connection.toElement?.x) < 10 &&
                            Math.abs(b.y - connection.toElement?.y) < 10
                        );

                        if (fromBlock && toBlock) {
                            await this.connectionRepo.create(uuidv4(), {
                                diagram_id: id,
                                from_block_id: fromBlock.id,
                                to_block_id: toBlock.id,
                                type: connection.type,
                                label: connection.label,
                                points: connection.points
                            });
                        }
                    }
                }
            }
        }

        await this.historyService.recordSnapshot(id);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        await this.connectionRepo.deleteByDiagramId(id);
        await this.blockRepo.deleteByDiagramId(id);
        const ok = await this.repo.delete(id);
        return ok;
    }
}
