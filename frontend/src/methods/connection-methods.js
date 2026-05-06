import { findBestSegmentIndex, toggleBendPointPoints } from '../utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError } from '../services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { BUILTIN_DIAGRAM_TYPE_IDS } from '../app-constants.js';
import { getCustomShapeBoundaryTowards, getCustomShapeNearestBoundary, parseCustomShapeData } from '../utils/customShape.js';

export const connectionMethods = {
deleteConnection(connection) {
      if (!this.canMutateDiagram('Удаление связи')) return;
      if (confirm('Delete this connection?')) {
        this.setConnections(this.connections.filter(c => c.id !== connection.id));
        this.selectedConnection = null;
        this.selectedBendPoint = { connId: null, pointIndex: null };
      }
    },

getConnectionColor(connectionType) {
      if (this.customConnectionTypes.length > 0) {
        const custom = this.customConnectionTypes.find((item) => item.key === connectionType);
        if (custom?.color) return custom.color;
      }
      const preset = this.connectionPresets.find(p => p.type === connectionType);
      return preset?.color || '#34495e';
    },

getConnectionDash(connectionType) {
      if (this.customConnectionTypes.length > 0) {
        const custom = this.customConnectionTypes.find((item) => item.key === connectionType);
        if (typeof custom?.dash === 'string') return custom.dash;
      }
      const preset = this.connectionPresets.find(p => p.type === connectionType);
      return preset?.dash || '';
    },

getMarkerId(conn) {
      if (!conn) return 'arrow-default';
      
      // Р”Р»СЏ СЂР°Р·РЅС‹С… С‚РёРїРѕРІ СЃРІСЏР·РµР№ СЂР°Р·РЅС‹Рµ РјР°СЂРєРµСЂС‹
      switch(conn.type) {
        case 'inheritance':
        case 'realization':
          return 'arrow-empty';
        case 'composition':
          return 'arrow-filled-diamond';
        case 'aggregation':
          return 'arrow-empty-diamond';
        case 'dependency':
          return 'arrow-dashed';
        case 'extend':
        case 'include':
          return 'arrow-dashed';
        default:
          return conn?.id ? `arrow-${conn.id}` : 'arrow-default';
      }
    },

updateConnections() {
      this.setConnections(this.connections.map(conn => {
        const endpoints = this.getConnectionEndpoints(conn);
        if (!endpoints) return conn;
        const { start, end } = endpoints;

        let points = Array.isArray(conn.points) ? conn.points.slice() : [];

        if (points.length < 2) {
          points = [start, end];
        } else {
          // ONLY update first and last point вЂ” preserve all manual middle bend points
          points[0] = start;
          points[points.length - 1] = end;
        }

        return { ...conn, points };
      }));
    },

isClassLike(element) {
      return ['class', 'interface', 'enum', 'component', 'database', 'package', 'note'].includes(element?.type);
    },

isUseCaseElement(element) {
      return ['actor', 'usecase', 'note', 'package'].includes(element?.type);
    },

isActivityElement(element) {
      const activityTypes = [
        'initial', 'final', 'activity', 'decision', 'merge', 
        'fork', 'join', 'send_signal', 'receive_signal'
      ];
      return activityTypes.includes(element?.type);
    },

isStructuralElement(element) {
      return ['class', 'interface', 'enum', 'component', 'database', 'package', 'note'].includes(element?.type);
    },

resolveElementTypeId(element) {
      if (!element) return null;
      if (element.element_type_id) return element.element_type_id;
      const presetId = this.getElementPreset(element.type)?.element_type_id;
      if (presetId) return presetId;
      return this.customElementTypes.find((item) => item.key === element.type || item.name === element.type)?.id || null;
    },

resolveConnectionTypeId(connectionType) {
      return this.customConnectionTypes.find((item) => item.key === connectionType || item.name === connectionType)?.id || null;
    },

isConnectionAllowed(fromElement, toElement, connectionType) {
      if (!fromElement || !toElement || fromElement.id === toElement.id) return false;
      if (this.currentDiagramTypeEntity?.is_free_mode || this.diagramType === 'free_mode') return true;

      if (this.currentDiagramTypeId && this.customElementTypes.length > 0 && this.customConnectionTypes.length > 0) {
        const fromElementTypeId = this.resolveElementTypeId(fromElement);
        const toElementTypeId = this.resolveElementTypeId(toElement);
        const connectionTypeId = this.resolveConnectionTypeId(connectionType);

        if (!fromElementTypeId || !toElementTypeId || !connectionTypeId) return true;

        return isConnectionAllowedByMatrix({
          matrix: this.rulesMatrix,
          fromElementTypeId,
          toElementTypeId,
          connectionTypeId,
          isFreeMode: Boolean(this.currentDiagramTypeEntity?.is_free_mode),
        });
      }

      const fromType = fromElement.type;
      const toType = toElement.type;

      // Helper sets
      const classLike = ['class', 'interface', 'enum', 'component', 'database'];
      const structural = [...classLike, 'package', 'note'];
      const usecaseLike = ['usecase'];
      const actorLike = ['actor'];
      const ucElements = [...usecaseLike, ...actorLike, 'package', 'note'];
      const activityElements = ['initial', 'final', 'activity', 'decision', 'merge', 'fork', 'join', 'send_signal', 'receive_signal'];

      if (this.diagramType === 'class') {
        // All elements must be valid for class diagram
        if (!structural.includes(fromType) || !structural.includes(toType)) return false;

        // Note can only have association or dependency
        if (fromType === 'note' || toType === 'note') {
          return ['association', 'dependency'].includes(connectionType);
        }

        // Package can have any connection
        if (fromType === 'package' || toType === 'package') {
          return true; // all types allowed with package
        }

        switch (connectionType) {
          case 'association':
          case 'dependency':
            return true; // allowed between any structural
          case 'inheritance':
          case 'composition':
          case 'aggregation':
            return classLike.includes(fromType) && classLike.includes(toType);
          case 'realization':
            return classLike.includes(fromType) && toType === 'interface';
          default:
            return false;
        }
      }

      if (this.diagramType === 'use_case') {
        if (!ucElements.includes(fromType) || !ucElements.includes(toType)) return false;

        // Actor cannot connect to another Actor
        if (fromType === 'actor' && toType === 'actor') return false;

        // Note only association/dependency
        if (fromType === 'note' || toType === 'note') {
          return ['association', 'dependency'].includes(connectionType);
        }

        // Extend and Include only between usecase
        if (connectionType === 'extend' || connectionType === 'include') {
          return fromType === 'usecase' && toType === 'usecase';
        }

        // Association and Dependency allowed everywhere (except actor-actor)
        if (connectionType === 'association' || connectionType === 'dependency') {
          return true;
        }

        return false;
      }

      if (this.diagramType === 'activity_diagram') {
        if (!activityElements.includes(fromType) || !activityElements.includes(toType)) return false;

        // Final node cannot have outgoing connections
        if (fromType === 'final') return false;

        // Control Flow and Object Flow allowed between any activity elements
        return ['control_flow', 'object_flow'].includes(connectionType);
      }

      return false;
    },

connectionRuleMessage(fromElement, toElement, connectionType) {
      const from = fromElement.text || fromElement.type;
      const to = toElement.text || toElement.type;

      if (this.currentDiagramTypeId && this.customElementTypes.length > 0 && this.customConnectionTypes.length > 0) {
        return `Connection "${connectionType}" from "${from}" to "${to}" is blocked by the selected rules matrix.`;
      }

      if (this.diagramType === 'class') {
        if (fromElement.type === 'note' || toElement.type === 'note') {
          return 'A note can be connected only by Association or Dependency.';
        }
        if (connectionType === 'realization') {
          return 'Realization is allowed only from Class to Interface.';
        }
        if (['inheritance', 'composition', 'aggregation'].includes(connectionType)) {
          return `${connectionType} is allowed only between structural class-diagram elements.`;
        }
        return `Connection type "${connectionType}" is not allowed for these class-diagram elements.`;
      }

      if (this.diagramType === 'use_case') {
        if (fromElement.type === 'actor' && toElement.type === 'actor') {
          return 'Actor-to-actor connections are not allowed.';
        }
        if (fromElement.type === 'note' || toElement.type === 'note') {
          return 'A note can be connected only by Association or Dependency.';
        }
        if (['extend', 'include'].includes(connectionType)) {
          return `"${connectionType}" is allowed only between Use Case elements.`;
        }
        return `This connection type is not allowed in Use Case diagram for selected elements.`;
      }

      if (this.diagramType === 'activity_diagram') {
        if (fromElement.type === 'final') {
          return 'Final node cannot have outgoing connections.';
        }
        return 'This connection type is not allowed in Activity diagram for selected elements.';
      }

      return `Connection "${connectionType}" from "${from}" to "${to}" is not allowed in current diagram.`;
    },

createConnection(fromElement, toElement) {
      if (!this.canMutateDiagram('Создание связи')) return;
      console.log('Creating connection from:', fromElement, 'to:', toElement);

      if (!this.isConnectionAllowed(fromElement, toElement, this.currentTool)) {
        const message = this.connectionRuleMessage(fromElement, toElement, this.currentTool);
        this.showError(message);
        return;
      }

      const rawStart = this.getAnchorPoint(fromElement, toElement);
      const rawEnd = this.getAnchorPoint(toElement, fromElement);
      const fromAnchor = this.projectPointToElementPerimeter(fromElement, rawStart);
      const toAnchor = this.projectPointToElementPerimeter(toElement, rawEnd);
      const start = this.getPointFromAnchor(fromElement, fromAnchor);
      const end = this.getPointFromAnchor(toElement, toAnchor);
      const mid = this.getDefaultMidpoint(start, end);
      const connection = {
        id: this.generateId(),
        from: fromElement.id,
        to: toElement.id,
        type: this.currentTool,
        connection_type_id: this.resolveConnectionTypeId(this.currentTool),
        label: '',
        points: [start, mid, end],
        customColor: null,
        customDash: null,
        strokeWidth: 2,
        labelColor: '#2c3e50',
        labelFontSize: 12,
        rule_violation: false,
        properties: {
          fromAnchor,
          toAnchor,
        },
      };
      this.setConnections([...this.connections, connection]);
      this.selectedConnection = this.resolveLiveConnection(connection.id) || connection;
      this.pushLocalHistorySnapshot();
    },

selectConnection(conn) {
      this.selectedConnection = conn;
      this.selectedElement = null;
      this.selectedElements = [];
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.bendPointDialog.visible = false;
      if (this.currentTool !== 'select' && !this.isConnectionTool(this.currentTool) && this.currentTool !== 'delete') {
        this.currentTool = 'select';
      }
    },

hasBendPoints(conn) {
      return Array.isArray(conn?.points) && conn.points.length > 2;
    },

handleConnectionClick(conn, event) {
      this.selectConnection(conn);
    },

resolveLiveConnection(connOrId) {
      const id = typeof connOrId === 'string' ? connOrId : connOrId?.id;
      if (!id) return null;
      return this.connections.find((item) => item.id === id) || null;
    },

addSelectedConnectionBendPoint() {
      const liveConn = this.resolveLiveConnection(this.selectedConnection);
      if (!liveConn) return;
      this.addBendPointAtMidpoint(liveConn);
    },

handleBendPointMouseDown(conn, pointIndex, event) {
      if (!conn || !Array.isArray(conn.points)) return;
      if (!this.accessPolicy.canWrite) {
        this.selectConnection(conn);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        this.removeBendPoint(conn, pointIndex);
        return;
      }
      const pt = conn.points[pointIndex];
      if (!pt) return;

      this.selectedConnection = conn;
      this.selectedElement = null;
      this.selectedBendPoint = { connId: conn.id, pointIndex };
      this.draggingBendPoint = { connId: conn.id, pointIndex };
      this.bendEditMode = true;
      this.justInteracted = true;
      this.bendPointPress = {
        connId: conn.id,
        pointIndex,
        startClientX: event.clientX || 0,
        startClientY: event.clientY || 0,
        moved: false,
      };

      const { x, y } = this.getCanvasCoords(event);
      this.bendPointDragOffset = { x: x - pt.x, y: y - pt.y };

      // stop element dragging if any
      this.isDragging = false;
      this.dragElement = null;
    },

saveBendPointDialog() {
      if (!this.accessPolicy.canWrite) return;
      const { connId, pointIndex, label } = this.bendPointDialog;
      if (!connId && connId !== 0) return;
      this.setConnections(this.connections.map((conn) => {
        if (conn.id !== connId || !Array.isArray(conn.points) || !conn.points[pointIndex]) return conn;
        const points = conn.points.slice();
        points[pointIndex] = { ...points[pointIndex], label: label || '' };
        return { ...conn, points };
      }));
      this.bendPointDialog.visible = false;
    },

deleteBendPointFromDialog() {
      if (!this.accessPolicy.canWrite) return;
      const { connId, pointIndex } = this.bendPointDialog;
      const conn = this.connections.find((c) => c.id === connId);
      if (conn) this.removeBendPoint(conn, pointIndex);
      this.bendPointDialog.visible = false;
    },

startEndpointDrag(conn, which) {
      if (!conn) return;
      if (!this.accessPolicy.canWrite) return;
      this.selectedConnection = conn;
      this.selectedElement = null;
      this.draggingEndpoint = { connId: conn.id, which };
      this.bendEditMode = true;
      this.justInteracted = true;
    },

projectPointToElementPerimeter(element, point) {
      const x = Number(element.x) || 0;
      const y = Number(element.y) || 0;
      const width = Math.max(1, Number(element.width) || 1);
      const height = Math.max(1, Number(element.height) || 1);
      const shape = this.getElementShape(element.type);

      if (shape === 'custom') {
        const raw = this.getElementPreset(element.type)?.svg_path || '';
        const xRatio = (point.x - x) / width;
        const yRatio = (point.y - y) / height;
        const nearest = getCustomShapeNearestBoundary(raw, xRatio, yRatio);
        return {
          kind: 'custom',
          xRatio: nearest.xRatio,
          yRatio: nearest.yRatio,
        };
      }

      const localX = Math.min(width, Math.max(0, point.x - x));
      const localY = Math.min(height, Math.max(0, point.y - y));
      const dxLeft = Math.abs(localX);
      const dxRight = Math.abs(width - localX);
      const dyTop = Math.abs(localY);
      const dyBottom = Math.abs(height - localY);
      const min = Math.min(dxLeft, dxRight, dyTop, dyBottom);
      if (min === dxLeft) return { side: 'left', t: Math.min(1, Math.max(0, localY / height)) };
      if (min === dxRight) return { side: 'right', t: Math.min(1, Math.max(0, localY / height)) };
      if (min === dyTop) return { side: 'top', t: Math.min(1, Math.max(0, localX / width)) };
      return { side: 'bottom', t: Math.min(1, Math.max(0, localX / width)) };
    },

getPointFromAnchor(element, anchor) {
      const x = Number(element.x) || 0;
      const y = Number(element.y) || 0;
      const width = Math.max(1, Number(element.width) || 1);
      const height = Math.max(1, Number(element.height) || 1);

      if (anchor?.kind === 'custom') {
        const xRatio = Math.max(0, Math.min(1, Number(anchor.xRatio) || 0.5));
        const yRatio = Math.max(0, Math.min(1, Number(anchor.yRatio) || 0.5));
        return {
          x: x + width * xRatio,
          y: y + height * yRatio,
        };
      }

      if (!anchor || !anchor.side) {
        return { x: x + width / 2, y: y + height / 2 };
      }
      const t = Math.min(1, Math.max(0, Number(anchor.t) || 0));
      if (anchor.side === 'left') return { x, y: y + height * t };
      if (anchor.side === 'right') return { x: x + width, y: y + height * t };
      if (anchor.side === 'top') return { x: x + width * t, y };
      return { x: x + width * t, y: y + height };
    },

getConnectionEndpoints(conn) {
      const fromElement = this.elements.find((el) => el.id === conn.from);
      const toElement = this.elements.find((el) => el.id === conn.to);
      if (!fromElement || !toElement) return null;
      const fromAnchor = conn.properties?.fromAnchor || null;
      const toAnchor = conn.properties?.toAnchor || null;
      const start = fromAnchor ? this.getPointFromAnchor(fromElement, fromAnchor) : this.getAnchorPoint(fromElement, toElement);
      const end = toAnchor ? this.getPointFromAnchor(toElement, toAnchor) : this.getAnchorPoint(toElement, fromElement);
      return { start, end };
    },

removeBendPoint(conn, pointIndex) {
      if (!conn || !Array.isArray(conn.points)) return;
      if (!this.canMutateDiagram('Изменение точки изгиба')) return;
      if (pointIndex <= 0 || pointIndex >= conn.points.length - 1) return;
      const points = conn.points.slice();
      points.splice(pointIndex, 1);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points} : c));
      if (this.selectedBendPoint.connId === conn.id) {
        if (this.selectedBendPoint.pointIndex === pointIndex) {
          this.selectedBendPoint = { connId: null, pointIndex: null };
        } else if (this.selectedBendPoint.pointIndex > pointIndex) {
          this.selectedBendPoint = {
            connId: conn.id,
            pointIndex: this.selectedBendPoint.pointIndex - 1
          };
        }
      }
    },

