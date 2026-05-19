import { findBestSegmentIndex, toggleBendPointPoints } from '../utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError } from '../services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../app-constants.js';
import { isPointInsideCustomShape, isPointNearCustomShapeStroke, parseCustomShapeData } from '../utils/customShape.js';

export const canvasMethods = {
getMidPoint(conn) {
      const pts = conn.points || [];
      if (pts.length < 2) return { x: 0, y: 0 };
      const midIdx = Math.floor(pts.length / 2);
      return pts[midIdx];
    },

getLabelPosition(conn) {
      const mid = this.getMidPoint(conn);
      return { x: mid.x, y: mid.y - 10 };
    },

getLabelEditorStyle(connId) {
      const conn = this.connections.find(c => c.id === connId);
      if (!conn) return {};
      const pos = this.getLabelPosition(conn);
      return {
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: 'translate(-50%, -50%)',
        'z-index': 2000
      };
    },

getConnectionById(id) {
      return this.connections.find(c => c.id === id) || { label: '' };
    },

startLabelEdit(conn, event) {
      if (!this.accessPolicy.canWrite) return;
      this.editingConnectionLabel = { connId: conn.id };
      this.$nextTick(() => {
        if (this.$refs.labelInput && this.$refs.labelInput.focus) {
          this.$refs.labelInput.focus();
        }
      });
    },

finishLabelEdit() {
      this.editingConnectionLabel = null;
    },

cancelLabelEdit() {
      this.editingConnectionLabel = null;
    },

setZoom(value) {
      const clamped = Math.min(3, Math.max(0.3, value));
      this.zoom = Number(clamped.toFixed(2));
    },

adjustZoom(delta) {
      this.setZoom(this.zoom + delta);
    },

handleWheel(event) {
      if (event.ctrlKey || event.metaKey) {
        const step = 0.1;
        const delta = event.deltaY > 0 ? -step : step;
        this.adjustZoom(delta);
        return;
      }
      this.pan.x -= Number(event.deltaX || 0);
      this.pan.y -= Number(event.deltaY || 0);
    },

getElementPreset(type) {
      if (this.customElementTypes.length > 0) {
        const found = this.customElementTypes.find((item) => item.key === type);
        if (found) {
          return {
            type: found.key,
            label: found.name,
            shape: found.shape || 'rect',
            color: found.default_style?.color || '#3498db',
            border: found.default_style?.border || '#2d83be',
            textColor: found.default_style?.textColor || '#ffffff',
            width: Number(found.default_size?.width) || 120,
            height: Number(found.default_size?.height) || 60,
            svg_path: typeof found.svg_path === 'string' ? found.svg_path : '',
            element_type_id: found.id,
            field_schema: Array.isArray(found.field_schema) ? found.field_schema : [],
          };
        }
      }
      return this.elementPresets.find(p => p.type === type);
    },

    getCustomShapeInfo(type) {
      const raw = this.getElementPreset(type)?.svg_path || '';
      return parseCustomShapeData(raw);
    },

    getElementVisibleFields(element) {
      const schema = this.getElementPreset(element?.type)?.field_schema;
      if (!Array.isArray(schema)) return [];
      return schema.filter((field) => field && field.visibleOnBlock !== false);
    },

    resolveElementFieldType(field) {
      const type = String(field?.type || 'input').toLowerCase();
      if (['text', 'number', 'select', 'checkbox'].includes(type)) return 'input';
      return ['input', 'label', 'list'].includes(type) ? type : 'input';
    },

    getElementFieldKey(field, idx = 0) {
      const key = typeof field?.key === 'string' ? field.key.trim() : '';
      return key || `field_${idx + 1}`;
    },

    getElementFieldLabel(field, idx = 0) {
      const label = typeof field?.label === 'string' ? field.label.trim() : '';
      return label || this.getElementFieldKey(field, idx);
    },

    normalizeElementListValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => String(item ?? '').trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      }
      return [];
    },

    getElementListItems(element, fieldOrKey, idx = 0) {
      const key = typeof fieldOrKey === 'string' ? fieldOrKey : this.getElementFieldKey(fieldOrKey, idx);
      const fallback = typeof fieldOrKey === 'string' ? [] : fieldOrKey?.default;
      const props = element?.properties && typeof element.properties === 'object' ? element.properties : {};
      return this.normalizeElementListValue(props[key] ?? fallback);
    },

    getElementListStateKey(element, fieldOrKey, idx = 0) {
      const key = typeof fieldOrKey === 'string' ? fieldOrKey : this.getElementFieldKey(fieldOrKey, idx);
      return `${element?.id || 'element'}:${key}`;
    },

    isElementListExpanded(element, fieldOrKey, idx = 0) {
      const key = this.getElementListStateKey(element, fieldOrKey, idx);
      return Boolean(this.expandedElementLists?.[key]);
    },

    toggleElementList(element, fieldOrKey, idx = 0) {
      const key = this.getElementListStateKey(element, fieldOrKey, idx);
      this.expandedElementLists = {
        ...(this.expandedElementLists || {}),
        [key]: !this.isElementListExpanded(element, fieldOrKey, idx),
      };
    },

    getElementTypeLabel(type) {
      const preset = this.getElementPreset(type);
      if (preset?.label && String(preset.label).trim()) return String(preset.label).trim();
      const raw = String(type || '').trim();
      if (!raw) return 'Element';
      return raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    },

    getElementFieldTextColor(element, field, idx = 0) {
      const normalizeHexColor = (value) => {
        const source = String(value || '').trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(source)) return `#${source.toLowerCase()}`;
        if (/^[0-9a-fA-F]{3}$/.test(source)) {
          const expanded = source.split('').map((ch) => `${ch}${ch}`).join('');
          return `#${expanded.toLowerCase()}`;
        }
        return '';
      };
      const key = this.getElementFieldKey(field, idx);
      const props = element?.properties && typeof element.properties === 'object' ? element.properties : {};
      const colorMap = props.__field_colors && typeof props.__field_colors === 'object' ? props.__field_colors : {};
      const color =
        normalizeHexColor(colorMap[key]) ||
        normalizeHexColor(field?.textColor) ||
        '';
      return color || null;
    },

    getElementInnerTextSize(element) {
      const size = Number(element?.properties?.fieldFontSize);
      if (Number.isFinite(size)) {
        return Math.max(8, Math.min(28, size));
      }
      return 11;
    },

    getElementFieldStyle(element, field, idx = 0) {
      const clamp = (v, fallback) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : fallback));
      const x = clamp(field?.x, 0.5);
      const y = clamp(field?.y, 0.5);
      const color = this.getElementFieldTextColor(element, field, idx);
      const style = {
        left: `${(x * 100).toFixed(1)}%`,
        top: `${(y * 100).toFixed(1)}%`,
        fontSize: `${this.getElementInnerTextSize(element)}px`,
      };
      if (color) {
        style.color = color;
      }
      return style;
    },

    getElementFieldDisplayValue(element, field, idx = 0) {
      const fallback = this.getElementFieldLabel(field, idx);
      const key = this.getElementFieldKey(field, idx);
      if (this.resolveElementFieldType(field) === 'list') {
        return `${fallback} (${this.getElementListItems(element, field, idx).length})`;
      }
      if (this.resolveElementFieldType(field) === 'label') {
        return fallback;
      }
      if (!key || !element || typeof element !== 'object') return fallback;
      const props = element.properties && typeof element.properties === 'object' ? element.properties : {};
      const value = props[key];
      if (value === undefined || value === null || value === '') return fallback;
      if (typeof value === 'boolean') return `${fallback}: ${value ? 'yes' : 'no'}`;
      return String(value);
    },

    isConnectionTool(tool) {
      return this.connectionToolTypes.includes(tool);
    },

