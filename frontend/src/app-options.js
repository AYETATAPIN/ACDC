import { diagramTypesService } from './services/index.js';
import { normalizeRulesMatrix } from './rules/connectionRules.js';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import AuthGate from './components/AuthGate.vue';
import DiagramHeader from './components/DiagramHeader.vue';
import DiagramToolbar from './components/DiagramToolbar.vue';
import DiagramPropertiesPanel from './components/DiagramPropertiesPanel.vue';
import DiagramHistoryPanel from './components/DiagramHistoryPanel.vue';
import DiagramRulesTypesDialog from './components/DiagramRulesTypesDialog.vue';
import ShareDialog from './components/ShareDialog.vue';
import { appMethods } from './app-methods.js';

const ownerAccessPolicy = () => ({
  mode: 'owner',
  permission: 'owner',
  canRead: true,
  canWrite: true,
  canShare: true,
  canDelete: true,
  canReplaceImport: true,
  requiresLogin: false,
});

export default {
  name: 'App',
  components: {
    AuthGate,
    DiagramHeader,
    DiagramToolbar,
    DiagramPropertiesPanel,
    DiagramHistoryPanel,
    DiagramRulesTypesDialog,
    ShareDialog,
    Dialog,
    InputText,
    Button
  },
  data() {
    return {
      lastSavedState: null,
      hasUnsavedChanges: false,
      authReady: false,
      authLoading: false,
      authMode: 'login',
      authUser: null,
      authError: null,
      shareToken: null,
      shareLoginRequired: false,
      shareLoadError: null,
      shareDialogVisible: false,
      accessPolicy: ownerAccessPolicy(),
      authForm: {
        email: '',
        password: '',
        display_name: '',
      },
      themeMode: 'light',
      snapToGrid: true,
      gridSize: 10,
      elementPresets: [
        // РРЅСЃС‚СЂСѓРјРµРЅС‚С‹ (РІСЃРµРіРґР° РґРѕСЃС‚СѓРїРЅС‹)
        { type: 'select', label: 'Select/Move', shape: 'вћЎпёЏ', diagrams: ['class', 'use_case', 'activity_diagram', 'free_mode'] },
        { type: 'delete', label: 'Delete', shape: 'рџ—‘пёЏ', diagrams: ['class', 'use_case', 'activity_diagram', 'free_mode'] },
        
        // Class Diagram СЌР»РµРјРµРЅС‚С‹
        { type: 'class', label: 'Class', shape: 'rect', color: '#3498db', border: '#2d83be', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'interface', label: 'Interface', shape: 'rect', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'enum', label: 'Enum', shape: 'rect', color: '#e67e22', border: '#d35400', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'component', label: 'Component', shape: 'rect', color: '#16a085', border: '#13856f', textColor: '#ffffff', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'database', label: 'Database', shape: 'cylinder', color: '#34495e', border: '#2c3e50', textColor: '#ecf0f1', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'note', label: 'Note', shape: 'rect', color: '#fff7d6', border: '#f1c40f', textColor: '#2c3e50', width: 160, height: 100, diagrams: ['class', 'use_case', 'free_mode'], dashed: true },
        { type: 'package', label: 'Package', shape: 'rect', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 180, height: 100, diagrams: ['class', 'use_case', 'free_mode'] },
        
        // Use Case Diagram СЌР»РµРјРµРЅС‚С‹
        { type: 'actor', label: 'Actor', shape: 'actor', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 60, height: 100, diagrams: ['use_case', 'free_mode'] },
        { type: 'usecase', label: 'Use Case', shape: 'ellipse', color: '#f97316', border: '#ea580c', textColor: '#ffffff', width: 160, height: 90, diagrams: ['use_case', 'free_mode'] },
        
        // Activity Diagram СЌР»РµРјРµРЅС‚С‹
        { type: 'initial', label: 'Initial', shape: 'circle', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 40, height: 40, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'final', label: 'Final', shape: 'double-circle', color: '#e74c3c', border: '#c0392b', textColor: '#ffffff', width: 40, height: 40, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'activity', label: 'Activity', shape: 'roundrect', color: '#3498db', border: '#2980b9', textColor: '#ffffff', width: 120, height: 60, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'decision', label: 'Decision', shape: 'diamond', color: '#f39c12', border: '#d68910', textColor: '#ffffff', width: 80, height: 80, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'merge', label: 'Merge', shape: 'diamond', color: '#95a5a6', border: '#7f8c8d', textColor: '#ffffff', width: 80, height: 80, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'fork', label: 'Fork', shape: 'rect', color: '#2c3e50', border: '#2c3e50', textColor: '#ffffff', width: 100, height: 40, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'join', label: 'Join', shape: 'rect', color: '#2c3e50', border: '#2c3e50', textColor: '#ffffff', width: 100, height: 40, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'send_signal', label: 'Send Signal', shape: 'pentagon', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 100, height: 60, diagrams: ['activity_diagram', 'free_mode'] },
        { type: 'receive_signal', label: 'Receive Signal', shape: 'pentagon', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 100, height: 60, diagrams: ['activity_diagram', 'free_mode'] },
      ],
      connectionPresets: [
        // Shared
        { type: 'association', label: 'Association', color: '#34495e', diagrams: ['class', 'use_case', 'free_mode'], dash: '' },
        { type: 'dependency', label: 'Dependency', color: '#7f8c8d', diagrams: ['class', 'use_case', 'free_mode'], dash: '6 4' },

        // Class diagrams
        { type: 'inheritance', label: 'Inheritance', color: '#8e44ad', diagrams: ['class', 'free_mode'], dash: '10 6' },
        { type: 'composition', label: 'Composition', color: '#27ae60', diagrams: ['class', 'free_mode'], dash: '' },
        { type: 'realization', label: 'Realization', color: '#9b59b6', diagrams: ['class', 'free_mode'], dash: '10 6' },
        { type: 'aggregation', label: 'Aggregation', color: '#e67e22', diagrams: ['class', 'free_mode'], dash: '' },

        // Use Case diagrams
        { type: 'extend', label: 'Extend', color: '#c0392b', diagrams: ['use_case', 'free_mode'], dash: '4 4' },
        { type: 'include', label: 'Include', color: '#3498db', diagrams: ['use_case', 'free_mode'], dash: '4 4' },

        // Activity diagrams
        { type: 'control_flow', label: 'Control Flow', color: '#2c3e50', diagrams: ['activity_diagram', 'free_mode'], dash: '' },
        { type: 'object_flow', label: 'Object Flow', color: '#e67e22', diagrams: ['activity_diagram', 'free_mode'], dash: '6 4' },
      ],
      diagramName: '',
      diagramType: 'class',
      currentDiagramTypeId: null,
      currentDiagramTypeEntity: null,
      diagramTypesCatalog: [],
      customElementTypes: [],
      customConnectionTypes: [],
      rulesMatrix: normalizeRulesMatrix(null),
      diagramTypeVersionStatus: null,
      typeVersionUpdateIssues: [],
      isUpdatingTypeVersion: false,
      showRulesDialog: false,
      currentTool: 'select',
      selectedConnection: null,
      editingConnectionLabel: null,
      elements: [],
      connections: [],
      selectedElement: null,
      expandedElementLists: {},
      zoom: 1,
      currentDiagramId: null,
      diagrams: [],
      historyEntries: [],
      currentVersion: 0,
      historyCollapsed: false,
      connectionStart: null,
      isConnecting: false,
      tempConnection: null,
      dragElement: null,
      dragOffset: { x: 0, y: 0 },
      isDragging: false,
      errorMessage: null,
      isLoading: false,
      isLoadingList: false,
      selectedDiagramId: null,
      resizingElement: null,
      resizeStart: { x: 0, y: 0, width: 0, height: 0 },
      canvasHeight: 1000,
      canvasWidth: 2400,
      pan: { x: 0, y: 0 },
      isPanning: false,
      panStart: { x: 0, y: 0 },
      pointerStart: { x: 0, y: 0 },

      // Bend point drag
      draggingBendPoint: { connId: null, pointIndex: null },
      draggingEndpoint: { connId: null, which: null },
      bendPointDragOffset: { x: 0, y: 0 },
      bendPointPress: {
        connId: null,
        pointIndex: null,
        startClientX: 0,
        startClientY: 0,
        moved: false,
      },
      selectedBendPoint: { connId: null, pointIndex: null },
      bendEditMode: false,
      bendPointDialog: {
        visible: false,
        connId: null,
        pointIndex: null,
        label: '',
      },
      importDialog: {
        visible: false,
        file: null,
        fileName: '',
      },
      isImporting: false,

      localHistory: [],
      localHistoryIndex: -1,
      isApplyingLocalHistory: false,
      historyPushTimer: null,

      selectedElements: [],          // array of selected elements (replaces single selectedElement for multi)
      isMultiSelectDragging: false, // are we dragging the whole group?
      multiDragOffset: { x: 0, y: 0 }, // offset from mouse to group centre
      selectionBox: null,            // {x, y, width, height} for drag-select rectangle
      selectionBoxStart: null,       // start point of selection box
      // Prevent deselection right after drag or selection box
      justInteracted: false,

    }
  },
  async mounted() {
    window.addEventListener('mousemove', this.handleGlobalMouseMove);
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    window.addEventListener('mouseleave', this.handleGlobalMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.initTheme();
    this.pushLocalHistorySnapshot();
    this.shareToken = this.extractShareTokenFromPath();
    await this.initializeAuth();
  },

  beforeUnmount() {
    window.removeEventListener('mousemove', this.handleGlobalMouseMove);
    window.removeEventListener('mouseup', this.handleGlobalMouseUp);
    window.removeEventListener('mouseleave', this.handleGlobalMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.historyPushTimer) {
      clearTimeout(this.historyPushTimer);
      this.historyPushTimer = null;
    }
  },
  computed: {
    canUndo() {
      if (!this.accessPolicy.canWrite) return false;
      if (this.accessPolicy.mode === 'shared') return this.currentVersion > 1;
      if (this.localHistoryIndex > 0) return true;
      if (this.currentDiagramId) return this.currentVersion > 1;
      return false;
    },

    canRedo() {
      if (!this.accessPolicy.canWrite) return false;
      if (this.accessPolicy.mode === 'shared') return this.historyEntries.length > this.currentVersion;
      if (this.localHistoryIndex >= 0 && this.localHistoryIndex < this.localHistory.length - 1) return true;
      if (this.currentDiagramId) return this.historyEntries.length > this.currentVersion;
      return false;
    },

    requiresAuthGate() {
      if (this.authUser) return false;
      if (this.shareToken) return this.shareLoginRequired;
      return true;
    },

    authGateTitle() {
      if (this.shareLoginRequired) return 'Войдите, чтобы редактировать диаграмму';
      return '';
    },

    authGateLead() {
      if (this.shareLoginRequired) {
        return 'Эта ссылка дает доступ на редактирование. После входа или регистрации ACDC снова откроет эту же ссылку.';
      }
      return '';
    },

    availableConnectionTools() {
      if (!this.accessPolicy.canWrite) return [];
      if (this.currentDiagramTypeId && this.customConnectionTypes.length > 0) {
        return this.customConnectionTypes.map((conn) => ({
          type: conn.key,
          label: conn.name,
          color: conn.color || '#34495e',
          dash: conn.dash || '',
          diagrams: [this.diagramType],
          connection_type_id: conn.id,
        }));
      }

      const allConnections = this.connectionPresets.filter((p) => p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode');
      const uniqueConnections = [];
      const seenTypes = new Set();

      for (const conn of allConnections) {
        if (!seenTypes.has(conn.type)) {
          seenTypes.add(conn.type);
          uniqueConnections.push(conn);
        }
      }

      return uniqueConnections;
    },

    elementToolTypes() {
      return this.availableElementTools.map((p) => p.type);
    },

    connectionToolTypes() {
      return this.availableConnectionTools.map((p) => p.type);
    },

    selectionTools() {
      return this.elementPresets.filter(
        (p) => ['select', 'delete'].includes(p.type) && (p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode'),
      ).filter((tool) => this.accessPolicy.canWrite || tool.type !== 'delete');
    },

    availableElementTools() {
      if (!this.accessPolicy.canWrite) return [];
      if (this.currentDiagramTypeId && this.customElementTypes.length > 0) {
        return this.customElementTypes.map((item) => ({
          type: item.key,
          label: item.name,
          shape: item.shape || 'rect',
          diagrams: [this.diagramType],
          width: Number(item.default_size?.width) || 120,
          height: Number(item.default_size?.height) || 60,
          svg_path: typeof item.svg_path === 'string' ? item.svg_path : '',
          color: item.default_style?.color || '#3498db',
          border: item.default_style?.border || '#2d83be',
          textColor: item.default_style?.textColor || '#ffffff',
          element_type_id: item.id,
          field_schema: Array.isArray(item.field_schema) ? item.field_schema : [],
        }));
      }

      return this.elementPresets.filter(
        (p) => !['select', 'delete'].includes(p.type) && (p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode'),
      );
    },

    isElementSelected() {
      return (element) => this.selectedElements.some((el) => el.id === element.id);
    },

    primarySelectedElement() {
      return this.selectedElements[0] || null;
    },
  },

  watch: {
    elements: { handler() { this.checkForChanges(); }, deep: true },
    connections: { handler() { this.checkForChanges(); }, deep: true },
    diagramName() { this.checkForChanges(); },
    diagramType() {
      this.checkForChanges();
      this.ensureToolFitsDiagram();
    },
    snapToGrid(newValue) {
      if (newValue) {
        this.alignElementsToGrid();
      }
    }
  },

  methods: appMethods,
}
