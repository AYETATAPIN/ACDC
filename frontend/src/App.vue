<template>
  <div class="app">
    <header class="header">
      <div class="logo-placeholder"></div>
      <div class="controls">
        <input v-model="diagramName" placeholder="Diagram name">
        <select v-model="diagramType">
          <option value="class">Class</option>
          <option value="use_case">Use Case</option>
          <option value="free_mode">Free Mode</option>
        </select>
        <button
            @click="snapToGrid = !snapToGrid"
            :class="{ active: snapToGrid }"
            :title="snapToGrid ? 'Привязка к сетке: ВКЛ' : 'Привязка к сетке: ВЫКЛ'"
        >
          {{ snapToGrid ? '📐 Сетка: ВКЛ' : '📏 Сетка: ВЫКЛ' }}
        </button>
        <button @click="createTestData" title="Создать тестовые данные">
          🧪 Test
        </button>
        <!-- ДОБАВЛЯЕМ КНОПКУ ВЫБОРА -->
        <button
            @click="selectTool(null)"
            :class="{ active: currentTool === null }"
            title="Режим выбора и перемещения"
        >
          👆 Select
        </button>
        <button @click="saveDiagram" :class="{ 'has-changes': hasUnsavedChanges }">
          {{ hasUnsavedChanges ? '💾 Save*' : '💾 Save' }}
        </button>
        <button @click="newDiagram">New</button>
        <button :disabled="!currentDiagramId" @click="undoDiagram">Undo</button>
        <button :disabled="!currentDiagramId" @click="redoDiagram">Redo</button>
        <select v-model="selectedDiagramId" @change="selectedDiagramId && loadDiagram(selectedDiagramId)" class="diagram-select">
          <option value="" disabled>Выбрать диаграмму...</option>
          <option v-for="d in diagrams" :key="d.id" :value="d.id">
            {{ d.name }} ({{ d.type }})
          </option>
        </select>
        <button @click="loadDiagramsList" :disabled="isLoadingList">↻</button>
        <div class="canvas-size-controls">
          <button type="button" @click="adjustZoom(-0.1)">−</button>
          <div style="min-width:60px;text-align:center;">{{ Math.round(zoom * 100) }}%</div>
          <button type="button" @click="adjustZoom(0.1)">+</button>
        </div>
      </div>
    </header>

    <div v-if="errorMessage" class="error-toast">
      <div class="error-content">
        <strong>Ошибка:</strong> {{ errorMessage }}
        <button @click="errorMessage = null" class="error-close">×</button>
      </div>
    </div>

    <div class="main">
      <div class="toolbar">
        <div class="toolbar-section">
          <h3>Элементы</h3>
          <div class="tool-grid">
            <button
                v-for="tool in availableElementTools"
                :key="tool.type"
                class="tool-btn"
                :class="{ active: currentTool === tool.type }"
                @click="selectTool(tool.type)"
            >
              <span class="tool-label">{{ tool.label }}</span>
              <span class="tool-hint">{{ tool.shape }}</span>
            </button>
          </div>
        </div>

        <div class="toolbar-section">
          <h3>Связи</h3>
          <div class="tool-grid">
            <button
                v-for="tool in availableConnectionTools"
                :key="tool.type"
                class="tool-btn connection-btn"
                :class="{ active: currentTool === tool.type }"
                @click="selectTool(tool.type)"
            >
              <span class="tool-label">{{ tool.label }}</span>
              <span class="tool-hint" :style="{ color: getConnectionColor(tool.type) }">{{ tool.type }}</span>
            </button>
            <div v-if="availableConnectionTools.length === 0" class="empty-tools">
              Связи недоступны для текущего типа диаграммы
            </div>
          </div>
        </div>

        <div class="toolbar-section">
          <h3>Диаграммы</h3>
          <button class="tool-btn" @click="loadDiagramsList" :disabled="isLoadingList">
            {{ isLoadingList ? 'Загрузка...' : 'Обновить список' }}
          </button>
          <div class="diagram-list">
            <div
                v-for="item in diagrams"
                :key="item.id"
                class="diagram-item"
                :class="{ active: currentDiagramId === item.id }"
                @click="loadDiagram(item.id)"
            >
              <div class="diagram-title">{{ item.name }}</div>
              <div class="diagram-meta">
                <span class="badge small">{{ item.type }}</span>
                <span class="diagram-date">{{ formatDate(item.created_at) }}</span>
              </div>
            </div>
            <div v-if="!isLoadingList && diagrams.length === 0" class="empty-tools">
              Нет сохранённых диаграмм
            </div>
          </div>
        </div>

        <div class="debug-panel">
          <p><strong>Отладка:</strong></p>
          <p>Инструмент: {{ currentTool || 'none' }}</p>
          <p>Режим: {{
              currentTool === null ? 'Выбор' :
                  isConnectionTool(currentTool) ? 'Связь' :
                      isElementTool(currentTool) ? 'Элемент' :
                          'Нет'
            }}</p>
          <p>Элементов: {{ elements.length }}</p>
          <p>Связей: {{ connections.length }}</p>
          <p v-if="isConnecting" class="debug-badge warn">Режим связи: выберите второй элемент</p>
          <p v-if="isDragging" class="debug-badge ok">Перемещение элемента</p>
        </div>
      </div>

      <!-- Упрощенный template для канваса -->
      <div class="canvas-container">
        <div
            class="canvas"
            ref="canvas"
            @click="handleCanvasClick"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
        >
          <!-- SVG для связей -->
          <svg
              class="connections-layer"
              :width="canvasWidth"
              :height="canvasHeight"
          >
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#34495e"/>
              </marker>
            </defs>

            <!-- Связи -->
            <path
                v-for="conn in connections"
                :key="conn.id"
                :d="getConnectionPath(conn)"
                :stroke="selectedConnection?.id === conn.id ? '#e74c3c' : '#34495e'"
                :stroke-width="selectedConnection?.id === conn.id ? '5' : '3'"
                fill="none"
                marker-end="url(#arrow)"
                style="cursor: pointer;"
                @click.stop="selectConnection(conn, $event)"
            />
          </svg>

          <!-- ЭЛЕМЕНТЫ -->
          <div class="elements-layer">
            <div
                v-for="element in elements"
                :key="element.id"
                class="element"
                :style="getElementStyle(element)"
                @click.stop="selectElement(element)"
                @mousedown.stop="handleElementMouseDown(element, $event)"
            >
              {{ element.text }}
            </div>
          </div>

          <!-- ТОЧКИ ИЗГИБА СВЯЗЕЙ -->
          <div class="bendpoints-layer">
            <div
                v-for="(conn, connIndex) in connections"
                :key="conn.id"
            >
              <div
                  v-for="(point, pointIndex) in conn.points"
                  v-if="pointIndex > 0 && pointIndex < conn.points.length - 1"
                  :key="pointIndex"
                  class="bend-point"
                  :style="getBendPointStyle(point)"
                  @mousedown.stop="handleBendPointMouseDown(conn, pointIndex, $event)"
              ></div>
            </div>
          </div>

          <!-- МЕТКИ СВЯЗЕЙ -->
          <div class="labels-layer">
            <div
                v-for="conn in connections"
                :key="'label-' + conn.id"
                class="connection-label"
                :style="getLabelStyle(conn)"
                @dblclick.stop="editConnectionLabel(conn)"
            >
              <template v-if="editingLabel?.connId === conn.id">
                <input
                    ref="labelInput"
                    v-model="editingLabel.value"
                    @blur="saveLabel(conn)"
                    @keydown.enter="saveLabel(conn)"
                    class="label-input"
                />
              </template>
              <template v-else>
                {{ conn.label || 'Двойной клик' }}
              </template>
            </div>
          </div>
        </div>
      </div>

      <aside class="history-panel" v-if="currentDiagramId" :class="{ collapsed: historyCollapsed }">
        <div class="history-header" @click="historyCollapsed = !historyCollapsed">
          <h3>History</h3>
          <button class="collapse-btn">{{ historyCollapsed ? '▼' : '▲' }}</button>
        </div>
        <div v-if="!historyCollapsed">
          <div v-if="historyEntries.length === 0" class="empty">No snapshots yet</div>
          <div
              v-for="entry in historyEntries"
              :key="entry.version"
              class="history-row"
              :class="{ active: entry.version === currentVersion }"
          >
            <div class="version">v{{ entry.version }}</div>
            <div class="version-info" v-if="currentDiagramId">
              Версия: {{ currentVersion }} | Снапшотов: {{ historyEntries.length }}
            </div>
            <div class="time">{{ formatDate(entry.created_at) }}</div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      lastSavedState: null,
      hasUnsavedChanges: false,
      snapToGrid: true,
      gridSize: 10,
      elementPresets: [
        { type: 'class', label: 'Class', shape: 'rect', color: '#3498db', border: '#2d83be', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'interface', label: 'Interface', shape: 'rect', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'enum', label: 'Enum', shape: 'rect', color: '#e67e22', border: '#d35400', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'component', label: 'Component', shape: 'rect', color: '#16a085', border: '#13856f', textColor: '#ffffff', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'database', label: 'Database', shape: 'cylinder', color: '#34495e', border: '#2c3e50', textColor: '#ecf0f1', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'actor', label: 'Actor', shape: 'rect', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 90, height: 120, diagrams: ['use_case', 'free_mode'] },
        { type: 'usecase', label: 'Use Case', shape: 'ellipse', color: '#f97316', border: '#ea580c', textColor: '#ffffff', width: 160, height: 90, diagrams: ['use_case', 'free_mode'] },
        { type: 'note', label: 'Note', shape: 'rect', color: '#fff7d6', border: '#f1c40f', textColor: '#2c3e50', width: 160, height: 100, diagrams: ['class', 'use_case', 'free_mode'], dashed: true },
        { type: 'package', label: 'Package', shape: 'rect', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 180, height: 100, diagrams: ['class', 'use_case', 'free_mode'] }
      ],
      connectionPresets: [
        { type: 'association', label: 'Association', color: '#34495e', diagrams: ['class', 'use_case', 'free_mode'], dash: '' },
        { type: 'inheritance', label: 'Inheritance', color: '#8e44ad', diagrams: ['class', 'free_mode'], dash: '10 6' },
        { type: 'composition', label: 'Composition', color: '#27ae60', diagrams: ['class', 'free_mode'], dash: '' },
        { type: 'dependency', label: 'Dependency', color: '#7f8c8d', diagrams: ['class', 'free_mode'], dash: '6 4' }
      ],
      diagramName: '',
      diagramType: 'class',
      currentTool: null,
      elements: [],
      connections: [],
      selectedElement: null,
      selectedConnection: null,
      draggingBendPoint: { connId: null, pointIndex: null },
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
      pan: { x: 0, y: 0 },
      isPanning: false,
      panStart: { x: 0, y: 0 },
      pointerStart: { x: 0, y: 0 },
      canvasWidth: 1200,
      canvasHeight: 800,
      editingLabel: null,
    }
  },

  mounted() {
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    window.addEventListener('mouseleave', this.handleGlobalMouseUp);
    this.loadDiagramsList();

    // Обновляем размеры канваса
    this.updateCanvasSize();
    window.addEventListener('resize', this.updateCanvasSize);
  },

  beforeUnmount() {
    window.removeEventListener('mouseup', this.handleGlobalMouseUp);
    window.removeEventListener('mouseleave', this.handleGlobalMouseUp);
    window.removeEventListener('resize', this.updateCanvasSize);
  },

  computed: {
    availableElementTools() {
      return this.elementPresets.filter(p => p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode');
    },
    availableConnectionTools() {
      return this.connectionPresets.filter(p => p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode');
    },
    elementToolTypes() {
      return this.availableElementTools.map(p => p.type);
    },
    connectionToolTypes() {
      return this.availableConnectionTools.map(p => p.type);
    }
  },

  watch: {
    elements: {
      handler() {
        this.checkForChanges();
        this.updateConnections();
      },
      deep: true
    },
    connections: {
      handler() {
        this.checkForChanges();
      },
      deep: true
    },
    diagramName() {
      this.checkForChanges();
    },
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

  methods: {
    // ========== ОСНОВНЫЕ МЕТОДЫ ==========

    updateCanvasSize() {
      if (this.$refs.canvas) {
        const rect = this.$refs.canvas.getBoundingClientRect();
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
      }
    },

    selectTool(toolType) {
      this.currentTool = toolType;
      this.connectionStart = null;
      this.isConnecting = false;
      this.selectedElement = null;
      this.selectedConnection = null;
    },

    getElementAtPosition(x, y) {
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i];
        if (x >= element.x && x <= element.x + element.width &&
            y >= element.y && y <= element.y + element.height) {
          return element;
        }
      }
      return null;
    },

    getCanvasCoords(event) {
      const canvasRect = this.$refs.canvas.getBoundingClientRect();
      return {
        x: event.clientX - canvasRect.left,
        y: event.clientY - canvasRect.top
      };
    },

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

    handleCanvasClick(event) {
      const { x, y } = this.getCanvasCoords(event);

      // Если кликнули на элемент
      const clickedElement = this.getElementAtPosition(x, y);
      if (clickedElement) {
        if (this.currentTool && this.isConnectionTool(this.currentTool)) {
          // Режим создания связи
          this.handleConnectionMode(clickedElement);
        } else {
          // Просто выбираем элемент
          this.selectElement(clickedElement);
        }
        return;
      }

      // Если кликнули на пустое место
      if (this.currentTool && this.isElementTool(this.currentTool)) {
        // Создаем элемент
        this.createElement(this.currentTool, x, y);
      } else {
        // Снимаем выделение
        this.selectedElement = null;
        this.selectedConnection = null;
      }
    },

    handleMouseDown(event) {
      if (event.button === 1 || event.altKey) {
        this.isPanning = true;
        this.panStart = {...this.pan};
        this.pointerStart = { x: event.clientX, y: event.clientY };
        return;
      }
    },

    handleMouseMove(event) {
      // Перемещение точки изгиба
      if (this.draggingBendPoint.connId && this.draggingBendPoint.pointIndex !== null) {
        const conn = this.connections.find(c => c.id === this.draggingBendPoint.connId);
        if (!conn) return;

        const { x, y } = this.getCanvasCoords(event);
        const snapped = this.snapToGrid
            ? this.snapCoordinates(x - this.dragOffset.x, y - this.dragOffset.y)
            : { x: x - this.dragOffset.x, y: y - this.dragOffset.y };

        conn.points[this.draggingBendPoint.pointIndex] = snapped;
        return;
      }

      // Перемещение элемента
      if (this.isDragging && this.dragElement) {
        const { x, y } = this.getCanvasCoords(event);
        const newX = x - this.dragOffset.x;
        const newY = y - this.dragOffset.y;
        this.moveElement(this.dragElement.id, newX, newY);
        return;
      }

      // Панорамирование
      if (this.isPanning) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.pan.x = this.panStart.x + dx;
        this.pan.y = this.panStart.y + dy;
      }
    },

    handleMouseUp() {
      this.isDragging = false;
      this.dragElement = null;
      this.draggingBendPoint = { connId: null, pointIndex: null };
      this.isPanning = false;
    },

    handleGlobalMouseUp() {
      this.handleMouseUp();
    },

    // ========== РАБОТА С ЭЛЕМЕНТАМИ ==========

    createElement(type, x, y) {
      const preset = this.getElementPreset(type);
      if (!preset) return;

      const uuid = this.generateUUID();
      const snapped = this.snapCoordinates(x - preset.width/2, y - preset.height/2);

      const element = {
        id: uuid,
        type: type,
        x: snapped.x,
        y: snapped.y,
        width: preset.width,
        height: preset.height,
        text: this.getDefaultText(type),
        properties: {}
      };

      this.elements.push(element);
      this.selectedElement = element;
      this.selectedConnection = null;
      this.currentTool = null;
    },

    selectElement(element) {
      this.selectedElement = element;
      this.selectedConnection = null;
    },

    handleElementMouseDown(element, event) {
      event.stopPropagation();

      if (this.currentTool && this.isConnectionTool(this.currentTool)) {
        this.handleConnectionMode(element);
        return;
      }

      this.dragElement = element;
      const { x, y } = this.getCanvasCoords(event);
      this.dragOffset.x = x - element.x;
      this.dragOffset.y = y - element.y;
      this.isDragging = true;
      this.selectedElement = element;
      this.selectedConnection = null;
    },

    moveElement(elementId, newX, newY) {
      const element = this.elements.find(el => el.id === elementId);
      if (element) {
        const snapped = this.snapCoordinates(newX, newY);
        element.x = snapped.x;
        element.y = snapped.y;
        this.updateConnections();
      }
    },

    // ========== РАБОТА СО СВЯЗЯМИ ==========

    handleConnectionMode(element) {
      if (!this.connectionStart) {
        this.connectionStart = element;
        this.isConnecting = true;
      } else {
        if (this.connectionStart.id !== element.id) {
          this.createConnection(this.connectionStart, element);
        }
        this.connectionStart = null;
        this.isConnecting = false;
        this.currentTool = null;
      }
    },

    createConnection(fromElement, toElement, connectionType = null) {
      const connType = connectionType || this.currentTool || 'association';

      if (!this.isConnectionAllowed(fromElement, toElement, connType)) {
        const message = this.connectionRuleMessage(fromElement, toElement, connType);
        this.showError(message);
        return null;
      }

      const start = this.getAnchorPoint(fromElement, toElement);
      const end = this.getAnchorPoint(toElement, fromElement);
      const midPoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      };

      const connection = {
        id: this.generateUUID(),
        from: fromElement.id,
        to: toElement.id,
        type: connType,
        label: 'Двойной клик',
        points: [start, midPoint, end]
      };

      this.connections.push(connection);
      console.log('Connection created:', connection);
      return connection;
    },

    selectConnection(conn, event) {
      if (event) event.stopPropagation();
      this.selectedConnection = conn;
      this.selectedElement = null;
    },

    // ========== МЕТКИ СВЯЗЕЙ ==========

    editConnectionLabel(conn) {
      this.editingLabel = {
        connId: conn.id,
        value: conn.label || ''
      };

      this.$nextTick(() => {
        if (this.$refs.labelInput) {
          const input = Array.isArray(this.$refs.labelInput)
              ? this.$refs.labelInput.find(i => i)
              : this.$refs.labelInput;
          if (input) {
            input.focus();
            input.select();
          }
        }
      });
    },

    saveLabel(conn) {
      if (this.editingLabel?.connId === conn.id) {
        conn.label = this.editingLabel.value || 'Двойной клик';
      }
      this.editingLabel = null;
    },

    // ========== ТОЧКИ ИЗГИБА ==========

    handleBendPointMouseDown(conn, pointIndex, event) {
      event.stopPropagation();
      event.preventDefault();

      this.draggingBendPoint = {
        connId: conn.id,
        pointIndex: pointIndex
      };

      const { x, y } = this.getCanvasCoords(event);
      const point = conn.points[pointIndex];

      this.dragOffset = {
        x: x - point.x,
        y: y - point.y
      };

      this.selectedConnection = conn;
      this.selectedElement = null;
    },

    // ========== ГЕОМЕТРИЯ СВЯЗЕЙ ==========

    getConnectionPath(conn) {
      if (!conn.points || conn.points.length === 0) {
        return 'M 0 0 L 100 100';
      }

      let path = `M ${conn.points[0].x} ${conn.points[0].y}`;
      for (let i = 1; i < conn.points.length; i++) {
        path += ` L ${conn.points[i].x} ${conn.points[i].y}`;
      }
      return path;
    },

    getAnchorPoint(element, target) {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;

      // Просто возвращаем центр элемента
      return { x: centerX, y: centerY };
    },

    updateConnections() {
      this.connections.forEach(conn => {
        const fromEl = this.elements.find(e => e.id === conn.from);
        const toEl = this.elements.find(e => e.id === conn.to);

        if (!fromEl || !toEl) return;

        // Обновляем только первую и последнюю точки
        if (conn.points && conn.points.length > 0) {
          const start = this.getAnchorPoint(fromEl, toEl);
          const end = this.getAnchorPoint(toEl, fromEl);
          conn.points[0] = start;
          conn.points[conn.points.length - 1] = end;
        }
      });
    },

    // ========== СТИЛИ ==========

    getElementStyle(element) {
      const preset = this.getElementPreset(element.type);
      const isSelected = this.selectedElement?.id === element.id;
      const isConnecting = this.connectionStart?.id === element.id;

      return {
        left: element.x + 'px',
        top: element.y + 'px',
        width: element.width + 'px',
        height: element.height + 'px',
        background: preset?.color || '#3498db',
        color: preset?.textColor || 'white',
        border: `2px solid ${isSelected ? '#e74c3c' : isConnecting ? '#f39c12' : preset?.border || '#2980b9'}`,
        borderRadius: preset?.shape === 'ellipse' ? '50%' : '10px',
        cursor: 'move',
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        padding: '10px'
      };
    },

    getLabelStyle(conn) {
      const mid = this.getMidpoint(conn);
      return {
        left: mid.x + 'px',
        top: (mid.y - 20) + 'px',
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        border: '1px solid #3498db',
        padding: '2px 6px',
        borderRadius: '3px',
        cursor: 'pointer',
        minWidth: '80px',
        textAlign: 'center',
        zIndex: 100
      };
    },

    getBendPointStyle(point) {
      return {
        left: point.x + 'px',
        top: point.y + 'px',
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        width: '12px',
        height: '12px',
        background: '#e74c3c',
        border: '2px solid white',
        borderRadius: '50%',
        cursor: 'move',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        zIndex: 100
      };
    },

    getMidpoint(conn) {
      if (!conn.points || conn.points.length === 0) {
        return { x: 0, y: 0 };
      }
      const midIndex = Math.floor(conn.points.length / 2);
      return conn.points[midIndex];
    },

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    getElementPreset(type) {
      return this.elementPresets.find(p => p.type === type);
    },

    isConnectionTool(tool) {
      return this.connectionToolTypes.includes(tool);
    },

    isElementTool(tool) {
      return this.elementToolTypes.includes(tool);
    },

    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    getDefaultText(type) {
      const texts = {
        class: 'New Class',
        interface: 'Interface',
        enum: 'Enum',
        component: 'Component',
        database: 'Database',
        actor: 'Actor',
        usecase: 'Use Case',
        note: 'Note',
        package: 'Package'
      };
      return texts[type] || type;
    },

    snapCoordinates(x, y) {
      if (!this.snapToGrid) {
        return { x: x, y: y };
      }
      return {
        x: Math.round(x / this.gridSize) * this.gridSize,
        y: Math.round(y / this.gridSize) * this.gridSize
      };
    },

    getConnectionColor(connectionType) {
      const preset = this.connectionPresets.find(p => p.type === connectionType);
      return preset?.color || '#34495e';
    },

    isConnectionAllowed(fromElement, toElement, connectionType) {
      if (this.diagramType === 'free_mode') return true;
      return true; // Упрощаем для теста
    },

    connectionRuleMessage(fromElement, toElement, connectionType) {
      return 'Такое соединение не поддерживается';
    },

    showError(message) {
      console.error('Error:', message);
      this.errorMessage = message;
      setTimeout(() => {
        this.errorMessage = null;
      }, 5000);
    },

    // ========== ТЕСТОВЫЕ ДАННЫЕ ==========

    createTestData() {
      console.log('Creating test data...');

      this.elements = [];
      this.connections = [];
      this.selectedElement = null;
      this.selectedConnection = null;

      const element1 = {
        id: 'test-el-1',
        type: 'class',
        x: 100,
        y: 100,
        width: 140,
        height: 80,
        text: 'Class A',
        properties: {}
      };

      const element2 = {
        id: 'test-el-2',
        type: 'class',
        x: 400,
        y: 300,
        width: 140,
        height: 80,
        text: 'Class B',
        properties: {}
      };

      this.elements.push(element1, element2);

      // Создаем связь с тремя точками (начало, середина, конец)
      const conn = this.createConnection(element1, element2, 'association');
      if (conn) {
        this.selectedConnection = conn;
        console.log('Test connection created:', conn);
      }
    },

    // ========== ОСТАЛЬНЫЕ МЕТОДЫ (остаются без изменений) ==========

    checkForChanges() {
      const currentState = {
        elements: this.elements,
        connections: this.connections,
        diagramName: this.diagramName,
        diagramType: this.diagramType
      };

      if (!this.lastSavedState ||
          JSON.stringify(currentState) !== JSON.stringify(this.lastSavedState)) {
        this.hasUnsavedChanges = true;
      } else {
        this.hasUnsavedChanges = false;
      }
    },

    ensureToolFitsDiagram() {
      const allTools = [...this.elementToolTypes, ...this.connectionToolTypes];
      if (this.currentTool && !allTools.includes(this.currentTool)) {
        this.currentTool = null;
      }
      if (this.connectionStart && !this.connectionToolTypes.includes(this.currentTool)) {
        this.connectionStart = null;
        this.isConnecting = false;
      }
    },

    defaultToolForDiagram() {
      const fallback = this.availableElementTools[0]?.type;
      if (this.diagramType === 'use_case') return this.availableElementTools.find(t => t.type === 'actor')?.type || fallback || null;
      return fallback || null;
    },

    setZoom(value) {
      const clamped = Math.min(3, Math.max(0.3, value));
      this.zoom = Number(clamped.toFixed(2));
    },

    adjustZoom(delta) {
      this.setZoom(this.zoom + delta);
    },

    alignElementsToGrid() {
      if (!this.snapToGrid) return;
      this.elements = this.elements.map(el => {
        const snapped = this.snapCoordinates(el.x, el.y);
        return {...el, x: snapped.x, y: snapped.y};
      });
      this.updateConnections();
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },

    // Методы сохранения/загрузки (упрощенные)
    async saveDiagram() {
      console.log('Save diagram');
      this.lastSavedState = {
        elements: [...this.elements],
        connections: [...this.connections],
        diagramName: this.diagramName,
        diagramType: this.diagramType
      };
      this.hasUnsavedChanges = false;
      alert('Диаграмма сохранена (режим демо)');
    },

    newDiagram() {
      this.elements = []
      this.connections = []
      this.diagramName = ''
      this.diagramType = 'class'
      this.currentTool = null
      this.selectedElement = null
      this.selectedConnection = null
      this.currentDiagramId = null
      this.selectedDiagramId = null
      this.historyEntries = []
      this.currentVersion = 0
      this.pan = {x: 0, y: 0}
    },

    async loadDiagramsList() {
      console.log('Load diagrams list');
      this.diagrams = [];
    },

    async loadDiagram(diagramId) {
      console.log('Load diagram:', diagramId);
    },

    async undoDiagram() {
      console.log('Undo');
    },

    async redoDiagram() {
      console.log('Redo');
    }
  }
}
</script>

