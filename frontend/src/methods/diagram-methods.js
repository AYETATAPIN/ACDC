import { findBestSegmentIndex, toggleBendPointPoints } from '../utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError, clearShareContext, setShareContext, sharesService } from '../services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../app-constants.js';

export const diagramMethods = {
generateId() {
      return this.generateUUID();
    },

extractShareTokenFromPath() {
      if (typeof window === 'undefined') return null;
      const match = window.location.pathname.match(/^\/share\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    },

openShareDialog() {
      if (!this.currentDiagramId || !this.accessPolicy.canShare) return;
      this.shareDialogVisible = true;
    },

canMutateDiagram(action = 'Это действие') {
      if (this.accessPolicy.canWrite) return true;
      this.showError(`${action} недоступно в режиме просмотра по ссылке`);
      return false;
    },

applySharedTypeBundle(bundle) {
      if (!bundle || typeof bundle !== 'object') return;
      const type = this.normalizeDiagramTypeEntity(bundle.diagram_type);
      if (type) {
        this.diagramTypesCatalog = [type];
        this.currentDiagramTypeId = this.normalizeDiagramTypeId(type.id, type.key);
        this.currentDiagramTypeEntity = type;
      }
      this.customElementTypes = Array.isArray(bundle.element_types) ? bundle.element_types : [];
      this.customConnectionTypes = Array.isArray(bundle.connection_types) ? bundle.connection_types : [];
      this.rulesMatrix = normalizeRulesMatrix(bundle.rules_matrix);
    },

async loadSharedDiagramState() {
      if (!this.shareToken) return;
      this.isLoading = true;
      this.errorMessage = null;
      this.shareLoadError = null;

      try {
        const data = await sharesService.getState(this.shareToken);
        this.shareLoginRequired = false;
        this.accessPolicy = data.access || {
          mode: 'shared',
          permission: 'read',
          canRead: true,
          canWrite: false,
          canShare: false,
          canDelete: false,
          canReplaceImport: false,
          requiresLogin: false,
        };
        setShareContext({
          token: this.shareToken,
          access: this.accessPolicy,
          diagramTypeBundle: data.diagram_type_bundle,
          history: data.history || null,
        });
        this.applySharedTypeBundle(data.diagram_type_bundle);
        this.currentDiagramId = data.diagram?.id || null;
        this.selectedDiagramId = this.currentDiagramId;
        this.applySnapshot({
          diagram: data.diagram,
          blocks: data.blocks || [],
          connections: data.connections || [],
        });
        this.historyEntries = data.history?.entries || [];
        this.currentVersion = data.history?.current_version || 0;
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
      } catch (error) {
        clearShareContext();
        if (error instanceof ApiError && error.status === 401) {
          this.shareLoginRequired = true;
          this.accessPolicy = error.details?.access || {
            mode: 'shared',
            permission: 'edit',
            canRead: true,
            canWrite: false,
            canShare: false,
            canDelete: false,
            canReplaceImport: false,
            requiresLogin: true,
          };
          this.shareLoadError = null;
          return;
        }
        this.shareLoginRequired = false;
        this.shareLoadError = error.message || 'Ссылка доступа недействительна или была отозвана.';
      } finally {
        this.isLoading = false;
      }
    },

async saveDiagram() {
      if (!this.canMutateDiagram('Сохранение')) return;
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
        if (this.accessPolicy.mode === 'shared') {
          await this.loadSharedDiagramState();
          return;
        }
        await this.loadHistory();
        if (this.accessPolicy.mode === 'owner') {
          await this.loadDiagramsList();
        }

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
      if (!this.canMutateDiagram('Создание новой диаграммы')) return;
      if (this.accessPolicy.mode !== 'owner') {
        this.showError('Новая диаграмма недоступна по ссылке доступа');
        return;
      }
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
      if (this.accessPolicy.mode === 'shared') {
        this.diagrams = [];
        return;
      }
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
      if (this.accessPolicy.mode === 'shared') {
        await this.loadSharedDiagramState();
        return;
      }
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
      if (!this.accessPolicy.canWrite) return;
      if (this.accessPolicy.mode === 'shared') return;
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
      if (!this.canMutateDiagram('Отмена')) return;
      if (this.accessPolicy.mode !== 'shared' && this.localHistoryIndex > 0) {
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
        if (this.accessPolicy.mode === 'shared') {
          await this.loadSharedDiagramState();
          return;
        }
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
      if (!this.canMutateDiagram('Возврат')) return;
      if (this.accessPolicy.mode !== 'shared' && this.localHistoryIndex >= 0 && this.localHistoryIndex < this.localHistory.length - 1) {
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
        if (this.accessPolicy.mode === 'shared') {
          await this.loadSharedDiagramState();
          return;
        }
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
            text: props.text || props.label || this.getDefaultText(block.type, this.getElementPreset(block.type)),
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

buildDiagramTypeBundleForExport() {
      const matchedType = this.currentDiagramTypeEntity
        || this.diagramTypesCatalog.find((item) => item.id === this.currentDiagramTypeId)
        || this.diagramTypesCatalog.find((item) => item.key === this.diagramType)
        || null;

      return {
        diagram_type: {
          id: matchedType?.id || this.currentDiagramTypeId || this.diagramType,
          key: matchedType?.key ?? this.diagramType,
          name: matchedType?.name || this.diagramName || 'Imported Diagram Type',
          description: matchedType?.description ?? null,
          is_builtin: Boolean(matchedType?.is_builtin),
          is_free_mode: Boolean(matchedType?.is_free_mode || this.diagramType === 'free_mode'),
          clone_source_id: matchedType?.clone_source_id ?? null,
          owner_user_id: matchedType?.owner_user_id ?? null,
          metadata: matchedType?.metadata || {},
          created_at: matchedType?.created_at || new Date().toISOString(),
          updated_at: matchedType?.updated_at || new Date().toISOString(),
        },
        element_types: Array.isArray(this.customElementTypes) ? this.customElementTypes : [],
        connection_types: Array.isArray(this.customConnectionTypes) ? this.customConnectionTypes : [],
        rules_matrix: normalizeRulesMatrix(this.rulesMatrix),
      };
    },

buildAcdcDiagramFile() {
      const exportedAt = new Date().toISOString();
      const diagramId = this.currentDiagramId || '00000000-0000-0000-0000-000000000000';
      const diagramTypeId = this.resolveDiagramTypeIdForRequest() || this.currentDiagramTypeId || this.diagramType;

      return {
        format: 'acdc.diagram',
        version: 1,
        exported_at: exportedAt,
        diagram: {
          name: this.diagramName || 'Untitled',
          type: this.diagramType,
          diagram_type_id: diagramTypeId,
          svg_data: this.exportToSvg(),
        },
        blocks: this.elements.map((element) => ({
          id: element.id,
          diagram_id: diagramId,
          element_type_id: element.element_type_id || this.resolveElementTypeId(element) || null,
          type: element.type,
          x: Number(element.x) || 0,
          y: Number(element.y) || 0,
          width: Number(element.width) || 100,
          height: Number(element.height) || 60,
          properties: {
            ...(element.properties || {}),
            text: element.text,
            fontSize: element.fontSize ?? 14,
            customColor: element.customColor ?? null,
            customBorder: element.customBorder ?? null,
          },
          created_at: element.created_at || exportedAt,
          updated_at: element.updated_at || exportedAt,
        })),
        connections: this.connections.map((connection) => ({
          id: connection.id,
          diagram_id: diagramId,
          from_block_id: connection.from,
          to_block_id: connection.to,
          connection_type_id: connection.connection_type_id || this.resolveConnectionTypeId(connection.type) || null,
          type: connection.type,
          points: connection.points || [],
          label: connection.label || '',
          properties: {
            ...(connection.properties || {}),
            customColor: connection.customColor ?? null,
            customDash: connection.customDash ?? null,
            labelColor: connection.labelColor ?? '#2c3e50',
            labelFontSize: connection.labelFontSize ?? 12,
          },
          rule_violation: Boolean(connection.rule_violation),
          created_at: connection.created_at || exportedAt,
        })),
        diagram_type_bundle: this.buildDiagramTypeBundleForExport(),
      };
    },

exportDiagram() {
      try {
        const payload = this.buildAcdcDiagramFile();
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = String(payload.diagram.name || 'diagram')
          .trim()
          .replace(/[^\w.-]+/g, '_')
          .replace(/^_+|_+$/g, '')
          || 'diagram';
        link.href = url;
        link.download = `${safeName}.acdc.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        this.showError(error.message || 'Ошибка экспорта диаграммы');
      }
    },

async handleImportFileSelected(file) {
      if (!this.accessPolicy.canReplaceImport) {
        this.showError('Импорт недоступен по ссылке доступа');
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || parsed.format !== 'acdc.diagram' || parsed.version !== 1) {
          throw new Error('Неподдерживаемый формат файла диаграммы');
        }
        this.importDialog = {
          visible: true,
          file: parsed,
          fileName: file.name,
        };
      } catch (error) {
        this.showError(error.message || 'Не удалось прочитать файл импорта');
      }
    },

async confirmImportDiagram(mode) {
      if (!this.accessPolicy.canReplaceImport) {
        this.showError('Импорт недоступен по ссылке доступа');
        return;
      }
      if (!this.importDialog.file || (mode !== 'create' && mode !== 'replace')) return;
      if (mode === 'replace' && !this.currentDiagramId) {
        this.showError('Нет открытой диаграммы для замены');
        return;
      }

      this.isImporting = true;
      try {
        const result = await diagramsService.importDiagram({
          mode,
          target_diagram_id: mode === 'replace' ? this.currentDiagramId : undefined,
          file: this.importDialog.file,
        });

        this.importDialog = { visible: false, file: null, fileName: '' };
        await this.loadDiagramsList();
        await this.loadDiagram(result.id);
      } catch (error) {
        this.showError(error.message || 'Ошибка импорта диаграммы');
      } finally {
        this.isImporting = false;
      }
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
        if (!this.canMutateDiagram('Создание элемента')) return;
        const preset = this.getElementPreset(type);
        const fieldDefaults = this.buildDefaultFieldValues(preset?.field_schema);
        const defaultText = this.getDefaultText(type, preset);
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

getDefaultText(type, preset = null) {
      if (preset?.label && String(preset.label).trim()) {
        return String(preset.label).trim();
      }
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

      if (texts[type]) return texts[type];
      const raw = String(type || '').trim();
      if (!raw) return 'Element';
      return raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    },
};
