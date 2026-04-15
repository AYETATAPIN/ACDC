import { v4 as uuidv4 } from 'uuid';
import { Diagram, DiagramCreateInput, DiagramKind, DiagramUpdateInput } from '../types.js';
import { DiagramRepository } from '../repositories/diagramRepository.js';
import { DiagramBlockRepository } from '../repositories/diagramBlockRepository.js';
import { DiagramConnectionRepository } from '../repositories/diagramConnectionRepository.js';
import { DiagramHistoryService } from './diagramHistoryService.js';
import { DiagramTypeRepository } from '../repositories/diagramTypeRepository.js';
import { getBuiltinDiagramTypeIdByKind } from '../catalog/builtins.js';

const LEGACY_TYPES: DiagramKind[] = ['class', 'use_case', 'activity_diagram', 'free_mode'];
const isLegacyType = (value: unknown): value is DiagramKind => typeof value === 'string' && LEGACY_TYPES.includes(value as DiagramKind);

export class DiagramService {
  private repo: DiagramRepository;
  private blockRepo: DiagramBlockRepository;
  private connectionRepo: DiagramConnectionRepository;
  private historyService: DiagramHistoryService;
  private diagramTypeRepo: DiagramTypeRepository;

  constructor(
    repo: DiagramRepository,
    blockRepo: DiagramBlockRepository,
    connectionRepo: DiagramConnectionRepository,
    historyService: DiagramHistoryService,
    diagramTypeRepo: DiagramTypeRepository,
  ) {
    this.repo = repo;
    this.blockRepo = blockRepo;
    this.connectionRepo = connectionRepo;
    this.historyService = historyService;
    this.diagramTypeRepo = diagramTypeRepo;
  }