removeLastBendPoint(conn) {
      if (!conn || !Array.isArray(conn.points)) return;
      if (conn.points.length <= 2) return;
      const points = conn.points.slice();
      points.splice(points.length - 2, 1);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points} : c));
      if (this.selectedBendPoint.connId === conn.id && this.selectedBendPoint.pointIndex >= points.length - 1) {
        this.selectedBendPoint = { connId: null, pointIndex: null };
      }
      this.bendEditMode = this.hasBendPoints({ ...conn, points });
    },

removeSelectedBendPoint() {
      if (!this.selectedBendPoint.connId) return;
      const conn = this.connections.find(c => c.id === this.selectedBendPoint.connId);
      if (!conn) return;
      this.removeBendPoint(conn, this.selectedBendPoint.pointIndex);
    },

normalizeConnectionPoints(conn) {
      const endpoints = this.getConnectionEndpoints(conn);
      if (!endpoints) return [];
      const { start, end } = endpoints;
      const middle = Array.isArray(conn.points) ? conn.points.slice(1, -1) : [];
      return [start, ...middle, end];
    },

projectPointToSegment(point, a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx === 0 && dy === 0) return { x: a.x, y: a.y };
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
      return {
        x: a.x + t * dx,
        y: a.y + t * dy,
      };
    },

