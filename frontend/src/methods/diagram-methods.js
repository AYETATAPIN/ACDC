import { findBestSegmentIndex, toggleBendPointPoints } from '../utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError } from '../services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../app-constants.js';

export const diagramMethods = {
generateId() {
      return this.generateUUID();
    },

async saveDiagram() {
      this.isLoading = true;
      this.errorMessage = null;

      try {
        const diagramTypeId = this.resolveDiagramTypeIdForRequest();
        const diagramData = {
          name: this.diagramName || 'Untitled',
          type: this.diagramType,

          svg_data: this.exportToSvg(),
          elements: this.elements.map((el) => ({
            id: el.id,
            element_type_id: el.element_type_id || this.resolveElementTypeId(el),
            type: el.type,
            x: Number(el.x) || 0,
            y: Number(el.y) || 0,
            width: Number(el.width) || 0,
            height: Number(el.height) || 0,
            text: el.text,
            properties: {
              ...(el.properties || {}),
              fontSize: el.fontSize ?? 14,
              customColor: el.customColor ?? null,
              customBorder: el.customBorder ?? null,
            },
          })),
          connections: this.connections.map((conn) => ({
            id: conn.id,
            from: conn.from,
            to: conn.to,
            type: conn.type,
            connection_type_id: conn.connection_type_id || this.resolveConnectionTypeId(conn.type),
            label: conn.label || '',
            points: conn.points || [],
            properties: {
              ...(conn.properties || {}),
              customColor: conn.customColor ?? null,
              customDash: conn.customDash ?? null,
              labelColor: conn.labelColor ?? '#2c3e50',
              labelFontSize: conn.labelFontSize ?? 12,
              rule_violation: Boolean(conn.rule_violation),
            },
          })),
        };
        if (this.isUuid(diagramTypeId)) {
          diagramData.diagram_type_id = diagramTypeId;
        }

        const result = this.currentDiagramId
          ? await diagramsService.update(this.currentDiagramId, diagramData)
          : await diagramsService.create(diagramData);

        this.currentDiagramId = result.id || this.currentDiagramId;
        await this.loadHistory();
        await this.loadDiagramsList();

        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType,
          diagramTypeId: this.currentDiagramTypeId,
        };
        this.hasUnsavedChanges = false;
      } catch (error) {
        this.showError(error.message || 'Ошибка сохранения');
      } finally {
        this.isLoading = false;
      }
    },

newDiagram() {
      this.setElements([]);
      this.setConnections([]);
      this.diagramName = '';
      this.diagramType = 'class';
      const defaultType = this.diagramTypesCatalog.find((item) => item.key === 'class');
      this.currentDiagramTypeId = defaultType?.id || this.currentDiagramTypeId;
      this.currentDiagramTypeEntity = defaultType || this.currentDiagramTypeEntity;
      this.currentTool = 'select';
      this.selectedElement = null;
      this.currentDiagramId = null;
      this.selectedDiagramId = null;
      this.historyEntries = [];
      this.currentVersion = 0;
      this.pan = { x: 0, y: 0 };
      if (this.currentDiagramTypeId) {
        this.loadActiveDiagramTypeContext(this.currentDiagramTypeId).catch(() => {});
      }
      this.localHistory = [];
      this.localHistoryIndex = -1;
      this.pushLocalHistorySnapshot();
    },

async loadHistory() {
      if (!this.currentDiagramId) return;
      try {
        const data = await diagramsService.listHistory(this.currentDiagramId);
        this.historyEntries = data.entries || [];
        this.currentVersion = data.current_version || 0;
      } catch {
        this.historyEntries = [];
      }
    },

async loadDiagramsList() {
      this.isLoadingList = true;
      try {
        const items = await diagramsService.list();
        this.diagrams = (items || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (this.currentDiagramId) {
          this.selectedDiagramId = this.currentDiagramId;
        }
      } catch (err) {
        console.error(err);
        this.showError('Failed to load diagrams');
      } finally {
        this.isLoadingList = false;
      }
    },

async loadDiagram(diagramId) {
      this.isLoading = true;
      try {
        const data = await diagramsService.getStateAtVersion(diagramId);
        this.currentDiagramId = diagramId;
        this.selectedDiagramId = diagramId;
        this.applySnapshot(data.state);
        this.currentVersion = data.version || 0;
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType,
          diagramTypeId: this.currentDiagramTypeId,
        };
        this.hasUnsavedChanges = false;
        this.localHistory = [];
        this.localHistoryIndex = -1;
        this.pushLocalHistorySnapshot();
        await this.loadHistory();
      } catch (err) {
        this.showError(err.message);
      } finally {
        this.isLoading = false;
      }
    },

