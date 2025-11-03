export type DiagramType = 'class' | 'use_case' | 'free_mode';

export interface Diagram {
  id: string;
  name: string;
  type: DiagramType;
  svg_data: string;
  created_at: string; // ISO string
  updated_at: string; // ISO string
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

