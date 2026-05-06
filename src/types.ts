export type DiagramKind = 'class' | 'use_case' | 'free_mode' | 'activity_diagram';
export type DiagramType = DiagramKind;

export type ActivityNodeType =
  | 'initial'
  | 'final'
  | 'activity'
  | 'decision'
  | 'merge'
  | 'fork'
  | 'join'
  | 'send_signal'
  | 'receive_signal';

export type Point = {
  x: number;
  y: number;
};

export type ArrowMarker = 'none' | 'arrow' | 'empty_arrow' | 'filled_diamond' | 'empty_diamond';
export type CustomFieldType = 'text' | 'number' | 'select' | 'checkbox';

export interface AuthContext {
  userId: string | null;
  isAuthenticated: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  display_name?: string | null;
}

export interface AccessPolicy {
  canRead: boolean;
  canWrite: boolean;
  canShare: boolean;
}

export interface Diagram {
  id: string;
  name: string;
  type: DiagramKind;
  diagram_type_id: string;
  owner_user_id?: string | null;
  svg_data: string;
  created_at: string;
  updated_at: string;
}

export interface DiagramCreateInput {
  name: string;
  type?: DiagramKind;
  diagram_type_id?: string;
  svg_data: string;
}

export interface DiagramUpdateInput {
  name?: string;
  type?: DiagramKind;
  diagram_type_id?: string;
  svg_data?: string;
}

export interface DiagramBlock {
  id: string;
  diagram_id: string;
  element_type_id?: string | null;
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
  element_type_id?: string | null;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, any>;
}

export interface DiagramBlockUpdateInput {
  element_type_id?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, any>;
}

export interface DiagramConnection {
  id: string;
  diagram_id: string;
  from_block_id: string;
  to_block_id: string;
  connection_type_id?: string | null;
  type: string;
  points: Point[];
  label?: string;
  properties: Record<string, any>;
  rule_violation?: boolean;
  created_at: string;
}

export interface DiagramConnectionCreateInput {
  diagram_id: string;
  from_block_id: string;
  to_block_id: string;
  connection_type_id?: string | null;
  type: string;
  points?: Point[];
  label?: string;
  properties?: Record<string, any>;
}

export interface DiagramConnectionUpdateInput {
  connection_type_id?: string | null;
  type?: string;
  label?: string;
  points?: Point[];
  properties?: Record<string, any>;
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

export interface DiagramTypeBundle {
  diagram_type: DiagramTypeEntity;
  element_types: ElementTypeEntity[];
  connection_types: ConnectionTypeEntity[];
  rules_matrix: ConnectionRulesMatrix;
}

export interface AcdcDiagramFileV1 {
  format: 'acdc.diagram';
  version: 1;
  exported_at: string;
  diagram: Pick<Diagram, 'name' | 'type' | 'diagram_type_id' | 'svg_data'>;
  blocks: DiagramBlock[];
  connections: DiagramConnection[];
  diagram_type_bundle: DiagramTypeBundle;
}

export interface DiagramImportInput {
  mode: 'create' | 'replace';
  target_diagram_id?: string;
  file: AcdcDiagramFileV1;
}

export interface DiagramImportResult {
  id: string;
  mode: 'create' | 'replace';
  version: number;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareToken {
  id: string;
  diagram_id: string;
  mode: 'snapshot' | 'live';
  token_hash: string;
  snapshot_version?: number | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export interface DiagramTypeEntity {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  is_builtin: boolean;
  is_free_mode: boolean;
  clone_source_id: string | null;
  owner_user_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DiagramTypeCreateInput {
  key?: string | null;
  name: string;
  description?: string | null;
  is_builtin?: boolean;
  is_free_mode?: boolean;
  clone_source_id?: string | null;
  owner_user_id?: string | null;
  metadata?: Record<string, any>;
}

export interface DiagramTypeUpdateInput {
  key?: string | null;
  name?: string;
  description?: string | null;
  is_free_mode?: boolean;
  metadata?: Record<string, any>;
  owner_user_id?: string | null;
}

export interface ElementTypeFieldOption {
  label: string;
  value: string;
}

export interface ElementTypeFieldSchema {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  default?: string | number | boolean | null;
  visibleOnBlock?: boolean;
  options?: ElementTypeFieldOption[];
}

export interface ElementTypePort {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface ElementTypeEntity {
  id: string;
  diagram_type_id: string;
  key: string;
  name: string;
  shape: string;
  svg_path: string | null;
  default_style: Record<string, any>;
  default_size: { width: number; height: number };
  ports: ElementTypePort[];
  field_schema: ElementTypeFieldSchema[];
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ElementTypeCreateInput {
  key?: string | null;
  name: string;
  shape?: string;
  svg_path?: string | null;
  default_style?: Record<string, any>;
  default_size?: { width: number; height: number };
  ports?: ElementTypePort[];
  field_schema?: ElementTypeFieldSchema[];
  is_builtin?: boolean;
}

export interface ElementTypeUpdateInput {
  key?: string;
  name?: string;
  shape?: string;
  svg_path?: string | null;
  default_style?: Record<string, any>;
  default_size?: { width: number; height: number };
  ports?: ElementTypePort[];
  field_schema?: ElementTypeFieldSchema[];
}

export interface ConnectionTypeEntity {
  id: string;
  diagram_type_id: string;
  key: string;
  name: string;
  color: string;
  dash: string;
  arrow_start: ArrowMarker;
  arrow_end: ArrowMarker;
  directed: boolean;
  default_style: Record<string, any>;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTypeCreateInput {
  key?: string | null;
  name: string;
  color?: string;
  dash?: string;
  arrow_start?: ArrowMarker;
  arrow_end?: ArrowMarker;
  directed?: boolean;
  default_style?: Record<string, any>;
  is_builtin?: boolean;
}

export interface ConnectionTypeUpdateInput {
  key?: string;
  name?: string;
  color?: string;
  dash?: string;
  arrow_start?: ArrowMarker;
  arrow_end?: ArrowMarker;
  directed?: boolean;
  default_style?: Record<string, any>;
}

export interface ConnectionRuleEntity {
  id: string;
  diagram_type_id: string;
  from_element_type_id: string;
  to_element_type_id: string;
  connection_type_id: string;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRuleCellUpdateInput {
  from_element_type_id: string;
  to_element_type_id: string;
  rules: Array<{
    connection_type_id: string;
    allowed: boolean;
  }>;
}

export interface ConnectionRuleBulkUpdateInput {
  mode: 'row' | 'column' | 'connection_type';
  target_id: string;
  connection_type_ids?: string[];
  allowed: boolean;
}

export interface ConnectionRulesMatrix {
  elements: Array<Pick<ElementTypeEntity, 'id' | 'key' | 'name' | 'shape'>>;
  connection_types: Array<
    Pick<ConnectionTypeEntity, 'id' | 'key' | 'name' | 'color' | 'dash' | 'arrow_start' | 'arrow_end' | 'directed'>
  >;
  cells: Array<{
    from_element_type_id: string;
    to_element_type_id: string;
    rules: Array<{
      connection_type_id: string;
      allowed: boolean;
    }>;
  }>;
}