async loadDiagramVersion(version) {
      if (!this.currentDiagramId || !Number.isFinite(Number(version))) return;
      this.isLoading = true;
      try {
        const data = await diagramsService.getStateAtVersion(this.currentDiagramId, Number(version));
        this.applySnapshot(data.state);
        this.currentVersion = data.version || Number(version);
      } catch (error) {
        this.showError(error.message || 'Failed to load snapshot version');
      } finally {
        this.isLoading = false;
      }
    },

async undoDiagram() {
      if (this.localHistoryIndex > 0) {
        if (!this.canUndo) {
          this.showError('Нечего отменять');
          return;
        }
        const prevIndex = this.localHistoryIndex - 1;
        const snapshot = this.localHistory[prevIndex];
        if (!snapshot) {
          this.showError('Нечего отменять');
          return;
        }
        this.localHistoryIndex = prevIndex;
        this.applyLocalHistorySnapshot(snapshot);
        return;
      }

      if (!this.currentDiagramId) {
        this.showError('Нечего отменять');
        return;
      }

      this.isLoading = true;
      try {
        const data = await diagramsService.undo(this.currentDiagramId);
        this.applySnapshot(data.state);
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType,
          diagramTypeId: this.currentDiagramTypeId,
        };
        this.hasUnsavedChanges = false;
        this.currentVersion = data.version;
        await this.loadHistory();
      } catch (error) {
        if (error instanceof ApiError && error.status === 400 && /empty/i.test(error.message)) {
          this.showError('Нечего отменять');
        } else {
          this.showError(error.message || 'Ошибка отмены');
        }
      } finally {
        this.isLoading = false;
      }
    },

async redoDiagram() {
      if (this.localHistoryIndex >= 0 && this.localHistoryIndex < this.localHistory.length - 1) {
        if (!this.canRedo) {
          this.showError('Нечего возвращать');
          return;
        }
        const nextIndex = this.localHistoryIndex + 1;
        const snapshot = this.localHistory[nextIndex];
        if (!snapshot) {
          this.showError('Нечего возвращать');
          return;
        }
        this.localHistoryIndex = nextIndex;
        this.applyLocalHistorySnapshot(snapshot);
        return;
      }

      if (!this.currentDiagramId) {
        this.showError('Нечего возвращать');
        return;
      }

      this.isLoading = true;
      try {
        const data = await diagramsService.redo(this.currentDiagramId);
        this.applySnapshot(data.state);
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType,
          diagramTypeId: this.currentDiagramTypeId,
        };
        this.hasUnsavedChanges = false;
        this.currentVersion = data.version;
        await this.loadHistory();
      } catch (error) {
        if (error instanceof ApiError && error.status === 400 && /empty/i.test(error.message)) {
          this.showError('Нечего возвращать');
        } else {
          this.showError(error.message || 'Ошибка возврата');
        }
      } finally {
        this.isLoading = false;
      }
    },