addBendPoint(conn, event) {
      if (!this.canMutateDiagram('Изменение точки изгиба')) return;
      const point = this.getCanvasPointFromClient(event.clientX, event.clientY);
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const bestIndex = findBestSegmentIndex(points, point);
      const projected = this.projectPointToSegment(point, points[bestIndex], points[bestIndex + 1]);
      points.splice(bestIndex + 1, 0, projected);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points} : c));
      this.bendEditMode = true;
    },

toggleBendPoint(conn, event) {
      if (!this.canMutateDiagram('Изменение точки изгиба')) return;
      const point = this.getCanvasPointFromClient(event.clientX, event.clientY);
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const result = toggleBendPointPoints(points, point, this.zoom);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points: result.points} : c));
      if (this.selectedBendPoint.connId === conn.id) {
        if (result.removedIndex !== -1) {
          if (this.selectedBendPoint.pointIndex === result.removedIndex) {
            this.selectedBendPoint = { connId: null, pointIndex: null };
          } else if (this.selectedBendPoint.pointIndex > result.removedIndex) {
            this.selectedBendPoint = {
              connId: conn.id,
              pointIndex: this.selectedBendPoint.pointIndex - 1
            };
          }
        } else if (result.addedIndex !== -1 && this.selectedBendPoint.pointIndex >= result.addedIndex) {
          this.selectedBendPoint = {
            connId: conn.id,
            pointIndex: this.selectedBendPoint.pointIndex + 1
          };
        }
      }
    },