isElementTool(tool) {
      return this.elementToolTypes.includes(tool);
    },

alignElementsToGrid() {
      if (!this.snapToGrid) return;
      this.setElements(this.elements.map(el => {
        const snapped = this.snapCoordinates(el.x, el.y);
        return {...el, x: snapped.x, y: snapped.y};
      }));
      this.updateConnections();
    },

selectTool(toolType) {
      if (!this.accessPolicy.canWrite && toolType !== 'select') {
        this.currentTool = 'select';
        return;
      }
      this.currentTool = toolType;
      this.connectionStart = null;
      this.isConnecting = false;
      this.selectedElement = null;
    },

getElementShape(type) {
        const preset = this.getElementPreset(type);
        if (preset?.shape) return preset.shape;
        
        const activityShapes = {
            'initial': 'circle',
            'final': 'double-circle',
            'activity': 'roundrect',
            'decision': 'diamond',
            'merge': 'diamond',
            'fork': 'rect',
            'join': 'rect',
            'send_signal': 'pentagon',
            'receive_signal': 'pentagon',
            'actor': 'actor'  // Р”РѕР±Р°РІР»СЏРµРј
        };
        
        return activityShapes[type] || 'rect';
    },

getElementStyle(element) {
      const preset = this.getElementPreset(element.type);
      const shape = preset?.shape || 'rect';

      const bgColor = element.customColor || preset?.color || '#95a5a6';
      const borderBase = element.customBorder || preset?.border || '#2c3e50';

      const borderColor = this.selectedElement?.id === element.id
        ? '#e74c3c'
        : this.connectionStart?.id === element.id
          ? '#f39c12'
          : borderBase;

      // Р‘Р°Р·РѕРІС‹Р№ СЃС‚РёР»СЊ
      const style = {
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        background: bgColor,
        color: preset?.textColor || '#ffffff',
        border: `2px solid ${borderColor}`,
      };

      // РЎРїРµС†РёР°Р»СЊРЅС‹Рµ С„РѕСЂРјС‹
      if (shape === 'actor') {
          // Р”Р»СЏ Р°РєС‚РѕСЂР° СѓР±РёСЂР°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅС‹Рµ СЃС‚РёР»Рё
          style.background = 'transparent';
          style.border = 'none';
          style.boxShadow = 'none';
      }
      if (shape === 'custom') {
        style.background = 'transparent';
        style.border = 'none';
        style.boxShadow = 'none';
      }
      if (shape === 'ellipse') {
        style.borderRadius = '50%';
      } else if (shape === 'roundrect') {
        style.borderRadius = '20px';
      } else if (shape === 'diamond') {
        // РџСЂРµРІСЂР°С‰Р°РµРј РІ СЂРѕРјР± С‡РµСЂРµР· С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёСЋ
      style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      style.width = `${element.width}px`;
      style.height = `${element.height}px`;
      style.display = 'flex';
      style.flexDirection = 'column';
      style.alignItems = 'center';
      style.justifyContent = 'center';
      } else if (shape === 'bar') {
        // РўРѕР»СЃС‚Р°СЏ Р»РёРЅРёСЏ РґР»СЏ fork/join
        style.borderRadius = '0';
        style.height = `${element.height}px`;
        style.width = `${element.width}px`;
      } else if (shape === 'pentagon') {
        // РџСЏС‚РёСѓРіРѕР»СЊРЅРёРє РґР»СЏ СЃРёРіРЅР°Р»РѕРІ
        style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
      } else if (shape === 'double-circle') {
        // Р”РІРѕР№РЅРѕР№ РєСЂСѓРі РґР»СЏ РєРѕРЅРµС‡РЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ
        style.borderRadius = '50%';
        style.boxShadow = `inset 0 0 0 4px ${borderColor}`;
      } else {
        style.borderRadius = '10px';
      }

      if (this.dragElement?.id === element.id) {
        style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
        style.zIndex = '1000';
      }

      return style;
    },

