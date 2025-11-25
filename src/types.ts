export type DiagramType = 'class' | 'use_case' | 'free_mode';

export interface Diagram {
    id: string;
    name: string;
    type: DiagramType;
    svg_data: string;
    // current_version хранится в таблице, но не обязательно возвращается клиенту
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

// Новые типы для блоков и связей
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

export interface DiagramConnection {
    id: string;
    diagram_id: string;
    from_block_id: string;
    to_block_id: string;
    type: string;
    points: Array<{ x: number, y: number }>;
    label?: string;
    created_at: string;
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

export interface DiagramConnectionCreateInput {
  diagram_id: string;
  from_block_id: string;
  to_block_id: string;
  type: string;
  points?: Array<{x: number, y: number}>;
  label?: string;
}

export interface DiagramBlockUpdateInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, any>;
}
export interface DiagramConnectionUpdateInput {
  label?: string;
  points?: Array<{x: number, y: number}>;
}
export interface BendPointCreateInput {
  position: 'middle';
}