<style>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #2c3e50;
  color: white;
  padding: 1.25rem 1rem 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  position: relative;
  z-index: 10;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, auto));
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  gap: 0.5rem;
  align-items: center;
  justify-content: start;
  width: 100%;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.controls input,
.controls select {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  width: 100%;
  box-sizing: border-box;
}

.controls button {
  padding: 0.25rem 0.35rem;
  min-height: 28px;
  min-width: 32px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  background: #3498db;
  color: white;
  transition: background 0.2s;
}

.controls button.active {
  background: #2d83be;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}

.controls .diagram-select {
  min-width: 140px;
  padding: 0.25rem 0.4rem;
  min-height: 28px;
  border-radius: 5px;
  border: 1px solid #d0d7de;
  font-size: 0.9rem;
}

.canvas-size-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.canvas-size-controls button {
  padding: 0.25rem 0.35rem;
  min-width: 24px;
  min-height: 28px;
  background: #ecf0f1;
  color: #2c3e50;
}

.controls button:hover {
  background: #2d83be;
}

.controls button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.toolbar {
  width: 280px;
  background: #f4f6f8;
  padding: 0.75rem;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(100vh - 120px);
  position: relative;
  z-index: 5;
}

.toolbar-section h3 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-grid {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.45rem;
}

.tool-btn {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.tool-btn:hover {
  border-color: #3498db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.tool-btn.active {
  background: #eaf4ff;
  border-color: #3498db;
}

.connection-btn {
  border-color: #cdd3da;
}

.tool-label {
  font-weight: 600;
  color: #2c3e50;
}

.tool-hint {
  font-size: 11px;
  color: #7f8c8d;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.empty-tools {
  grid-column: 1 / -1;
  padding: 0.75rem;
  background: #fff8f0;
  border: 1px dashed #f39c12;
  color: #8d6e2f;
  border-radius: 8px;
  font-size: 13px;
}

.diagram-list {
  max-height: 240px;
  overflow-y: auto;
  margin-top: 0.5rem;
}

.diagram-item {
  background: white;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  border: 1px solid #d0d7de;
  cursor: pointer;
  transition: all 0.15s ease;
}

.diagram-item:hover {
  border-color: #3498db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.diagram-item.active {
  border-color: #e74c3c;
  background: #fff5f2;
}

.diagram-title {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.25rem;
}

.diagram-meta {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 12px;
  color: #7f8c8d;
}

.diagram-date {
  color: #95a5a6;
}

.debug-panel {
  padding: 0.75rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #2c3e50;
  font-size: 13px;
}

.debug-badge {
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
  margin-top: 0.25rem;
}

.debug-badge.warn {
  background: #fff0f0;
  color: #c0392b;
}

.debug-badge.ok {
  background: #e9f7ef;
  color: #27ae60;
}

/* === КАНВАС === */
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f9f9f9;
}

.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  user-select: none;
  overflow: hidden;
}