addBendPointAtMidpoint(conn) {
      if (!this.canMutateDiagram('Изменение точки изгиба')) return;
      const liveConn = this.resolveLiveConnection(conn) || this.resolveLiveConnection(this.selectedConnection);
      if (!liveConn) return;
      const points = this.normalizeConnectionPoints(liveConn);
      if (points.length < 2) return;
      const segments = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        segments.push({ i, len, a, b });
      }
      segments.sort((x, y) => y.len - x.len);

      const minGap = Math.max(3, this.gridSize * 0.35);
      let insertedIndex = -1;
      let insertedPoint = null;
      for (const seg of segments) {
        const candidate = {
          x: (seg.a.x + seg.b.x) / 2,
          y: (seg.a.y + seg.b.y) / 2,
        };
        const tooClose = points.some((pt) => Math.hypot(pt.x - candidate.x, pt.y - candidate.y) < minGap);
        if (tooClose) continue;
        insertedIndex = seg.i + 1;
        insertedPoint = candidate;
        break;
      }

      if (insertedIndex === -1) {
        const segIndex = this.findLongestSegmentIndex(points);
        const a = points[segIndex];
        const b = points[segIndex + 1];
        insertedIndex = segIndex + 1;
        insertedPoint = {
          x: (a.x + b.x) / 2 + ((Math.random() - 0.5) * Math.max(2, this.gridSize * 0.2)),
          y: (a.y + b.y) / 2 + ((Math.random() - 0.5) * Math.max(2, this.gridSize * 0.2)),
        };
      }

      points.splice(insertedIndex, 0, insertedPoint);
      this.setConnections(this.connections.map(c => c.id === liveConn.id ? {...c, points} : c));
      this.selectedConnection = this.resolveLiveConnection(liveConn.id);
      this.selectedBendPoint = { connId: liveConn.id, pointIndex: insertedIndex };
      this.bendEditMode = true;
    },