snapCoordinates(x, y) {
      const rawX = Number(x);
      const rawY = Number(y);
      if (Number.isNaN(rawX) || Number.isNaN(rawY)) {
        return {x: 0, y: 0};
      }

      if (!this.snapToGrid) {
        return {x: rawX, y: rawY};
      }

      const snappedX = Math.round(rawX / this.gridSize) * this.gridSize;
      const snappedY = Math.round(rawY / this.gridSize) * this.gridSize;

      if (snappedX !== rawX || snappedY !== rawY) {
        console.log(`Snapped: (${rawX}, ${rawY}) в†’ (${snappedX}, ${snappedY})`);
      }

      return { x: snappedX, y: snappedY };
    },

handleGlobalMouseMove(event) {
      const hasActiveDrag =
        Boolean(this.isDragging && this.dragElement) ||
        Boolean(this.isMultiSelectDragging && this.selectedElements.length > 0) ||
        Boolean(this.resizingElement) ||
        Boolean(this.draggingBendPoint.connId) ||
        Boolean(this.draggingEndpoint.connId) ||
        Boolean(this.isPanning);
      if (!hasActiveDrag) return;
      this.handleMouseMove(event);
    },

handleGlobalMouseUp(event) {
      // Р“Р°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РѕСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ, РґР°Р¶Рµ РµСЃР»Рё РјС‹С€СЊ РІС‹С€Р»Р° Р·Р° РїСЂРµРґРµР»С‹ РєРѕРјРїРѕРЅРµРЅС‚Р°
      if (this.isDragging) {
        console.log('Global mouse up - stopping drag');
        this.isDragging = false;
        this.dragElement = null;
      }

      if (this.isPanning) {
        this.isPanning = false;
      }

      if (this.draggingBendPoint.connId) {
        if (!this.bendPointPress.moved && this.bendPointPress.connId) {
          const conn = this.connections.find((c) => c.id === this.bendPointPress.connId);
          const pointIndex = this.bendPointPress.pointIndex;
          const pt = conn?.points?.[pointIndex];
          if (conn && pt && pointIndex > 0 && pointIndex < conn.points.length - 1) {
            this.bendPointDialog = {
              visible: true,
              connId: conn.id,
              pointIndex,
              label: String(pt.label || ''),
            };
          }
        } else if (this.bendPointPress.moved) {
          // Do not keep bend point highlighted after drag-stop.
          this.selectedBendPoint = { connId: null, pointIndex: null };
        }
        this.draggingBendPoint = { connId: null, pointIndex: null };
      }
      this.bendPointPress = {
        connId: null,
        pointIndex: null,
        startClientX: 0,
        startClientY: 0,
        moved: false,
      };
      if (this.draggingEndpoint.connId) {
        this.draggingEndpoint = { connId: null, which: null };
      }

      // РќР• РѕС‚РјРµРЅСЏРµРј СЂРµР¶РёРј СЃРѕРµРґРёРЅРµРЅРёСЏ РїСЂРё РіР»РѕР±Р°Р»СЊРЅРѕРј mouseup,
      // С‚Р°Рє РєР°Рє РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РјРѕР¶РµС‚ РєР»РёРєР°С‚СЊ РЅР° СЌР»РµРјРµРЅС‚С‹ РґР»СЏ СЃРѕР·РґР°РЅРёСЏ СЃРІСЏР·Рё
      // Р РµР¶РёРј СЃРѕРµРґРёРЅРµРЅРёСЏ РѕС‚РјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ:
      // 1. РџСЂРё РєР»РёРєРµ РЅР° РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ (РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РІ handleCanvasClick)
      // 2. РџСЂРё СѓСЃРїРµС€РЅРѕРј СЃРѕР·РґР°РЅРёРё СЃРІСЏР·Рё (РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РІ createConnection)
    },

