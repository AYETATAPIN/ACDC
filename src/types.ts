export type DiagramType = 'class' | 'use_case' | 'free_mode';

export type Point = {
    x: number;
    y: number;
};

export interface Diagram {
  id: string;
  name: string;
  type: DiagramType;
  svg_data: string;
  created_at: string;
  updated_at: string;
}

export interface DiagramCreateInput {
  name: string;
  type: DiagramType;
  svg_data: string;
}

export interface DiagramUpdateInput {
  name?: string;
  type?: DiagramType;
  svg_data?: string;
}

// Типы для блоков
export interface DiagramBlock {
  id: string;
  diagram_id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DiagramBlockCreateInput {
  diagram_id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, any>;
}

export interface DiagramBlockUpdateInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, any>;
}

// Типы для связей
export interface DiagramConnection {
    id: string;
    diagram_id: string;
    from_block_id: string;
    to_block_id: string;
    type: string;
    points: Point[]; // Только массив
    label?: string;
    created_at: string;
}

export interface DiagramConnectionCreateInput {
    diagram_id: string;
    from_block_id: string;
    to_block_id: string;
    type: string;
    points?: Point[]; // Только массив
    label?: string;
}


export interface DiagramConnectionUpdateInput {
    label?: string;
    points?: Point[]; // Только массив
}

export interface BendPointCreateInput {
  position: 'middle';
}

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