applySnapshot(snapshot) {
      if (!snapshot) return;

      console.log('Applying snapshot. Blocks:', snapshot.blocks?.length, 'Connections:', snapshot.connections?.length);

      // РћР±РЅРѕРІР»СЏРµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РґРёР°РіСЂР°РјРјРµ
      this.diagramName = snapshot.diagram?.name || this.diagramName;
      this.diagramType = snapshot.diagram?.type || this.diagramType;
      const snapshotTypeId = this.normalizeDiagramTypeId(snapshot.diagram?.diagram_type_id, this.diagramType);
      if (this.isUuid(snapshotTypeId)) {
        this.currentDiagramTypeId = snapshotTypeId;
      } else if (!this.isUuid(this.currentDiagramTypeId)) {
        const byKey = this.diagramTypesCatalog.find((item) => item.key === this.diagramType);
        const normalizedByKey = this.normalizeDiagramTypeId(byKey?.id, byKey?.key);
        if (this.isUuid(normalizedByKey)) {
          this.currentDiagramTypeId = normalizedByKey;
        }
      }
      if (this.isUuid(this.currentDiagramTypeId)) {
        const matchedType = this.diagramTypesCatalog.find((item) => item.id === this.currentDiagramTypeId);
        if (matchedType) {
          this.currentDiagramTypeEntity = matchedType;
        }
        this.loadActiveDiagramTypeContext(this.currentDiagramTypeId).catch(() => {});
      }

      // РџСЂРµРѕР±СЂР°Р·СѓРµРј Р±Р»РѕРєРё РІ СЌР»РµРјРµРЅС‚С‹
      this.setElements((snapshot.blocks || []).map((block) => {
        const props = (() => {
          if (!block || block.properties === undefined || block.properties === null) return {};
          if (typeof block.properties === 'string') {
            try {
              const parsed = JSON.parse(block.properties);
              return typeof parsed === 'object' && parsed !== null ? parsed : {};
            } catch {
              return {};
            }
          }
          if (typeof block.properties === 'object') return block.properties;
          return {};
        })();
        return {
            id: block.id,
            type: block.type,
            element_type_id: block.element_type_id || null,
            x: Number(block.x),
            y: Number(block.y),
            width: Number(block.width),
            height: Number(block.height),
            text: props.text || props.label || block.type,
            fontSize: Number(props.fontSize) || 14,
            customColor: props.customColor ?? null,
            customBorder: props.customBorder ?? null,
            properties: {
                // Р”Р»СЏ РєР»Р°СЃСЃРѕРІ СѓР±РµРґРёРјСЃСЏ, С‡С‚Рѕ РµСЃС‚СЊ РјР°СЃСЃРёРІС‹ Р°С‚СЂРёР±СѓС‚РѕРІ Рё РѕРїРµСЂР°С†РёР№
                ...(block.type === 'class' ? {
                    attributes: Array.isArray(props.attributes) ? props.attributes : [],
                    operations: Array.isArray(props.operations) ? props.operations : [],
                } : {}),
                ...props
            }
        };
      }));

      // РџСЂРµРѕР±СЂР°Р·СѓРµРј connections
      this.setConnections((snapshot.connections || []).map((conn) => {
        const props = (() => {
          if (!conn || conn.properties === undefined || conn.properties === null) return {};
          if (typeof conn.properties === 'string') {
            try {
              const parsed = JSON.parse(conn.properties);
              return typeof parsed === 'object' && parsed !== null ? parsed : {};
            } catch {
              return {};
            }
          }
          if (typeof conn.properties === 'object') return conn.properties;
          return {};
        })();
        // РћР±СЂР°Р±Р°С‚С‹РІР°РµРј points
        let points = [];
        if (conn.points) {
          if (typeof conn.points === 'string') {
            try {
              points = JSON.parse(conn.points);
            } catch {
              points = [];
            }
          } else if (Array.isArray(conn.points)) {
            points = conn.points;
          }
        }

        // Р•СЃР»Рё points РїСѓСЃС‚С‹Рµ, РІС‹С‡РёСЃР»СЏРµРј РёС… РёР· Р±Р»РѕРєРѕРІ
        if (points.length === 0) {
          const fromElement = this.elements.find(el => el.id === conn.from_block_id);
          const toElement = this.elements.find(el => el.id === conn.to_block_id);

          if (fromElement && toElement) {
            points = this.calculateConnectionPoints(fromElement, toElement);
          }
        }

        return {
          id: conn.id,
          from: conn.from_block_id,
          to: conn.to_block_id,
          type: conn.type,
          connection_type_id: conn.connection_type_id || null,
          label: conn.label || '',
          points: points,
          customColor: props.customColor ?? null,
          customDash: props.customDash ?? null,
          labelColor: props.labelColor ?? '#2c3e50',
          labelFontSize: Number(props.labelFontSize) || 12,
          rule_violation: Boolean(conn.rule_violation ?? props.rule_violation),
          properties: props
        };
      }));

      // РЎР±СЂР°СЃС‹РІР°РµРј РІС‹РґРµР»РµРЅРёРµ
      this.selectedElement = null;
      this.connectionStart = null;
      this.isConnecting = false;

      this.updateConnections();
      console.log('Applied elements:', this.elements.length, 'connections:', this.connections.length);
    },