handleCanvasClick(event) {
      // Ignore clicks right after drag or selection box
      if (this.justInteracted) {
        this.justInteracted = false;
        return;
      }

      if (this.currentTool === 'select' || this.currentTool === 'delete' || !this.accessPolicy.canWrite) {
        this.deselectAll();
        return;
      }

      if (this.isPanning) return;
      if (!this.currentTool) return;

      const {x, y} = this.getCanvasCoords(event);
      const clickedElement = this.getElementAtPosition(x, y);

      if (clickedElement) return; // click handled by element click

      // Only cancel connection mode if clicking empty space
      if (this.isConnectionTool(this.currentTool)) {
        this.connectionStart = null;
        this.isConnecting = false;
        this.currentTool = this.defaultToolForDiagram();
      } else {
        this.createElement(this.currentTool, x, y);
      }
    },

handleElementClick(element, event) {
      // Ignore clicks right after drag (prevents deselection)
      if (this.justInteracted) {
        this.justInteracted = false;
        if (!this.isConnectionTool(this.currentTool) && this.currentTool !== 'delete') {
          return;
        }
      }

      // 1. Connection tool has highest priority
      if (this.isConnectionTool(this.currentTool)) {
        if (!this.accessPolicy.canWrite) return;
        this.handleConnectionTarget(element);
        return;
      }

      // 2. Delete tool
      if (this.currentTool === 'delete') {
        if (!this.accessPolicy.canWrite) return;
        this.deleteElement(element);
        return;
      }

      // 3. Normal selection (only if not connection tool)
      this.selectElement(element, event);
    },

