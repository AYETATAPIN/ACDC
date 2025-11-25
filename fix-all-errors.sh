#!/bin/bash

echo "=== Fixing All TypeScript Errors ==="

# 1. Добавляем недостающие типы в types.ts
echo "1. Adding missing types to types.ts..."
cat >> src/types.ts << 'TYPES'

export interface DiagramHistoryEntry {
    id: string;
    diagram_id: string;
    version: number;
    state: DiagramSnapshot;
    created_at: string;
}

export interface DiagramSnapshot {
    diagram: Diagram;
    blocks: DiagramBlock[];
    connections: DiagramConnection[];
}
TYPES

# 2. Создаем backup файлов
echo "2. Creating backups..."
cp src/services/diagramService.ts src/services/diagramService.ts.backup
cp src/services/diagramBlockService.ts src/services/diagramBlockService.ts.backup
cp src/services/diagramHistoryService.ts src/services/diagramHistoryService.ts.backup

# 3. Исправляем DiagramService
echo "3. Fixing DiagramService..."
cat > src/services/diagramService.ts << 'DIAGRAM_SERVICE'
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

    async create(input: DiagramCreateInput): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);
        await this.historyService.recordSnapshot(id);
        return {id};
    }

    async update(id: string, input: DiagramUpdateInput): Promise<Diagram | null> {
        const updated = await this.repo.update(id, input);
        if (updated) {
            await this.historyService.recordSnapshot(id);
        }
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        await this.connectionRepo.deleteByDiagramId(id);
        await this.blockRepo.deleteByDiagramId(id);
        const ok = await this.repo.delete(id);
        return ok;
    }
}
DIAGRAM_SERVICE

# 4. Исправляем DiagramBlockService
echo "4. Fixing DiagramBlockService..."
cat > src/services/diagramBlockService.ts << 'DIAGRAM_BLOCK_SERVICE'
import {v4 as uuidv4} from 'uuid';
import {DiagramBlock, DiagramBlockCreateInput, DiagramBlockUpdateInput} from '../types.js';
import {DiagramBlockRepository} from '../repositories/diagramBlockRepository.js';
import {DiagramHistoryService} from './diagramHistoryService.js';

export class DiagramBlockService {
    private repo: DiagramBlockRepository;
    private historyService: DiagramHistoryService;

    constructor(repo: DiagramBlockRepository, historyService: DiagramHistoryService) {
        this.repo = repo;
        this.historyService = historyService;
    }

    async getByDiagramId(diagramId: string): Promise<DiagramBlock[]> {
        return this.repo.getByDiagramId(diagramId);
    }

    async get(id: string): Promise<DiagramBlock | null> {
        return this.repo.getById(id);
    }

    async create(input: DiagramBlockCreateInput): Promise<{ id: string }> {
        const id = uuidv4();
        await this.repo.create(id, input);
        await this.historyService.recordSnapshot(input.diagram_id);
        return {id};
    }

    async update(id: string, input: DiagramBlockUpdateInput): Promise<DiagramBlock | null> {
        const block = await this.repo.getById(id);
        if (!block) return null;
        
        const updated = await this.repo.update(id, input);
        if (updated) {
            await this.historyService.recordSnapshot(block.diagram_id);
        }
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const block = await this.repo.getById(id);
        if (!block) return false;
        
        const ok = await this.repo.delete(id);
        if (ok) {
            await this.historyService.recordSnapshot(block.diagram_id);
        }
        return ok;
    }
}
DIAGRAM_BLOCK_SERVICE

# 5. Исправляем импорты в DiagramHistoryService
echo "5. Fixing DiagramHistoryService imports..."
sed -i 's/import {.*DiagramHistoryEntry.*}.*//' src/services/diagramHistoryService.ts
sed -i 's/import {.*DiagramSnapshot.*}.*//' src/services/diagramHistoryService.ts

# Добавляем правильные импорты после существующих
head -n 5 src/services/diagramHistoryService.ts > temp_file.ts
cat >> temp_file.ts << 'IMPORTS'
import type { DiagramHistoryEntry } from '../types.js';
import type { DiagramSnapshot } from '../types.js';
IMPORTS
tail -n +6 src/services/diagramHistoryService.ts >> temp_file.ts
mv temp_file.ts src/services/diagramHistoryService.ts

echo "=== All fixes applied ==="
echo "Now run: npm run build"