exportToSvg() {
      return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><!-- rendered elements --></svg>`
    },

buildDefaultFieldValues(fieldSchema) {
      const output = {};
      if (!Array.isArray(fieldSchema)) return output;
      for (const field of fieldSchema) {
        if (!field || typeof field.key !== 'string') continue;
        output[field.key] = field.default ?? null;
      }
      return output;
    },

computeInitialElementSize(type, preset, text, fieldSchema) {
      const baseWidth = Number(preset?.width) || 120;
      const baseHeight = Number(preset?.height) || 60;
      const textWidth = Math.max(baseWidth, Math.ceil((String(text || '').length || 8) * 8.5 + 36));
      let height = baseHeight;
      if (type === 'class') {
        height = Math.max(baseHeight, 140);
      }
      const visibleFields = Array.isArray(fieldSchema) ? fieldSchema.filter((item) => item?.visibleOnBlock !== false).length : 0;
      height = Math.max(height, baseHeight + visibleFields * 24);
      return { width: textWidth, height };
    },

createElement(type, x, y) {
        const preset = this.getElementPreset(type);
        const fieldDefaults = this.buildDefaultFieldValues(preset?.field_schema);
        const defaultText = this.getDefaultText(type);
        const size = this.computeInitialElementSize(type, preset, defaultText, preset?.field_schema);
        const element = {
            id: this.generateUUID(),
            type: type,
            element_type_id: preset?.element_type_id || null,
            x: this.snapCoordinates(x - size.width / 2, y - size.height / 2).x,
            y: this.snapCoordinates(x - size.width / 2, y - size.height / 2).y,
            width: size.width,
            height: size.height,
            text: defaultText,
            fontSize: 14,
            customColor: null,
            customBorder: null,
            properties: fieldDefaults
        };
        
        // Р”Р»СЏ РєР»Р°СЃСЃРѕРІ РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј Р°С‚СЂРёР±СѓС‚С‹ Рё РѕРїРµСЂР°С†РёРё
        if (type === 'class') {
            element.properties = {
                attributes: [],
                operations: [],
                ...element.properties
            };
        }
        
        this.setElements([...this.elements, element]);
        this.ensureCanvasCanFitPoint(element.x + element.width, element.y + element.height);
        this.selectElement(element);
        this.pushLocalHistorySnapshot();
    },

generateUUID() {
      // Р“РµРЅРµСЂРёСЂСѓРµРј UUID v4
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

getDefaultText(type) {
      const texts = {
        // Р‘РµР· РєР°РІС‹С‡РµРє (РІР°Р»РёРґРЅС‹Рµ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂС‹)
        class: 'New Class',
        interface: 'Interface',
        enum: 'Enum',
        component: 'Component',
        database: 'Database',
        actor: 'Actor',
        usecase: 'Use Case',
        note: 'Note',
        package: 'Package',
        association: 'Association',
        
        // Activity Diagram СЌР»РµРјРµРЅС‚С‹
        initial: 'Start',
        final: 'End',
        activity: 'Activity',
        decision: 'Decision',
        merge: 'Merge',
        fork: 'Fork',
        join: 'Join',
        send_signal: 'Send Signal', // РЎ РїРѕРґС‡РµСЂРєРёРІР°РЅРёРµРј - РЅСѓР¶РЅС‹ РєР°РІС‹С‡РєРё
        receive_signal: 'Receive Signal', // РЎ РїРѕРґС‡РµСЂРєРёРІР°РЅРёРµРј - РЅСѓР¶РЅС‹ РєР°РІС‹С‡РєРё
        
        // Connections        '
        // extend': 'Extend',
        'include': 'Include',
        
        // Class СЃРІСЏР·Рё
        'dependency': 'Dependency',
        'realization': 'Realization',
        'aggregation': 'Aggregation',
        
        // Activity Diagram СЃРІСЏР·Рё
        'control_flow': 'Control Flow',
        'object_flow': 'Object Flow',
      };

      return texts[type] || type;
    },
};