deleteElement(element) {
      if (!this.canMutateDiagram('Удаление элемента')) return;
      if (confirm(`Delete "${element.text}" and all linked connections?`)) {
        this.setConnections(this.connections.filter(
            c => c.from !== element.id && c.to !== element.id
        ));
        this.setElements(this.elements.filter(el => el.id !== element.id));
        this.selectedElements = this.selectedElements.filter((el) => el.id !== element.id);
        if (this.selectedElement?.id === element.id) {
          this.selectedElement = null;
        }
        if (this.selectedElements.length === 0) {
          this.selectedElement = null;
        } else {
          this.selectedElement = this.selectedElements[0] || null;
        }
      }
    },

handleConnectionMode(x, y) {
      if (!this.isConnectionTool(this.currentTool)) return;

      const clickedElement = this.getElementAtPosition(x, y);
      this.handleConnectionTarget(clickedElement);
    },

handleConnectionTarget(clickedElement) {
      if (!this.accessPolicy.canWrite) return;
      if (!this.isConnectionTool(this.currentTool)) return;

      if (!clickedElement) {
        this.connectionStart = null;
        this.isConnecting = false;
        return;
      }

      if (!this.connectionStart) {
        // First click: select starting element
        this.connectionStart = clickedElement;
        this.isConnecting = true;
        this.selectedElements = [];
        this.selectedElement = null;
        this.selectedConnection = null;
        console.log('Connection start:', clickedElement.text);
      } else if (this.connectionStart.id !== clickedElement.id) {
        // Second click: try to create connection
        const allowed = this.isConnectionAllowed(this.connectionStart, clickedElement, this.currentTool);
        if (allowed) {
          this.createConnection(this.connectionStart, clickedElement);
          console.log('Connection created:', this.currentTool);
        } else {
          this.showError(this.connectionRuleMessage(this.connectionStart, clickedElement, this.currentTool));
          console.warn('Connection blocked:', this.connectionRuleMessage(this.connectionStart, clickedElement, this.currentTool));
        }

        // Reset connection mode
        this.connectionStart = null;
        this.isConnecting = false;
      } else {
        // Clicked same element twice в†’ cancel
        this.connectionStart = null;
        this.isConnecting = false;
      }
    },

handleMouseDown(event) {
      // Middle button or Alt+click = pan
      if (event.button === 1 || event.altKey) {
        this.isPanning = true;
        this.panStart = { ...this.pan };
        this.pointerStart = { x: event.clientX, y: event.clientY };
        return;
      }

      const { x, y } = this.getCanvasCoords(event);
      const element = this.getElementAtPosition(x, y);

      if (!this.accessPolicy.canWrite) {
        if (!element && !event.shiftKey && this.currentTool === 'select') {
          this.selectionBoxStart = { x, y };
          this.selectionBox = { x, y, width: 0, height: 0 };
          this.deselectAll();
          this.justInteracted = true;
        } else if (element) {
          this.selectElement(element, event);
          this.justInteracted = true;
        }
        return;
      }

      // 1. Start selection box (only when tool = select, no element under cursor, no Shift)
      if (!element && !event.shiftKey && this.currentTool === 'select') {
        this.selectionBoxStart = { x, y };
        this.selectionBox = { x, y, width: 0, height: 0 };
        this.deselectAll(); // clear previous selection
        this.justInteracted = true;
        return;
      }

      // 2. Clicked on an element
      if (element && !this.isConnecting) {
        // If connection tool is active в†’ do NOT select or start drag, let handleElementClick handle it
        if (this.isConnectionTool(this.currentTool)) {
          // Do nothing here вЂ” connection will be handled in handleElementClick via @click
          return;
        }

        // Normal case: select tool or element tool в†’ handle selection and drag
        const alreadySelected = this.selectedElements.some(el => el.id === element.id);
        const hasMultiple = this.selectedElements.length > 1;

        // If clicking on already multi-selected element в†’ start group drag without changing selection
        if (hasMultiple && alreadySelected) {
          this.isMultiSelectDragging = true;
          const center = this.getSelectionCenter();
          this.multiDragOffset = { x: x - center.x, y: y - center.y };
          this.justInteracted = true;
          event.preventDefault();
          return;
        }

        // Otherwise: normal selection logic
        this.selectElement(element, event);

        // After selection вЂ” prepare drag (single or multi)
        if (this.selectedElements.length > 1) {
          this.isMultiSelectDragging = true;
          const center = this.getSelectionCenter();
          this.multiDragOffset = { x: x - center.x, y: y - center.y };
          this.justInteracted = true;
        } else {
          this.dragElement = element;
          this.dragOffset.x = x - element.x;
          this.dragOffset.y = y - element.y;
          this.isDragging = true;
          this.justInteracted = true;
        }

        event.preventDefault();
      }

      // 3. Clicked on empty space вЂ” handled by handleCanvasClick
    },