  async list(): Promise<Diagram[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<Diagram | null> {
    return this.repo.getById(id);
  }

  private async resolveTypeAndDiagramTypeId(input: { type?: DiagramKind; diagram_type_id?: string }): Promise<{ type: DiagramKind; diagram_type_id: string }> {
    if (input.diagram_type_id) {
      const typeEntity = await this.diagramTypeRepo.getById(input.diagram_type_id);
      const derivedType = isLegacyType(typeEntity?.key) ? (typeEntity?.key as DiagramKind) : input.type ?? 'class';
      return {
        type: input.type ?? derivedType,
        diagram_type_id: input.diagram_type_id,
      };
    }

    const type = input.type ?? 'class';
    return {
      type,
      diagram_type_id: getBuiltinDiagramTypeIdByKind(type),
    };
  }

  async create(input: DiagramCreateInput & { elements?: any[]; connections?: any[] }): Promise<{ id: string }> {
    const id = uuidv4();
    const resolved = await this.resolveTypeAndDiagramTypeId(input);

    await this.repo.create(id, {
      ...input,
      type: resolved.type,
      diagram_type_id: resolved.diagram_type_id,
    });

    if (input.elements && Array.isArray(input.elements)) {
      for (const element of input.elements) {
        const blockId = element.id && typeof element.id === 'string' ? element.id : uuidv4();
        const elementProps = {
          text: element.text,
          ...(element.properties || {}),
        };
        if (element.fontSize !== undefined) elementProps.fontSize = element.fontSize;
        if (element.customColor !== undefined) elementProps.customColor = element.customColor;
        if (element.customBorder !== undefined) elementProps.customBorder = element.customBorder;

        await this.blockRepo.create(blockId, {
          diagram_id: id,
          element_type_id: element.element_type_id ?? null,
          type: element.type,
          x: Number(element.x) || 0,
          y: Number(element.y) || 0,
          width: Number(element.width) || 100,
          height: Number(element.height) || 60,
          properties: elementProps,
        });
      }

      if (input.connections && Array.isArray(input.connections)) {
        const blocks = await this.blockRepo.getByDiagramId(id);
        const blockIds = new Set(blocks.map((b) => b.id));

        for (const connection of input.connections) {
          if (!blockIds.has(connection.from) || !blockIds.has(connection.to)) continue;
          const connectionProps = {
            ...(connection.properties || {}),
          };
          if (connection.customColor !== undefined) connectionProps.customColor = connection.customColor;
          if (connection.customDash !== undefined) connectionProps.customDash = connection.customDash;
          if (connection.labelColor !== undefined) connectionProps.labelColor = connection.labelColor;
          if (connection.labelFontSize !== undefined) connectionProps.labelFontSize = connection.labelFontSize;

          await this.connectionRepo.create(uuidv4(), {
            diagram_id: id,
            from_block_id: connection.from,
            to_block_id: connection.to,
            connection_type_id: connection.connection_type_id ?? null,
            type: connection.type,
            label: connection.label,
            points: connection.points,
            properties: connectionProps,
          });
        }
      }
    }

    await this.diagramTypeRepo.recalculateRuleViolationsByDiagram(id);
    await this.historyService.recordSnapshot(id);
    return { id };
  }

  async update(id: string, input: DiagramUpdateInput & { elements?: any[]; connections?: any[] }): Promise<Diagram | null> {
    const existing = await this.repo.getById(id);
    if (!existing) return null;

    const resolved = await this.resolveTypeAndDiagramTypeId({
      type: input.type ?? existing.type,
      diagram_type_id: input.diagram_type_id ?? existing.diagram_type_id,
    });
    const shouldUpdateTypeBinding = input.type !== undefined || input.diagram_type_id !== undefined;

    const updated = await this.repo.update(id, {
      ...input,
      type: shouldUpdateTypeBinding ? resolved.type : undefined,
      diagram_type_id: shouldUpdateTypeBinding ? resolved.diagram_type_id : undefined,
    });
    if (!updated) return null;

    if (input.elements !== undefined) {
      await this.connectionRepo.deleteByDiagramId(id);
      await this.blockRepo.deleteByDiagramId(id);

      if (Array.isArray(input.elements)) {
        for (const element of input.elements) {
          const blockId = element.id && typeof element.id === 'string' ? element.id : uuidv4();
          const elementProps = {
            text: element.text,
            ...(element.properties || {}),
          };
          if (element.fontSize !== undefined) elementProps.fontSize = element.fontSize;
          if (element.customColor !== undefined) elementProps.customColor = element.customColor;
          if (element.customBorder !== undefined) elementProps.customBorder = element.customBorder;

          await this.blockRepo.create(blockId, {
            diagram_id: id,
            element_type_id: element.element_type_id ?? null,
            type: element.type,
            x: Number(element.x) || 0,
            y: Number(element.y) || 0,
            width: Number(element.width) || 100,
            height: Number(element.height) || 60,
            properties: elementProps,
          });
        }

        if (input.connections && Array.isArray(input.connections)) {
          const blocks = await this.blockRepo.getByDiagramId(id);
          const blockIds = new Set(blocks.map((b) => b.id));

          for (const connection of input.connections) {
            if (!blockIds.has(connection.from) || !blockIds.has(connection.to)) continue;
            const connectionProps = {
              ...(connection.properties || {}),
            };
            if (connection.customColor !== undefined) connectionProps.customColor = connection.customColor;
            if (connection.customDash !== undefined) connectionProps.customDash = connection.customDash;
            if (connection.labelColor !== undefined) connectionProps.labelColor = connection.labelColor;
            if (connection.labelFontSize !== undefined) connectionProps.labelFontSize = connection.labelFontSize;

            await this.connectionRepo.create(uuidv4(), {
              diagram_id: id,
              from_block_id: connection.from,
              to_block_id: connection.to,
              connection_type_id: connection.connection_type_id ?? null,
              type: connection.type,
              label: connection.label,
              points: connection.points,
              properties: connectionProps,
            });
          }
        }
      }
    }

    await this.diagramTypeRepo.recalculateRuleViolationsByDiagram(id);
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
