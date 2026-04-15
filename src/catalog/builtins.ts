import type { DiagramKind } from '../types.js';

export const BUILTIN_DIAGRAM_TYPE_IDS = {
  class: '00000000-0000-0000-0000-000000000101',
  use_case: '00000000-0000-0000-0000-000000000102',
  activity_diagram: '00000000-0000-0000-0000-000000000103',
  free_mode: '00000000-0000-0000-0000-000000000104',
} as const;

export type BuiltinDiagramTypeKey = keyof typeof BUILTIN_DIAGRAM_TYPE_IDS;

export type BuiltinDiagramTypeConfig = {
  id: string;
  key: BuiltinDiagramTypeKey;
  name: string;
  description: string;
  is_free_mode: boolean;
  elements: string[];
  connections: string[];
};

export const BUILTIN_DIAGRAM_TYPES: BuiltinDiagramTypeConfig[] = [
  {
    id: BUILTIN_DIAGRAM_TYPE_IDS.class,
    key: 'class',
    name: 'Class Diagram',
    description: 'UML class diagram',
    is_free_mode: false,
    elements: ['class', 'interface', 'enum', 'component', 'database', 'package', 'note'],
    connections: ['association', 'dependency', 'inheritance', 'composition', 'realization', 'aggregation'],
  },
  {
    id: BUILTIN_DIAGRAM_TYPE_IDS.use_case,
    key: 'use_case',
    name: 'Use Case Diagram',
    description: 'UML use case diagram',
    is_free_mode: false,
    elements: ['actor', 'usecase', 'package', 'note'],
    connections: ['association', 'dependency', 'extend', 'include'],
  },
  {
    id: BUILTIN_DIAGRAM_TYPE_IDS.activity_diagram,
    key: 'activity_diagram',
    name: 'Activity Diagram',
    description: 'UML activity diagram',
    is_free_mode: false,
    elements: ['initial', 'final', 'activity', 'decision', 'merge', 'fork', 'join', 'send_signal', 'receive_signal'],
    connections: ['control_flow', 'object_flow'],
  },
  {
    id: BUILTIN_DIAGRAM_TYPE_IDS.free_mode,
    key: 'free_mode',
    name: 'Free Mode',
    description: 'No restrictions for blocks and connections',
    is_free_mode: true,
    elements: [
      'class',
      'interface',
      'enum',
      'component',
      'database',
      'package',
      'note',
      'actor',
      'usecase',
      'initial',
      'final',
      'activity',
      'decision',
      'merge',
      'fork',
      'join',
      'send_signal',
      'receive_signal',
    ],
    connections: [
      'association',
      'dependency',
      'inheritance',
      'composition',
      'realization',
      'aggregation',
      'extend',
      'include',
      'control_flow',
      'object_flow',
    ],
  },
];

export const LEGACY_KIND_BY_DIAGRAM_TYPE_KEY: Record<BuiltinDiagramTypeKey, DiagramKind> = {
  class: 'class',
  use_case: 'use_case',
  activity_diagram: 'activity_diagram',
  free_mode: 'free_mode',
};

export const getBuiltinDiagramTypeIdByKind = (kind: DiagramKind): string => {
  return BUILTIN_DIAGRAM_TYPE_IDS[kind as BuiltinDiagramTypeKey] ?? BUILTIN_DIAGRAM_TYPE_IDS.class;
};

const classLike = ['class', 'interface', 'enum', 'component', 'database'];
const structural = [...classLike, 'package', 'note'];

const isClassConnectionAllowed = (fromType: string, toType: string, connectionType: string): boolean => {
  if (!structural.includes(fromType) || !structural.includes(toType)) return false;
  if (fromType === 'note' || toType === 'note') {
    return ['association', 'dependency'].includes(connectionType);
  }
  if (fromType === 'package' || toType === 'package') {
    return true;
  }
  switch (connectionType) {
    case 'association':
    case 'dependency':
      return true;
    case 'inheritance':
    case 'composition':
    case 'aggregation':
      return classLike.includes(fromType) && classLike.includes(toType);
    case 'realization':
      return classLike.includes(fromType) && toType === 'interface';
    default:
      return false;
  }
};

const ucElements = ['actor', 'usecase', 'package', 'note'];

const isUseCaseConnectionAllowed = (fromType: string, toType: string, connectionType: string): boolean => {
  if (!ucElements.includes(fromType) || !ucElements.includes(toType)) return false;
  if (fromType === 'actor' && toType === 'actor') return false;
  if (fromType === 'note' || toType === 'note') {
    return ['association', 'dependency'].includes(connectionType);
  }
  if (connectionType === 'extend' || connectionType === 'include') {
    return fromType === 'usecase' && toType === 'usecase';
  }
  if (connectionType === 'association' || connectionType === 'dependency') {
    return true;
  }
  return false;
};

const activityElements = ['initial', 'final', 'activity', 'decision', 'merge', 'fork', 'join', 'send_signal', 'receive_signal'];

const isActivityConnectionAllowed = (fromType: string, toType: string, connectionType: string): boolean => {
  if (!activityElements.includes(fromType) || !activityElements.includes(toType)) return false;
  if (fromType === 'final') return false;
  return connectionType === 'control_flow' || connectionType === 'object_flow';
};

export const isBuiltinRuleAllowed = (
  diagramTypeKey: BuiltinDiagramTypeKey,
  fromType: string,
  toType: string,
  connectionType: string,
): boolean => {
  if (diagramTypeKey === 'free_mode') {
    return true;
  }
  if (diagramTypeKey === 'class') {
    return isClassConnectionAllowed(fromType, toType, connectionType);
  }
  if (diagramTypeKey === 'use_case') {
    return isUseCaseConnectionAllowed(fromType, toType, connectionType);
  }
  if (diagramTypeKey === 'activity_diagram') {
    return isActivityConnectionAllowed(fromType, toType, connectionType);
  }
  return false;
};