handleMouseMove(event) {
      this.autoScrollCanvasNearPointer(event);

      if (!this.accessPolicy.canWrite && !this.isPanning && !this.selectionBoxStart) return;

      // Drag bend point
      if (this.draggingBendPoint.connId && this.draggingBendPoint.pointIndex !== null) {
        const conn = this.connections.find(c => c.id === this.draggingBendPoint.connId);
        if (!conn || !Array.isArray(conn.points)) return;
        const movedDistance = Math.hypot(
          (event.clientX || 0) - (this.bendPointPress.startClientX || 0),
          (event.clientY || 0) - (this.bendPointPress.startClientY || 0),
        );
        if (movedDistance > 3) {
          this.bendPointPress.moved = true;
        }

        const { x, y } = this.getCanvasCoords(event);
        const raw = { x: x - this.bendPointDragOffset.x, y: y - this.bendPointDragOffset.y };
        const snapped = this.snapToGrid ? this.snapCoordinates(raw.x, raw.y) : raw;

        // update in-place to keep reactivity
        conn.points.splice(this.draggingBendPoint.pointIndex, 1, snapped);
        this.ensureCanvasCanFitPoint(snapped.x, snapped.y);
        return;
      }

      if (this.draggingEndpoint.connId && this.draggingEndpoint.which) {
        const conn = this.connections.find((c) => c.id === this.draggingEndpoint.connId);
        if (!conn) return;
        const movingFrom = this.draggingEndpoint.which === 'from';
        const element = this.elements.find((el) => el.id === (movingFrom ? conn.from : conn.to));
        if (!element) return;
        const point = this.getCanvasPointFromClient(event.clientX, event.clientY);
        const anchor = this.projectPointToElementPerimeter(element, point);
        const properties = { ...(conn.properties || {}) };
        if (movingFrom) properties.fromAnchor = anchor;
        else properties.toAnchor = anchor;
        this.setConnections(this.connections.map((item) => item.id === conn.id ? { ...item, properties } : item));
        this.updateConnections();
        return;
      }

      if (this.resizingElement) {
        const {x, y} = this.getCanvasCoords(event);
        const deltaX = x - this.resizeStart.x;
        const deltaY = y - this.resizeStart.y;

        const newWidth = Math.max(40, this.resizeStart.width + deltaX);
        const newHeight = Math.max(30, this.resizeStart.height + deltaY);

        const snappedW = this.snapToGrid ? Math.round(newWidth / this.gridSize) * this.gridSize : newWidth;
        const snappedH = this.snapToGrid ? Math.round(newHeight / this.gridSize) * this.gridSize : newHeight;

        this.resizingElement.width = snappedW;
        this.resizingElement.height = snappedH;
        this.ensureCanvasCanFitPoint(this.resizingElement.x + snappedW, this.resizingElement.y + snappedH);
        this.updateConnections();
        return;
      }

      // Selection box update
      if (this.selectionBoxStart) {
        const { x, y } = this.getCanvasCoords(event);
        const start = this.selectionBoxStart;
        this.selectionBox = {
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          width: Math.abs(x - start.x),
          height: Math.abs(y - start.y)
        };
        this.updateSelectionFromBox();
        return;
      }

      // Multi-select group drag
      if (this.isMultiSelectDragging && this.selectedElements.length > 1) {
          const { x, y } = this.getCanvasCoords(event);
          const center = this.getSelectionCenter();
          const deltaX = x - center.x - this.multiDragOffset.x;
          const deltaY = y - center.y - this.multiDragOffset.y;

          // Move selected elements
          this.selectedElements.forEach(el => {
            const snapped = this.snapCoordinates(el.x + deltaX, el.y + deltaY);
            el.x = snapped.x;
            el.y = snapped.y;
            this.ensureCanvasCanFitPoint(snapped.x + (el.width || 0), snapped.y + (el.height || 0));
          });

          // === NEW: Rigidly move ALL points (including middle bend points) of connections where BOTH ends are selected ===
          this.connections.forEach(conn => {
            const fromSelected = this.selectedElements.some(el => el.id === conn.from);
            const toSelected = this.selectedElements.some(el => el.id === conn.to);

            // Only move the entire line if BOTH endpoints are in the selected group
            if (fromSelected && toSelected && Array.isArray(conn.points) && conn.points.length > 0) {
              conn.points = conn.points.map(pt => ({
                x: this.snapToGrid ? Math.round((pt.x + deltaX) / this.gridSize) * this.gridSize : pt.x + deltaX,
                y: this.snapToGrid ? Math.round((pt.y + deltaY) / this.gridSize) * this.gridSize : pt.y + deltaY
              }));
            }
          });

      }

      if (this.isPanning) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.pan.x = this.panStart.x + dx;
        this.pan.y = this.panStart.y + dy;
        return;
      }

      if (!this.isDragging || !this.dragElement) return;

      const {x, y} = this.getCanvasCoords(event);

      const newX = x - this.dragOffset.x;
      const newY = y - this.dragOffset.y;

      this.moveElement(this.dragElement.id, newX, newY);
      const moved = this.elements.find((el) => el.id === this.dragElement.id);
      if (moved) {
        this.ensureCanvasCanFitPoint(moved.x + (moved.width || 0), moved.y + (moved.height || 0));
      }

      this.updateConnections();
    },

