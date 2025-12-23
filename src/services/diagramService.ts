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
                const blockId = element.id && typeof element.id === 'string' ? element.id : uuidv4();
                const elementProps = {
                    text: element.text,
                    ...(element.properties || {})
                };
                if (element.fontSize !== undefined) elementProps.fontSize = element.fontSize;
                if (element.customColor !== undefined) elementProps.customColor = element.customColor;
                if (element.customBorder !== undefined) elementProps.customBorder = element.customBorder;
                await this.blockRepo.create(blockId, {
                    diagram_id: id,
                    type: element.type,
                    x: Number(element.x) || 0,
                    y: Number(element.y) || 0,
                    width: Number(element.width) || 100,
                    height: Number(element.height) || 60,
                    properties: elementProps
                });
            }

            if (input.connections && Array.isArray(input.connections)) {
                // Подготовим карту блоков для валидации
                const blocks = await this.blockRepo.getByDiagramId(id);
                const blockIds = new Set(blocks.map(b => b.id));

                for (const connection of input.connections) {
                    if (!blockIds.has(connection.from) || !blockIds.has(connection.to)) continue;
                    const connectionProps = {
                        ...(connection.properties || {})
                    };
                    if (connection.customColor !== undefined) connectionProps.customColor = connection.customColor;
                    if (connection.customDash !== undefined) connectionProps.customDash = connection.customDash;
                    if (connection.labelColor !== undefined) connectionProps.labelColor = connection.labelColor;
                    if (connection.labelFontSize !== undefined) connectionProps.labelFontSize = connection.labelFontSize;
                    await this.connectionRepo.create(uuidv4(), {
                        diagram_id: id,
                        from_block_id: connection.from,
                        to_block_id: connection.to,
                        type: connection.type,
                        label: connection.label,
                        points: connection.points,
                        properties: connectionProps
                    });
                }
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
                    const blockId = element.id && typeof element.id === 'string' ? element.id : uuidv4();
                    const elementProps = {
                        text: element.text,
                        ...(element.properties || {})
                    };
                    if (element.fontSize !== undefined) elementProps.fontSize = element.fontSize;
                    if (element.customColor !== undefined) elementProps.customColor = element.customColor;
                    if (element.customBorder !== undefined) elementProps.customBorder = element.customBorder;
                    await this.blockRepo.create(blockId, {
                        diagram_id: id,
                        type: element.type,
                        x: Number(element.x) || 0,
                        y: Number(element.y) || 0,
                        width: Number(element.width) || 100,
                        height: Number(element.height) || 60,
                        properties: elementProps
                    });
                }

                if (input.connections && Array.isArray(input.connections)) {
                    const blocks = await this.blockRepo.getByDiagramId(id);
                    const blockIds = new Set(blocks.map(b => b.id));

                    for (const connection of input.connections) {
                        if (!blockIds.has(connection.from) || !blockIds.has(connection.to)) continue;
                        const connectionProps = {
                            ...(connection.properties || {})
                        };
                        if (connection.customColor !== undefined) connectionProps.customColor = connection.customColor;
                        if (connection.customDash !== undefined) connectionProps.customDash = connection.customDash;
                        if (connection.labelColor !== undefined) connectionProps.labelColor = connection.labelColor;
                        if (connection.labelFontSize !== undefined) connectionProps.labelFontSize = connection.labelFontSize;
                        await this.connectionRepo.create(uuidv4(), {
                            diagram_id: id,
                            from_block_id: connection.from,
                            to_block_id: connection.to,
                            type: connection.type,
                            label: connection.label,
                            points: connection.points,
                            properties: connectionProps
                        });
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