clearBendPoints(conn) {
      if (!this.canMutateDiagram('Изменение точек изгиба')) return;
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const trimmed = [points[0], points[points.length - 1]];
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points: trimmed} : c));
      if (this.selectedBendPoint.connId === conn.id) {
        this.selectedBendPoint = { connId: null, pointIndex: null };
      }
      this.bendEditMode = false;
    },

findLongestSegmentIndex(points) {
      let bestIdx = 0;
      let bestLen = -1;
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > bestLen) {
          bestLen = len;
          bestIdx = i;
        }
      }
      return bestIdx;
    },

getDefaultMidpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    },

getConnectionPath(conn) {
      const pts = Array.isArray(conn?.points) ? conn.points : [];
      if (pts.length === 0) return 'M 0 0';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      }
      return d;
    },

calculateConnectionPoints(fromElement, toElement) {
      const start = this.getAnchorPoint(fromElement, toElement);
      const end = this.getAnchorPoint(toElement, fromElement);
      // default with one bend handle in the middle
      return [start, this.getDefaultMidpoint(start, end), end];
    },

getAnchorPoint(element, target) {
      const width = Number(element.width) || 0;
      const height = Number(element.height) || 0;
      const fromCenter = {
        x: Number(element.x) + width / 2,
        y: Number(element.y) + height / 2
      };
      const toCenter = {
        x: Number(target.x) + Number(target.width || 0) / 2,
        y: Number(target.y) + Number(target.height || 0) / 2
      };

      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;

      if (dx === 0 && dy === 0) {
        return {...fromCenter};
      }

      const shape = this.getElementShape(element.type);

      if (shape === 'custom') {
        const raw = this.getElementPreset(element.type)?.svg_path || '';
        const parsed = parseCustomShapeData(raw);
        if (parsed.d) {
          const localDirectionX = dx * (parsed.viewBoxData.width / Math.max(1, width));
          const localDirectionY = dy * (parsed.viewBoxData.height / Math.max(1, height));
          const hit = getCustomShapeBoundaryTowards(raw, localDirectionX, localDirectionY);
          return {
            x: Number(element.x) + Math.max(0, Math.min(1, hit.xRatio)) * width,
            y: Number(element.y) + Math.max(0, Math.min(1, hit.yRatio)) * height,
          };
        }
      }

      if (shape === 'ellipse') {
        const a = width / 2;
        const b = height / 2;
        const scale = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b)) || 1;
        return {
          x: fromCenter.x + dx / scale,
          y: fromCenter.y + dy / scale
        };
      }

      // Default: rectangle / cylinder / other boxy shapes
      const halfW = width / 2 || 1;
      const halfH = height / 2 || 1;
      const scale = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH) || 1;

      return {
        x: fromCenter.x + dx / scale,
        y: fromCenter.y + dy / scale
      };
    }
};