handleMouseUp() {
      this.handleGlobalMouseUp(); // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј РІСЃРµ РґСЂР°РіРё

      // РќР• СЃР±СЂР°СЃС‹РІР°РµРј justInteracted Р·РґРµСЃСЊ!
      // РЎР±СЂР°СЃС‹РІР°РµРј РµРіРѕ Р§РЈРўР¬ РџРћР—Р–Р• вЂ” РїРѕСЃР»Рµ С‚РѕРіРѕ, РєР°Рє click-СЃРѕР±С‹С‚РёРµ СѓСЃРїРµРµС‚ РѕС‚СЂР°Р±РѕС‚Р°С‚СЊ

      if (this.resizingElement) {
        this.resizingElement = null;
      }
      if (this.isPanning) {
        this.isPanning = false;
      }
      if (this.selectionBoxStart) {
        this.selectionBoxStart = null;
        this.selectionBox = null;
      }
      if (this.isMultiSelectDragging) {
        this.isMultiSelectDragging = false;
      }

      // РЎР±СЂР°СЃС‹РІР°РµРј С„Р»Р°Рі СЃ РЅРµР±РѕР»СЊС€РѕР№ Р·Р°РґРµСЂР¶РєРѕР№ вЂ” РїРѕСЃР»Рµ С‚РѕРіРѕ, РєР°Рє click СѓР¶Рµ РѕС‚СЂР°Р±РѕС‚Р°РµС‚
      setTimeout(() => {
        this.justInteracted = false;
      }, 50);  // 50 РјСЃ РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ, С‡С‚РѕР±С‹ click РїСЂРѕС€С‘Р»
      this.queueLocalHistorySnapshot();
    },

getSelectionCenter() {
      if (this.selectedElements.length === 0) return { x: 0, y: 0 };
      const sum = this.selectedElements.reduce((acc, el) => ({
        x: acc.x + el.x + el.width / 2,
        y: acc.y + el.y + el.height / 2
      }), { x: 0, y: 0 });
      return {
        x: sum.x / this.selectedElements.length,
        y: sum.y / this.selectedElements.length
      };
    },

updateSelectionFromBox() {
      if (!this.selectionBox || this.selectionBox.width < 5) {
        return;
      }
      const box = this.selectionBox;
      const selected = this.elements.filter(el =>
          el.x + el.width > box.x &&
          el.x < box.x + box.width &&
          el.y + el.height > box.y &&
          el.y < box.y + box.height
      );
      this.selectedElements = selected;
      this.selectedElement = selected[0] || null;
    },

isElementSelected(element) {
      return this.selectedElements.some(el => el.id === element.id);
    },

moveElement(elementId, newX, newY) {
      const element = this.elements.find(el => el.id === elementId);
      if (element) {
        const snapped = this.snapCoordinates(newX, newY);
        element.x = snapped.x;
        element.y = snapped.y;
      }
    },

