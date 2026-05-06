import { findBestSegmentIndex, toggleBendPointPoints } from '../utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError } from '../services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../app-constants.js';

export const sharedMethods = {
initTheme() {
      const saved = window.localStorage.getItem('acdc.theme');
      this.themeMode = saved === 'dark' ? 'dark' : 'light';
      this.applyTheme();
    },

toggleTheme() {
      this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
      this.applyTheme();
      window.localStorage.setItem('acdc.theme', this.themeMode);
    },

applyTheme() {
      const root = document.documentElement;
      root.setAttribute('data-theme', this.themeMode);
    },

getLocalHistorySnapshot() {
      return {
        elements: JSON.parse(JSON.stringify(this.elements)),
        connections: JSON.parse(JSON.stringify(this.connections)),
        diagramName: this.diagramName,
        diagramType: this.diagramType,
        diagramTypeId: this.currentDiagramTypeId,
      };
    },

applyLocalHistorySnapshot(snapshot) {
      if (!snapshot) return;
      this.isApplyingLocalHistory = true;
      this.setElements(JSON.parse(JSON.stringify(snapshot.elements || [])));
      this.setConnections(JSON.parse(JSON.stringify(snapshot.connections || [])));
      this.diagramName = snapshot.diagramName || '';
      this.diagramType = snapshot.diagramType || 'class';
      if (this.isUuid(snapshot.diagramTypeId)) {
        this.currentDiagramTypeId = snapshot.diagramTypeId;
      }
      this.selectedConnection = null;
      this.selectedElement = null;
      this.selectedElements = [];
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.isApplyingLocalHistory = false;
    },

pushLocalHistorySnapshot() {
      if (this.isApplyingLocalHistory) return;
      const snapshot = this.getLocalHistorySnapshot();
      const json = JSON.stringify(snapshot);
      const current = this.localHistory[this.localHistoryIndex];
      if (current && JSON.stringify(current) === json) return;

      this.localHistory = this.localHistory.slice(0, this.localHistoryIndex + 1);
      this.localHistory.push(snapshot);
      if (this.localHistory.length > 80) {
        this.localHistory.shift();
      }
      this.localHistoryIndex = this.localHistory.length - 1;
    },

queueLocalHistorySnapshot() {
      if (this.isApplyingLocalHistory) return;
      if (this.historyPushTimer) clearTimeout(this.historyPushTimer);
      this.historyPushTimer = setTimeout(() => {
        this.pushLocalHistorySnapshot();
      }, 120);
    },

setElements(nextElements) {
      this.elements = nextElements;
      if (this.selectedElement) {
        const updated = nextElements.find(el => el.id === this.selectedElement.id);
        this.selectedElement = updated || null;
      }
      if (Array.isArray(this.selectedElements) && this.selectedElements.length > 0) {
        const byId = new Map(nextElements.map((el) => [el.id, el]));
        this.selectedElements = this.selectedElements
          .map((item) => byId.get(item?.id))
          .filter(Boolean);
      }
      this.queueLocalHistorySnapshot();
    },

setConnections(nextConnections) {
      this.connections = nextConnections;
      if (this.selectedConnection) {
        const updated = nextConnections.find(conn => conn.id === this.selectedConnection.id);
        this.selectedConnection = updated || null;
      }
      this.queueLocalHistorySnapshot();
    },

setDiagramName(value) {
      if (!this.accessPolicy.canWrite) return;
      this.diagramName = value;
      this.queueLocalHistorySnapshot();
    },

setDiagramType(value) {
      if (!this.accessPolicy.canWrite) return;
      const normalizedValue = this.normalizeDiagramTypeId(value, value);
      const matchedById = this.diagramTypesCatalog.find(
        (item) => this.normalizeDiagramTypeId(item.id, item.key) === normalizedValue,
      );
      const matchedByKey = typeof value === 'string'
        ? this.diagramTypesCatalog.find((item) => item.key === value)
        : null;
      const matched = matchedById || matchedByKey;

      if (!matched) {
        if (typeof value === 'string') {
          const builtinKey = Object.keys(BUILTIN_DIAGRAM_TYPE_IDS).find(
            (key) => BUILTIN_DIAGRAM_TYPE_IDS[key] === value,
          );
          if (builtinKey) {
            this.diagramType = builtinKey;
            this.currentDiagramTypeId = BUILTIN_DIAGRAM_TYPE_IDS[builtinKey];
          } else if (!this.isUuid(value)) {
            this.diagramType = value;
            this.currentDiagramTypeId = this.normalizeDiagramTypeId(value, value);
          }
        }
        this.queueLocalHistorySnapshot();
        this.ensureToolFitsDiagram();
        return;
      }

      const normalizedId = this.normalizeDiagramTypeId(matched.id, matched.key);
      this.currentDiagramTypeId = normalizedId;
      this.currentDiagramTypeEntity = this.normalizeDiagramTypeEntity(matched);

      if (['class', 'use_case', 'activity_diagram', 'free_mode'].includes(matched.key)) {
        this.diagramType = matched.key;
      } else {
        this.diagramType = matched.is_free_mode ? 'free_mode' : 'class';
      }

      this.queueLocalHistorySnapshot();
      this.ensureToolFitsDiagram();
      this.loadActiveDiagramTypeContext(normalizedId).catch((error) => {
        this.showError(error.message || 'Failed to load diagram type context');
      });
    },

isUuid(value) {
      return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    },

normalizeDiagramTypeId(id, key) {
      if (this.isUuid(id)) return id;
      if (typeof key === 'string' && BUILTIN_DIAGRAM_TYPE_IDS[key]) return BUILTIN_DIAGRAM_TYPE_IDS[key];
      if (typeof id === 'string' && BUILTIN_DIAGRAM_TYPE_IDS[id]) return BUILTIN_DIAGRAM_TYPE_IDS[id];
      return id;
    },

normalizeDiagramTypeEntity(item) {
      if (!item || typeof item !== 'object') return item;
      const normalizedId = this.normalizeDiagramTypeId(item.id, item.key);
      return { ...item, id: normalizedId };
    },

resolveDiagramTypeIdForRequest() {
      const currentNormalized = this.normalizeDiagramTypeId(this.currentDiagramTypeId, this.diagramType);
      if (this.isUuid(currentNormalized)) {
        this.currentDiagramTypeId = currentNormalized;
        return currentNormalized;
      }
      const matched = this.diagramTypesCatalog.find((item) => item.key === this.diagramType);
      const matchedId = this.normalizeDiagramTypeId(matched?.id, matched?.key);
      if (this.isUuid(matchedId)) {
        this.currentDiagramTypeId = matchedId;
        return matchedId;
      }
      return undefined;
    },

setSelectedDiagramId(value) {
      this.selectedDiagramId = value;
    },

openRulesDialog() {
      if (!this.accessPolicy.canWrite) {
        this.showError('Правила и типы недоступны в режиме просмотра');
        return;
      }
      this.showRulesDialog = true;
    },

async loadDiagramTypesCatalog() {
      try {
        this.diagramTypesCatalog = (await diagramTypesService.list()).map((item) => this.normalizeDiagramTypeEntity(item));
        const currentByType = this.diagramTypesCatalog.find((item) => item.key === this.diagramType);
        if ((!this.currentDiagramTypeId || !this.isUuid(this.currentDiagramTypeId)) && currentByType) {
          this.currentDiagramTypeId = currentByType.id;
          this.currentDiagramTypeEntity = currentByType;
        }

        const activeId = this.resolveDiagramTypeIdForRequest();
        if (this.isUuid(activeId)) {
          await this.loadActiveDiagramTypeContext(activeId);
        }
      } catch (error) {
        this.showError(error.message || 'Failed to load diagram types');
      }
    },

async loadActiveDiagramTypeContext(diagramTypeId) {
      const normalizedId = this.normalizeDiagramTypeId(diagramTypeId, this.diagramType);
      if (!this.isUuid(normalizedId)) return;
      this.customElementTypes = await diagramTypesService.listElements(normalizedId);
      this.customConnectionTypes = await diagramTypesService.listConnectionTypes(normalizedId);
      this.rulesMatrix = normalizeRulesMatrix(await diagramTypesService.getRulesMatrix(normalizedId));
    },

handleApplyDiagramType(payload) {
      if (!this.accessPolicy.canWrite) return;
      const type = payload?.type;
      if (!type) return;

      const normalizedType = this.normalizeDiagramTypeEntity(type);
      const normalizedTypeId = this.normalizeDiagramTypeId(normalizedType?.id, normalizedType?.key);

      if (!Array.isArray(this.diagramTypesCatalog)) {
        this.diagramTypesCatalog = [];
      }
      const existingIndex = this.diagramTypesCatalog.findIndex(
        (item) => this.normalizeDiagramTypeId(item?.id, item?.key) === normalizedTypeId,
      );
      if (existingIndex >= 0) {
        this.diagramTypesCatalog.splice(existingIndex, 1, {
          ...this.diagramTypesCatalog[existingIndex],
          ...normalizedType,
        });
      } else {
        this.diagramTypesCatalog.push(normalizedType);
      }

      this.currentDiagramTypeId = normalizedTypeId;
      this.currentDiagramTypeEntity = normalizedType;
      this.customElementTypes = Array.isArray(payload.elements) ? payload.elements : [];
      this.customConnectionTypes = Array.isArray(payload.connectionTypes) ? payload.connectionTypes : [];
      this.rulesMatrix = normalizeRulesMatrix(payload.rulesMatrix);

      if (['class', 'use_case', 'activity_diagram', 'free_mode'].includes(normalizedType.key)) {
        this.diagramType = normalizedType.key;
      } else {
        this.diagramType = normalizedType.is_free_mode ? 'free_mode' : 'class';
      }

      this.ensureToolFitsDiagram();
    },

toggleGrid() {
      this.snapToGrid = !this.snapToGrid;
    },

toggleHistoryCollapsed() {
      this.historyCollapsed = !this.historyCollapsed;
    },

checkForChanges() {
      const currentState = {
        elements: this.elements,
        connections: this.connections,
        diagramName: this.diagramName,
        diagramType: this.diagramType,
        diagramTypeId: this.currentDiagramTypeId,
      };
      if (!this.lastSavedState || JSON.stringify(currentState) !== JSON.stringify(this.lastSavedState)) {
        this.hasUnsavedChanges = true;
      } else {
        this.hasUnsavedChanges = false;
      }
    },

ensureToolFitsDiagram() {
      const allTools = [...this.elementToolTypes, ...this.connectionToolTypes];
      if (!allTools.includes(this.currentTool)) {
        this.currentTool = this.defaultToolForDiagram();
      }
      if (this.connectionStart && !this.connectionToolTypes.includes(this.currentTool)) {
        this.connectionStart = null;
        this.isConnecting = false;
      }
    },

defaultToolForDiagram() {
      // Prefer select tool first
      if (this.availableElementTools.find(t => t.type === 'select')) return 'select';
      const fallback = this.availableElementTools[0]?.type;
      
      if (this.diagramType === 'use_case') 
        return this.availableElementTools.find(t => t.type === 'actor')?.type || fallback || null;
      
      if (this.diagramType === 'activity_diagram') 
        return this.availableElementTools.find(t => t.type === 'activity')?.type || fallback || null;
      
      if (this.diagramType === 'class') 
        return this.availableElementTools.find(t => t.type === 'class')?.type || fallback || null;
      
      return fallback || null;
    },

adjustCanvasHeight(delta) {
      const next = Number(this.canvasHeight || 0) + delta;
      this.canvasHeight = Math.max(400, next);
    },

ensureCanvasCanFitPoint(x, y) {
      const margin = 260;
      const targetWidth = Math.max(this.canvasWidth, Math.ceil(x + margin));
      const targetHeight = Math.max(this.canvasHeight, Math.ceil(y + margin));
      if (targetWidth !== this.canvasWidth) this.canvasWidth = targetWidth;
      if (targetHeight !== this.canvasHeight) this.canvasHeight = targetHeight;
    },

handleKeyDown(event) {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (ctrlOrMeta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (!this.accessPolicy.canWrite) return;
        if (event.shiftKey) {
          this.redoDiagram();
        } else {
          this.undoDiagram();
        }
        return;
      }

      if (ctrlOrMeta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        if (!this.accessPolicy.canWrite) return;
        this.redoDiagram();
        return;
      }

      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (!this.accessPolicy.canWrite) return;
        if (this.selectedBendPoint.connId) {
          this.removeSelectedBendPoint();
          return;
        }
        if (this.selectedConnection) {
          this.deleteConnection(this.selectedConnection);
          return;
        }
        if (Array.isArray(this.selectedElements) && this.selectedElements.length > 0) {
          const ids = new Set(this.selectedElements.map((el) => el.id));
          this.setConnections(this.connections.filter((c) => !ids.has(c.from) && !ids.has(c.to)));
          this.setElements(this.elements.filter((el) => !ids.has(el.id)));
          this.selectedElements = [];
          this.selectedElement = null;
          return;
        }
        if (this.selectedElement) {
          this.deleteElement(this.selectedElement);
        }
      }
    },

formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },

showError(message) {
      console.warn('Diagram error:', message);
      this.errorMessage = message;

      // Auto-clear after 6 seconds
      if (this.errorTimeout) clearTimeout(this.errorTimeout);
      this.errorTimeout = setTimeout(() => {
        this.errorMessage = null;
      }, 6000);
    },
};