.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none;
}

.connections-layer path {
  pointer-events: stroke;
  cursor: pointer;
}

.labels-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
}

.elements-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  pointer-events: auto;
}

.bendpoints-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.element {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: transform 0.2s;
  user-select: none;
}

.element:hover {
  transform: scale(1.05);
}

.element.selected {
  border-color: #e74c3c !important;
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.3);
}

.connection-label {
  pointer-events: all;
  font-size: 12px;
  z-index: 100;
}

.label-input {
  border: 1px solid #3498db;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
}

.bend-point {
  pointer-events: all;
  z-index: 100;
}

.bend-point:hover {
  transform: translate(-50%, -50%) scale(1.2);
}

.history-panel {
  width: 240px;
  border-left: 1px solid #e5e7eb;
  padding: 1rem;
  background: #fafafa;
  overflow-y: auto;
}

.history-panel.collapsed {
  width: 80px;
  padding: 0.75rem;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.collapse-btn {
  border: 1px solid #d0d7de;
  background: white;
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
}

.history-panel h3 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: #2c3e50;
}

.history-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: white;
}

.history-row.active {
  border-color: #3498db;
  background: #eaf4ff;
}

.history-row .version {
  font-weight: 600;
  color: #2c3e50;
}

.history-row .time {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.empty {
  color: #95a5a6;
  font-style: italic;
}

.error-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #e74c3c;
  color: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
  max-width: 400px;
  animation: slideIn 0.3s ease;
}

.error-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.error-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.version-info {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

button.has-changes {
  background: #f39c12 !important;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>