getElementAtPosition(x, y) {
      // РС‰РµРј СЃ РєРѕРЅС†Р°, С‡С‚РѕР±С‹ РІРµСЂС…РЅРёРµ СЌР»РµРјРµРЅС‚С‹ (РїРѕСЃР»РµРґРЅРёРµ РґРѕР±Р°РІР»РµРЅРЅС‹Рµ) Р±С‹Р»Рё РїСЂРёРѕСЂРёС‚РµС‚РЅРµРµ
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i];

        // Р‘С‹СЃС‚СЂР°СЏ РїСЂРѕРІРµСЂРєР°: РµСЃР»Рё РєРѕРѕСЂРґРёРЅР°С‚С‹ СЏРІРЅРѕ РІРЅРµ bounding box, РїСЂРѕРїСѓСЃРєР°РµРј
        if (x < element.x || x > element.x + element.width ||
            y < element.y || y > element.y + element.height) {
          continue;
        }

        const shape = this.getElementShape(element.type);

        if (shape === 'ellipse') {
          const cx = element.x + element.width / 2;
          const cy = element.y + element.height / 2;
          const a = element.width / 2;
          const b = element.height / 2;
          const normalized = Math.pow((x - cx) / a, 2) + Math.pow((y - cy) / b, 2);
          if (normalized <= 1) {
            return element;
          }
        } else if (shape === 'custom') {
          const raw = this.getElementPreset(element.type)?.svg_path || '';
          const xRatio = (x - element.x) / Math.max(1, Number(element.width) || 1);
          const yRatio = (y - element.y) / Math.max(1, Number(element.height) || 1);
          if (isPointInsideCustomShape(raw, xRatio, yRatio) || isPointNearCustomShapeStroke(raw, xRatio, yRatio)) {
            return element;
          }
        } else {
          return element;
        }
      }
      return null;
    },

deselectAll() {
      this.selectedElements = [];
      this.selectedElement = null;
      this.selectedConnection = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.selectionBox = null;
      this.bendEditMode = false;
    },

handleResizeMouseDown(element, event) {
      if (!this.accessPolicy.canWrite) return;
      this.resizingElement = element;
      const coords = this.getCanvasCoords(event);
      this.resizeStart = {
        x: coords.x,
        y: coords.y,
        width: element.width,
        height: element.height
      };
    },

getCanvasCoords(event) {
      const canvasEl = this.$el.querySelector('.canvas');
      const canvasRect = (canvasEl || event.currentTarget).getBoundingClientRect();      return {
        x: (event.clientX - canvasRect.left - this.pan.x) / this.zoom,
        y: (event.clientY - canvasRect.top - this.pan.y) / this.zoom
      };
    },

getCanvasPointFromClient(clientX, clientY) {
      const canvasEl = this.$el.querySelector('.canvas');
      if (!canvasEl) return {x: 0, y: 0};
      const rect = canvasEl.getBoundingClientRect();      return {
        x: (clientX - rect.left - this.pan.x) / this.zoom,
        y: (clientY - rect.top - this.pan.y) / this.zoom
      };
    },

autoScrollCanvasNearPointer(event) {
      const canvasEl = this.$el?.querySelector('.canvas');
      if (!canvasEl || !event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;

      const inDragMode =
        Boolean(this.isDragging && this.dragElement) ||
        Boolean(this.isMultiSelectDragging && this.selectedElements.length > 0) ||
        Boolean(this.resizingElement) ||
        Boolean(this.draggingBendPoint.connId) ||
        Boolean(this.draggingEndpoint.connId);
      if (!inDragMode) return;

      const edge = 28;
      const step = 22;
      const rect = canvasEl.getBoundingClientRect();
      if (event.clientX >= rect.right - edge) this.pan.x -= step;
      if (event.clientX <= rect.left + edge) this.pan.x += step;
      if (event.clientY >= rect.bottom - edge) this.pan.y -= step;
      if (event.clientY <= rect.top + edge) this.pan.y += step;
    },

selectElement(element, event = { shiftKey: false }) {
      if (this.isConnecting) return;

      if (event.shiftKey) {
        const already = this.selectedElements.some(el => el.id === element.id);
        if (already) {
          this.selectedElements = this.selectedElements.filter(el => el.id !== element.id);
        } else {
          this.selectedElements = [...this.selectedElements, element];
        }
      } else {
        this.selectedElements = [element];
      }

      this.selectedElement = this.selectedElements[0] || null;
      this.selectedConnection = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.bendEditMode = false;
    },
};
