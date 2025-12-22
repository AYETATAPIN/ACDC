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
        <!-- Toolbar content unchanged -->
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
          <p>Элементов: {{ elements.length }}</p>
          <p>Связей: {{ connections.length }}</p>
          <p v-if="isConnecting" class="debug-badge warn">Режим связи: выберите второй элемент</p>
          <p v-if="isDragging" class="debug-badge ok">Перемещение элемента</p>
        </div>
      </div>

      <div class="canvas"
           :style="{ background: snapToGrid ? 'linear-gradient(90deg, #f0f0f0 1px, transparent 1px), linear-gradient(#f0f0f0 1px, transparent 1px)' : 'white',
                     backgroundSize: snapToGrid ? `${gridSize}px ${gridSize}px` : 'auto',
                     height: canvasHeight + 'px' }"
           @click="handleCanvasClick"
           @mousedown="handleMouseDown"
           @mousemove="handleMouseMove"
           @mouseup="handleMouseUp"
           @mouseleave="handleMouseUp"
           @wheel.prevent="handleWheel"
      >
        <div class="canvas-inner" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: (100/zoom)+'%', height: (100/zoom)+'%', transformOrigin: '0 0' }">
          <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" xmlns="http://www.w3.org/2000/svg">
            <!-- Connections with click to select -->
            <path
                v-for="conn in connections"
                :key="conn.id"
                :d="getConnectionPath(conn)"
                :stroke="conn.customColor || getConnectionColor(conn.type)"
                stroke-width="4"
                :stroke-dasharray="conn.customDash || getConnectionDash(conn.type) || null"
                :marker-end="`url(#${getMarkerId(conn.type)})`"
                fill="none"
                style="pointer-events: stroke; cursor: pointer;"
                @click.stop="selectConnection(conn)"
                @dblclick.stop="startLabelEdit(conn, $event)"
                :class="{ 'selected-connection': selectedConnection?.id === conn.id }"
            />

            <!-- Connection labels -->
            <text
                v-for="conn in connections"
                :key="`label-${conn.id}`"
                :x="getLabelPosition(conn).x"
                :y="getLabelPosition(conn).y"
                text-anchor="middle"
                dominant-baseline="middle"
                :font-size="conn.labelFontSize || 12"
                :fill="conn.labelColor || '#2c3e50'"
                style="pointer-events: none; user-select: none;"
            >
              {{ conn.label || '' }}
            </text>

            <!-- Bend points -->
            <g v-for="conn in connections" :key="`bend-${conn.id}`">
              <template v-for="(pt, idx) in (conn.points || [])" :key="`pt-${conn.id}-${idx}`">
                <circle
                    v-if="idx > 0 && idx < (conn.points.length - 1)"
                    class="bend-point"
                    :cx="pt.x"
                    :cy="pt.y"
                    :r="(draggingBendPoint.connId === conn.id && draggingBendPoint.pointIndex === idx) ? 8 : 6"
                    :fill="(draggingBendPoint.connId === conn.id && draggingBendPoint.pointIndex === idx) ? '#c0392b' : '#e74c3c'"
                    stroke="#ffffff"
                    stroke-width="2"
                    style="pointer-events: all; cursor: move;"
                    @mousedown.stop.prevent="handleBendPointMouseDown(conn, idx, $event)"
                />
                <circle v-if="idx > 0 && idx < (conn.points.length - 1)" :cx="pt.x" :cy="pt.y" r="14" fill="transparent" style="pointer-events: all; cursor: move;" @mousedown.stop.prevent="handleBendPointMouseDown(conn, idx, $event)" />
              </template>
            </g>

            <defs>
              <marker v-for="preset in connectionPresets" :key="preset.type" :id="`arrow-${preset.type}`" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" :fill="getConnectionColor(preset.type)" />
              </marker>
              <marker id="arrow-default" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" :fill="getConnectionColor('association')" />
              </marker>
            </defs>
          </svg>

          <!-- Connection label editor -->
          <div
              v-if="editingConnectionLabel && editingConnectionLabel.connId"
              class="connection-label-editor"
              :style="getLabelEditorStyle(editingConnectionLabel.connId)"
          >
            <input
                v-model="getConnectionById(editingConnectionLabel.connId).label"
                @blur="finishLabelEdit"
                @keyup.enter="finishLabelEdit"
                @keyup.esc="cancelLabelEdit"
                ref="labelInput"
                autofocus
            />
          </div>

          <!-- Canvas hint -->
          <div style="padding: 20px; color: #666; text-align: center;" v-if="elements.length === 0">
            <p>Выберите инструмент слева и кликните здесь</p>
            <p>Текущий инструмент: <strong>{{ currentTool }}</strong></p>
          </div>

          <!-- Elements -->
          <div
              v-for="element in elements"
              :key="element.id"
              class="element"
              :class="[
                  {
                    dragging: isDragging && selectedElements.some(el => el.id === element.id),
                    selected: selectedElements.some(el => el.id === element.id)
                  },
                  `shape-${getElementShape(element.type)}`
                ]"
              :style="getElementStyle(element)"
              @click.stop="handleElementClick(element)"
          >
            <div class="element-text-main" :style="{ fontSize: (element.fontSize || 14) + 'px' }">{{ element.text }}</div>
            <div class="element-type-tag">{{ element.type }}</div>
            <div class="resize-handle" @mousedown.stop="handleResizeMouseDown(element, $event)" title="Изменить размер"></div>
          </div>
        </div>
      </div>

      <!-- Unified Properties Panel (for element OR connection) -->
      <!-- Improved Properties Panel -->
      <aside class="properties-panel" v-if="selectedElements.length === 1 || selectedConnection">
        <div class="properties-header">
          <h3>
            {{ selectedElements.length === 1 ? 'Свойства элемента' : 'Свойства связи' }}
          </h3>
          <button @click="deselectAll" class="close-btn" title="Закрыть панель">×</button>
        </div>

        <div class="properties-content">
          <!-- Element Properties -->
          <template v-if="selectedElements.length === 1">
            <div class="prop-group">
              <label>Текст</label>
              <input v-model="selectedElements[0].text" placeholder="Введите текст элемента" />
            </div>

            <div class="prop-group">
              <label>Размер шрифта</label>
              <div class="range-wrapper">
                <input type="range" min="10" max="36" step="1" v-model.number="selectedElements[0].fontSize" />
                <span class="range-value">{{ selectedElements[0].fontSize || 14 }} px</span>
              </div>
            </div>

            <div class="prop-group">
              <label>Цвет фона</label>
              <input type="color"
                     v-model="selectedElements[0].customColor"
                     :title="selectedElements[0].customColor || 'По умолчанию: ' + (getElementPreset(selectedElements[0].type)?.color || '#95a5a6')" />
            </div>

            <div class="prop-group">
              <label>Цвет границы</label>
              <input type="color"
                     v-model="selectedElements[0].customBorder"
                     :title="selectedElements[0].customBorder || 'По умолчанию: ' + (getElementPreset(selectedElements[0].type)?.border || '#2c3e50')" />
            </div>

            <div class="prop-group">
              <label>Ширина</label>
              <input type="number" min="40" v-model.number="selectedElements[0].width" />
            </div>

            <div class="prop-group">
              <label>Высота</label>
              <input type="number" min="30" v-model.number="selectedElements[0].height" />
            </div>

            <div class="prop-group info">
              <label>Тип элемента</label>
              <span class="prop-value">{{ selectedElements[0].type }}</span>
            </div>
          </template>

          <!-- Connection Properties -->
          <template v-else-if="selectedConnection">
            <div class="prop-group">
              <label>Надпись</label>
              <input v-model="selectedConnection.label" placeholder="Текст на линии" />
            </div>

            <div class="prop-group">
              <label>Цвет надписи</label>
              <input type="color" v-model="selectedConnection.labelColor" />
            </div>

            <div class="prop-group">
              <label>Размер шрифта надписи</label>
              <div class="range-wrapper">
                <input type="range" min="8" max="28" step="1" v-model.number="selectedConnection.labelFontSize" />
                <span class="range-value">{{ selectedConnection.labelFontSize || 12 }} px</span>
              </div>
            </div>

            <div class="prop-group">
              <label>Цвет линии</label>
              <input type="color" v-model="selectedConnection.customColor" />
            </div>

            <div class="prop-group">
              <label>Стиль линии</label>
              <select v-model="selectedConnection.customDash">
                <option value="">Сплошная</option>
                <option value="8 4">─── Пунктир</option>
                <option value="12 6">——— Длинный пунктир</option>
                <option value="4 4">∙∙∙∙ Точечная</option>
                <option value="2 6">· · · Разреженная</option>
              </select>
            </div>

            <div class="prop-group info">
              <label>Тип связи</label>
              <span class="prop-value">{{ selectedConnection.type }}</span>
            </div>
          </template>
        </div>
      </aside>

      <!-- Optional: Info when multiple elements selected -->
      <div v-else-if="selectedElements.length > 1" class="properties-panel multi-select-info">
        <div class="properties-header">
          <h3>Выбрано элементов: {{ selectedElements.length }}</h3>
          <button @click="deselectAll" class="close-btn">×</button>
        </div>
        <div class="properties-content">
          <p style="text-align: center; color: #7f8c8d; padding: 2rem 1rem;">
            Редактирование свойств доступно только при выборе одного элемента.<br>
            <small>Удерживайте Ctrl для множественного выбора</small>
          </p>
        </div>
      </div>

      <!-- History panel (unchanged) -->
      <aside class="history-panel" v-if="currentDiagramId" :class="{ collapsed: historyCollapsed }">
        <div class="history-header" @click="historyCollapsed = !historyCollapsed">
          <h3>History</h3>
          <button class="collapse-btn">{{ historyCollapsed ? '▼' : '▲' }}</button>
        </div>
        <div v-if="!historyCollapsed">
          <div v-if="historyEntries.length === 0" class="empty">No snapshots yet</div>
          <div v-for="entry in historyEntries" :key="entry.version" class="history-row" :class="{ active: entry.version === currentVersion }">
            <div class="version">v{{ entry.version }}</div>
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
        { type: 'select', label: 'Select/Move', shape: '➡️', diagrams: ['class', 'use_case', 'free_mode'] },
        { type: 'delete', label: 'Delete', shape: '🗑️', diagrams: ['class', 'use_case', 'free_mode'] },
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
      currentTool: 'select',
      selectedConnection: null,
      editingConnectionLabel: null,
      elements: [],
      connections: [],
      selectedElements: [],
      isMultiSelecting: false,
      dragOffsets: [],
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
      pan: { x: 0, y: 0 },
      isPanning: false,
      panStart: { x: 0, y: 0 },
      pointerStart: { x: 0, y: 0 },

      // Bend point drag
      draggingBendPoint: { connId: null, pointIndex: null },
      bendPointDragOffset: { x: 0, y: 0 },

    }
  },
  mounted() {
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    window.addEventListener('mouseleave', this.handleGlobalMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.loadDiagramsList();
  },

  beforeUnmount() {
    window.removeEventListener('mouseup', this.handleGlobalMouseUp);
    window.removeEventListener('mouseleave', this.handleGlobalMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
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

  methods: {
    checkForChanges() {
      const currentState = {
        elements: this.elements,
        connections: this.connections,
        diagramName: this.diagramName,
        diagramType: this.diagramType
      };
      if (!this.lastSavedState || JSON.stringify(currentState) !== JSON.stringify(this.lastSavedState)) {
        this.hasUnsavedChanges = true;
      } else {
        this.hasUnsavedChanges = false;
      }
    },

    handleKeyDown(event) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedElements.length > 0) {
          this.deleteSelectedElements();
        }
      }
      if (event.ctrlKey || event.metaKey) {
        this.isMultiSelecting = true;
      }
    },
    handleKeyUp(event) {
      if (event.key === 'Control' || event.key === 'Meta') {
        this.isMultiSelecting = false;
      }
    },

    deleteSelectedElements() {
      if (confirm(`Delete ${this.selectedElements.length} elements?`)) {
        const idsToDelete = this.selectedElements.map(el => el.id);
        this.elements = this.elements.filter(el => !idsToDelete.includes(el.id));
        this.connections = this.connections.filter(
            conn => !idsToDelete.includes(conn.from) && !idsToDelete.includes(conn.to)
        );
        this.selectedElements = [];
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
      if (this.diagramType === 'use_case') return this.availableElementTools.find(t => t.type === 'actor')?.type || fallback || null;
      return fallback || null;
    },

    adjustCanvasHeight(delta) {
      const next = Number(this.canvasHeight || 0) + delta;
      this.canvasHeight = Math.max(400, next);
    },

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
      const step = 0.1;
      const delta = event.deltaY > 0 ? -step : step; // wheel down -> уменьшить масштаб
      this.adjustZoom(delta);
    },

    getElementPreset(type) {
      return this.elementPresets.find(p => p.type === type);
    },

    isConnectionTool(tool) {
      return this.connectionToolTypes.includes(tool);
    },

    isElementTool(tool) {
      return this.elementToolTypes.includes(tool);
    },

    alignElementsToGrid() {
      if (!this.snapToGrid) return;
      this.elements = this.elements.map(el => {
        const snapped = this.snapCoordinates(el.x, el.y);
        return {...el, x: snapped.x, y: snapped.y};
      });
      this.updateConnections();
    },

    selectTool(toolType) {
      this.currentTool = toolType;
      this.connectionStart = null;
      this.isConnecting = false;
      this.selectedElement = null;
    },

    getElementShape(type) {
      return this.getElementPreset(type)?.shape || 'rect';
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

      const style = {
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        background: bgColor,
        color: preset?.textColor || '#ffffff',
        border: `${preset?.dashed ? '2px dashed' : '2px solid'} ${borderColor}`,
        borderRadius: shape === 'ellipse' ? '50%' : shape === 'cylinder' ? '0 0 50% 50%' : '10px'
      };

      if (shape === 'cylinder') {
        style.background = `linear-gradient(180deg, ${bgColor} 0%, ${bgColor} 55%, ${borderBase} 100%)`;
      }

      if (this.dragElement?.id === element.id) {
        style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
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
        console.log(`Snapped: (${rawX}, ${rawY}) → (${snappedX}, ${snappedY})`);
      }

      return { x: snappedX, y: snappedY };
    },

    showError(message) {
      console.error('Error:', message);
      this.errorMessage = message;
      // Автоматически скрываем ошибку через 5 секунд
      setTimeout(() => {
        this.errorMessage = null;
      }, 5000);
    },

    handleGlobalMouseUp(event) {
      // Гарантированно останавливаем перетаскивание, даже если мышь вышла за пределы компонента
      if (this.isDragging) {
        console.log('Global mouse up - stopping drag');
        this.isDragging = false;
        this.dragElement = null;
      }

      if (this.isPanning) {
        this.isPanning = false;
      }

      if (this.draggingBendPoint.connId) {
        this.draggingBendPoint = { connId: null, pointIndex: null };
      }

      // НЕ отменяем режим соединения при глобальном mouseup,
      // так как пользователь может кликать на элементы для создания связи
      // Режим соединения отменяется только:
      // 1. При клике на пустое место (обрабатывается в handleCanvasClick)
      // 2. При успешном создании связи (обрабатывается в createConnection)
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },

    handleCanvasClick(event) {
      if (this.currentTool === 'select' || this.currentTool === 'delete') {
        this.deselectAll();
        return;
      }

      if (this.isPanning) return;
      if (!this.currentTool) return;

      const {x, y} = this.getCanvasCoords(event);
      const clickedElement = this.getElementAtPosition(x, y);

      if (clickedElement) return;

      if (this.isConnectionTool(this.currentTool)) {
        this.connectionStart = null;
        this.isConnecting = false;
        if (this.selectedElement && this.selectedElement.id === this.connectionStart?.id) {
          this.selectedElement = null;
        }
        this.currentTool = this.defaultToolForDiagram();
      } else {
        this.createElement(this.currentTool, x, y);
      }
    },

    handleElementClick(element) {
      if (this.currentTool === 'delete') {
        this.deleteElement(element);
        return;
      }

      if (this.isConnectionTool(this.currentTool)) {
        const x = element.x + element.width / 2;
        const y = element.y + element.height / 2;
        this.handleConnectionMode(x, y);
      } else {
        this.toggleSelectElement(element);
      }
    },

    toggleSelectElement(element) {
      if (this.isMultiSelecting) {
        const index = this.selectedElements.findIndex(el => el.id === element.id);
        if (index > -1) {
          this.selectedElements.splice(index, 1);
        } else {
          this.selectedElements.push(element);
        }
      } else {
        this.selectedElements = [element];
      }
      this.selectedConnection = null;
    },

    deleteElement(element) {
      if (confirm(`Удалить элемент "${element.text}" и все связанные связи?`)) {
        this.connections = this.connections.filter(
            c => c.from !== element.id && c.to !== element.id
        );
        this.elements = this.elements.filter(el => el.id !== element.id);
        if (this.selectedElement?.id === element.id) {
          this.selectedElement = null;
        }
      }
    },

    getConnectionColor(connectionType) {
      const preset = this.connectionPresets.find(p => p.type === connectionType);
      return preset?.color || '#34495e';
    },

    getConnectionDash(connectionType) {
      const preset = this.connectionPresets.find(p => p.type === connectionType);
      return preset?.dash || '';
    },

    getMarkerId(connectionType) {
      return this.connectionPresets.some(p => p.type === connectionType) ? `arrow-${connectionType}` : 'arrow-default';
    },

    handleConnectionMode(x, y) {
      if (!this.isConnectionTool(this.currentTool)) {
        return;
      }

      const clickedElement = this.getElementAtPosition(x, y);

      if (!clickedElement) {
        this.connectionStart = null;
        this.isConnecting = false;
        console.log('Clicked outside element - connection cancelled');
        return;
      }

      if (!this.connectionStart) {
        this.connectionStart = clickedElement;
        this.isConnecting = true;
        console.log('First element selected:', clickedElement);
      } else {
        if (this.connectionStart.id !== clickedElement.id) {
          const connType = this.currentTool;
          if (!this.isConnectionAllowed(this.connectionStart, clickedElement, connType)) {
            const message = this.connectionRuleMessage(this.connectionStart, clickedElement, connType);
            this.showError(message);
            console.warn('Connection rejected:', message);
          } else {
            this.createConnection(this.connectionStart, clickedElement);
            console.log('Connection created between:', this.connectionStart, 'and', clickedElement);
          }
        } else {
          console.log('Cannot connect element to itself');
        }

        this.connectionStart = null;
        this.isConnecting = false;
      }
    },

    handleMouseDown(event) {
      // Middle button or Alt+Left — panning
      if (event.button === 1 || event.altKey) {
        this.isPanning = true;
        this.panStart = { ...this.pan };
        this.pointerStart = { x: event.clientX, y: event.clientY };
        return;
      }

      const { x, y } = this.getCanvasCoords(event);
      const element = this.getElementAtPosition(x, y);

      if (element && !this.isConnecting) {
        // If clicked element is not in selection and NOT holding Ctrl → new selection
        if (!this.isMultiSelecting && !this.selectedElements.some(el => el.id === element.id)) {
          this.selectedElements = [element];
        } else if (this.isMultiSelecting && !this.selectedElements.some(el => el.id === element.id)) {
          // Add to selection if Ctrl held
          this.selectedElements.push(element);
        }

        // Prepare drag offsets for ALL selected elements
        this.dragOffsets = this.selectedElements.map(el => ({
          element: el,
          offsetX: x - el.x,
          offsetY: y - el.y
        }));

        this.isDragging = true;
        event.preventDefault();
      }
    },

    handleMouseMove(event) {
      // Drag bend point
      if (this.draggingBendPoint.connId && this.draggingBendPoint.pointIndex !== null) {
        const conn = this.connections.find(c => c.id === this.draggingBendPoint.connId);
        if (!conn || !Array.isArray(conn.points)) return;

        const { x, y } = this.getCanvasCoords(event);
        const raw = { x: x - this.bendPointDragOffset.x, y: y - this.bendPointDragOffset.y };
        const snapped = this.snapToGrid ? this.snapCoordinates(raw.x, raw.y) : raw;

        // update in-place to keep reactivity
        conn.points.splice(this.draggingBendPoint.pointIndex, 1, snapped);
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
        this.updateConnections();
        return;
      }

      if (this.isPanning) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.pan.x = this.panStart.x + dx;
        this.pan.y = this.panStart.y + dy;
        return;
      }

      if (!this.isDragging || this.dragOffsets.length === 0) return;

      const {x, y} = this.getCanvasCoords(event);
      this.dragOffsets.forEach(({element, offsetX, offsetY}) => {
        const newX = x - offsetX;
        const newY = y - offsetY;
        this.moveElement(element.id, newX, newY);
      });
      this.updateConnections();
    },

    handleMouseUp() {
      this.handleGlobalMouseUp(); // Используем общий метод
      if (this.resizingElement) {
        this.resizingElement = null;
      }
      if (this.isPanning) {
        this.isPanning = false;
      }
      this.dragOffsets = [];
    },

    updateConnections() {
      this.connections = this.connections.map(conn => {
        const fromElement = this.elements.find(el => el.id === conn.from);
        const toElement = this.elements.find(el => el.id === conn.to);
        if (!fromElement || !toElement) return conn;

        const start = this.getAnchorPoint(fromElement, toElement);
        const end = this.getAnchorPoint(toElement, fromElement);

        let points = Array.isArray(conn.points) ? conn.points.slice() : [];
        if (points.length < 2) {
          points = [start, this.getDefaultMidpoint(start, end), end];
        } else {
          // update endpoints only, keep middle points as user-defined bend points
          points[0] = start;
          points[points.length - 1] = end;

          // if a connection somehow has only 2 points, insert a midpoint so we have a bend handle
          if (points.length === 2) {
            points.splice(1, 0, this.getDefaultMidpoint(start, end));
          }
        }

        return { ...conn, points };
      });
    },

    moveElement(elementId, newX, newY) {
      const element = this.elements.find(el => el.id === elementId);
      if (element) {
        const snapped = this.snapCoordinates(newX, newY);
        element.x = snapped.x;
        element.y = snapped.y;
      }
    },

    generateId() {
      return this.generateUUID();
    },

    getElementAtPosition(x, y) {
      // Ищем с конца, чтобы верхние элементы (последние добавленные) были приоритетнее
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i];

        // Быстрая проверка: если координаты явно вне bounding box, пропускаем
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
        } else {
          return element;
        }
      }
      return null;
    },

    isClassLike(element) {
      return ['class', 'interface', 'enum', 'component', 'package', 'database'].includes(element?.type);
    },

    isUseCaseElement(element) {
      return ['actor', 'usecase', 'note', 'package'].includes(element?.type);
    },

    isStructuralElement(element) {
      return ['class', 'interface', 'enum', 'component', 'database', 'package', 'note'].includes(element?.type);
    },

    isConnectionAllowed(fromElement, toElement, connectionType) {
      if (this.diagramType === 'free_mode') return true;

      if (connectionType === 'association') {
        if (this.diagramType === 'use_case') {
          return this.isUseCaseElement(fromElement) && this.isUseCaseElement(toElement);
        }
        return this.isStructuralElement(fromElement) && this.isStructuralElement(toElement);
      }

      if (['inheritance', 'composition', 'dependency'].includes(connectionType)) {
        return this.diagramType === 'class' && this.isClassLike(fromElement) && this.isClassLike(toElement);
      }

      return false;
    },

    connectionRuleMessage(fromElement, toElement, connectionType) {
      if (this.diagramType === 'use_case') {
        return 'В диаграмме вариантов использования связи допустимы только между Actor/Use Case/Note/Package.';
      }

      if (connectionType === 'association') {
        return 'Association работает между классами, интерфейсами, enum, компонентами, пакетами или заметками.';
      }

      if (['inheritance', 'composition', 'dependency'].includes(connectionType)) {
        return 'Наследование, композиция и зависимости работают только между классами, интерфейсами, enum, компонентами, пакетами или базами данных.';
      }

      return 'Такое соединение не поддерживается для выбранного типа диаграммы.';
    },

    createConnection(fromElement, toElement) {
      console.log('Creating connection from:', fromElement, 'to:', toElement);

      if (!this.isConnectionAllowed(fromElement, toElement, this.currentTool)) {
        const message = this.connectionRuleMessage(fromElement, toElement, this.currentTool);
        this.showError(message);
        return;
      }

      const connection = {
        id: this.generateId(),
        from: fromElement.id,
        to: toElement.id,
        type: this.currentTool,
        label: '',
        points: this.calculateConnectionPoints(fromElement, toElement),
        customColor: null,
        customDash: null,
        labelColor: '#2c3e50',
        labelFontSize: 12
      };
      this.connections.push(connection);
    },

    async saveDiagram() {
      this.isLoading = true;
      this.errorMessage = null;

      try {
        // Подготавливаем данные для сохранения
        const diagramData = {
          name: this.diagramName || 'Untitled',
          type: this.diagramType,
          svg_data: this.exportToSvg(),
          elements: this.elements.map(el => ({
            id: el.id,
            type: el.type,
            x: Number(el.x) || 0,
            y: Number(el.y) || 0,
            width: Number(el.width) || 120,
            height: Number(el.height) || 60,
            text: el.text || '',
            properties: {
              // ← ALL CUSTOM STYLES GO HERE
              fontSize: el.fontSize,
              customColor: el.customColor,
              customBorder: el.customBorder,
              // Add more later: dashed, etc.
            }
          })),
          connections: this.connections.map(conn => ({
            id: conn.id,
            from: conn.from,
            to: conn.to,
            type: conn.type,
            label: conn.label || '',
            points: conn.points || [],
            properties: {
              customColor: conn.customColor,
              customDash: conn.customDash,
              labelColor: conn.labelColor,
              labelFontSize: conn.labelFontSize
            }
          }))
        };

        console.log('Saving diagram...');

        let response;
        if (this.currentDiagramId) {
          response = await fetch(`/api/v1/diagrams/${this.currentDiagramId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(diagramData)
          });
        } else {
          response = await fetch('/api/v1/diagrams', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(diagramData)
          });
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ошибка сохранения: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        this.currentDiagramId = result.id || this.currentDiagramId;

        // Загружаем историю для отображения
        await this.loadHistory();
        await this.loadDiagramsList();

        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType
        };
        this.hasUnsavedChanges = false;

        alert('Диаграмма сохранена! Снапшот создан.');
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.isLoading = false;
      }
    },

    newDiagram() {
      this.elements = [];
      this.connections = [];
      this.diagramName = '';
      this.diagramType = 'class';
      this.currentTool = 'select';
      this.selectedElement = null;
      this.currentDiagramId = null;
      this.selectedDiagramId = null;
      this.historyEntries = [];
      this.currentVersion = 0;
      this.pan = { x: 0, y: 0 };
    },

    async loadHistory() {
      if (!this.currentDiagramId) return
      const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/history`)
      if (!res.ok) return
      const data = await res.json()
      this.historyEntries = data.entries || []
      this.currentVersion = data.current_version || 0
    },

    async loadDiagramsList() {
      this.isLoadingList = true;
      try {
        const res = await fetch('/api/v1/diagrams');
        if (!res.ok) throw new Error('Не удалось загрузить список диаграмм');
        const data = await res.json();
        this.diagrams = (data.items || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (this.currentDiagramId) {
          this.selectedDiagramId = this.currentDiagramId;
        }
      } catch (err) {
        console.error(err);
        this.showError('Не удалось получить список диаграмм');
      } finally {
        this.isLoadingList = false;
      }
    },

    async loadDiagram(diagramId) {
      this.isLoading = true;
      try {
        const res = await fetch(`/api/v1/diagrams/${diagramId}/state`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Ошибка загрузки: ${res.status} ${text}`);
        }
        const data = await res.json();
        this.currentDiagramId = diagramId;
        this.selectedDiagramId = diagramId;
        this.applySnapshot(data.state);
        this.currentVersion = data.version || 0;
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType
        };
        this.hasUnsavedChanges = false;
        await this.loadHistory();
      } catch (err) {
        this.showError(err.message);
      } finally {
        this.isLoading = false;
      }
    },

    async undoDiagram() {
      if (!this.currentDiagramId) {
        this.showError('Сначала создайте или загрузите диаграмму');
        return;
      }

      this.isLoading = true;
      try {
        const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/undo`, {method: 'POST'});
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (res.status === 400 && errorData.error?.includes('empty')) {
            this.showError('Нечего отменять');
          } else {
            throw new Error(`Ошибка отмены: ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        console.log('Undo response - full data:', JSON.stringify(data, null, 2));
        this.applySnapshot(data.state);
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType
        };
        this.hasUnsavedChanges = false;
        this.currentVersion = data.version;
        await this.loadHistory();
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.isLoading = false;
      }
    },

    async redoDiagram() {
      if (!this.currentDiagramId) {
        this.showError('Сначала создайте или загрузите диаграмму');
        return;
      }

      this.isLoading = true;
      try {
        const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/redo`, {method: 'POST'});
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (res.status === 400 && errorData.error?.includes('empty')) {
            this.showError('Нечего возвращать');
          } else {
            throw new Error(`Ошибка возврата: ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        console.log('Redo response - full data:', JSON.stringify(data, null, 2));
        this.applySnapshot(data.state);
        this.lastSavedState = {
          elements: [...this.elements],
          connections: [...this.connections],
          diagramName: this.diagramName,
          diagramType: this.diagramType
        };
        this.hasUnsavedChanges = false;
        this.currentVersion = data.version;
        await this.loadHistory();
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.isLoading = false;
      }
    },

    applySnapshot(snapshot) {
      if (!snapshot) return;

      console.log('Applying snapshot. Blocks:', snapshot.blocks?.length, 'Connections:', snapshot.connections?.length);

      // Обновляем информацию о диаграмме
      this.diagramName = snapshot.diagram?.name || this.diagramName;
      this.diagramType = snapshot.diagram?.type || this.diagramType;

      // Преобразуем блоки в элементы
      this.elements = (snapshot.blocks || []).map((block) => {
        const props = block.properties || {};
        return {
          id: block.id,
          type: block.type,
          x: Number(block.x),
          y: Number(block.y),
          width: Number(block.width),
          height: Number(block.height),
          text: props.text || block.type,
          fontSize: props.fontSize || 14,
          customColor: props.customColor || null,
          customBorder: props.customBorder || null,
          properties: props // keep full props if needed later
        };
      });

      // Преобразуем connections
      this.connections = (snapshot.connections || []).map((conn) => {
        // Обрабатываем points
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

        // Если points пустые, вычисляем их из блоков
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
          label: conn.label || '',
          points: points
        };
      });

      // Сбрасываем выделение
      this.selectedElement = null;
      this.connectionStart = null;
      this.isConnecting = false;

      this.updateConnections();
      console.log('Applied elements:', this.elements.length, 'connections:', this.connections.length);
    },

    exportToSvg() {
      return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><!-- rendered elements --></svg>`
    },

    selectElement(element) {
      if (this.isConnecting) return;
      this.selectedElement = element;
      this.selectedConnection = null; // deselect connection if any
    },

    selectConnection(conn) {
      this.selectedConnection = conn;
      this.selectedElement = null;
    },

    deselectAll() {
      this.selectedElement = null;
      this.selectedConnection = null;
    },

    handleResizeMouseDown(element, event) {
      this.resizingElement = element;
      const canvasRect = this.$el.querySelector('.canvas').getBoundingClientRect();
      this.resizeStart = {
        x: (event.clientX - canvasRect.left) / this.zoom,
        y: (event.clientY - canvasRect.top) / this.zoom,
        width: element.width,
        height: element.height
      };
    },

    getCanvasCoords(event) {
      const canvasEl = this.$el.querySelector('.canvas');
      const canvasRect = (canvasEl || event.currentTarget).getBoundingClientRect();
      return {
        x: (event.clientX - canvasRect.left - this.pan.x) / this.zoom,
        y: (event.clientY - canvasRect.top - this.pan.y) / this.zoom
      };
    },

    handleBendPointMouseDown(conn, pointIndex, event) {
      if (!conn || !Array.isArray(conn.points)) return;
      const pt = conn.points[pointIndex];
      if (!pt) return;

      this.draggingBendPoint = { connId: conn.id, pointIndex };

      const { x, y } = this.getCanvasCoords(event);
      this.bendPointDragOffset = { x: x - pt.x, y: y - pt.y };

      // stop element dragging if any
      this.isDragging = false;
      this.dragElement = null;
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


    createElement(type, x, y) {
      const preset = this.getElementPreset(type);
      const element = {
        id: this.generateUUID(),
        type: type,
        x: this.snapCoordinates(x - (preset?.width || 120)/2, y - (preset?.height || 60)/2).x,
        y: this.snapCoordinates(x - (preset?.width || 120)/2, y - (preset?.height || 60)/2).y,
        width: preset?.width || 120,
        height: preset?.height || 60,
        text: this.getDefaultText(type),
        fontSize: 14,
        customColor: null,
        customBorder: null,
        properties: {}
      };
      this.elements.push(element);
      this.selectElement(element);
    },

    generateUUID() {
      // Генерируем UUID v4
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
        package: 'Package',
        association: 'Association'
      };
      return texts[type] || type;
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

.subtitle {
  margin: 0;
  color: #ecf0f1;
  font-size: 0.9rem;
}

.logo-placeholder {
  min-height: 1px;
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

.controls .diagram-select {
  min-width: 140px;
  padding: 0.25rem 0.4rem;
  min-height: 28px;
  border-radius: 5px;
  border: 1px solid #d0d7de;
  font-size: 0.9rem;
}

.controls .canvas-size {
  width: 100%;
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

.canvas-inner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform229-origin: 0 0;
  will-change: transform;
}

.controls button:hover {
  background: #2d83be;
}

.controls button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.history-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.badge {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.toolbar {
  width: 280px;
  min-width: 260px;
  flex: 0 0 280px;
  background: #f4f6f8;
  padding: 0.75rem;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  height: 100%;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(110px, 1fr));
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

.element {
  position: absolute;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 6px;
  box-sizing: border-box;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  color: inherit;
}

.element:hover {
  transform: scale(1.03);
  box-shadow: 0 6px 12px rgba(0,0,0,0.18);
}

.resize-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  right: -2px;
  bottom: -2px;
  background: #e74c3c;
  border-radius: 4px;
  cursor: se-resize;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
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

.element.dragging {
  cursor: grabbing !important;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  z-index: 1000;
}

.element.selected {
  outline: 2px solid #e74c3c;
  outline-offset: 1px;
}

.element-text-main {
  font-size: 14px;
}

.element-type-tag {
  margin-top: 4px;
  font-size: 11px;
  color: inherit;
  opacity: 0.75;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.shape-ellipse .element-type-tag {
  margin-top: 2px;
}

.shape-cylinder .element-text-main {
  margin-bottom: 4px;
}

.canvas {
  flex: 1;
  background: white;
  position: relative;
  cursor: crosshair;
  min-height: 720px;
  user-select: none;
  overflow: hidden;
  z-index: 1;
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

.connection-label-editor {
  background: white;
  border: 1px solid #3498db;
  border-radius: 4px;
  padding: 2px 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.connection-label-editor input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  width: 140px;
  text-align: center;
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

/* ============================= */
/*     PROPERTIES PANEL STYLES   */
/* ============================= */

.properties-panel {
  width: 340px;
  min-width: 320px;
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-shadow: -6px 0 20px rgba(0, 0, 0, 0.08);
  z-index: 10;
  font-size: 0.95rem;
  transition: width 0.2s ease;
}

.properties-header {
  background: #2c3e50;
  color: white;
  padding: 1rem 1.2rem;
  margin: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  border-bottom: 3px solid #3498db;
}

.properties-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.8rem;
  cursor: pointer;
  padding: 0 0.4rem;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

.properties-content {
  padding: 1.4rem 1.2rem;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prop-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
}

.prop-group input[type="text"],
.prop-group input[type="number"],
.prop-group select {
  padding: 0.7rem 0.9rem;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  font-size: 1rem;
  transition: border 0.2s;
}

.prop-group input[type="text"]:focus,
.prop-group input[type="number"]:focus,
.prop-group select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
}

.prop-group input[type="color"] {
  height: 44px;
  padding: 4px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  cursor: pointer;
}

.range-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.range-wrapper input[type="range"] {
  flex: 1;
}

.range-value {
  min-width: 50px;
  text-align: right;
  font-family: monospace;
  color: #3498db;
  font-weight: 600;
}

.prop-group.info {
  padding-top: 0.8rem;
  border-top: 1px dashed #e5e7eb;
  margin-top: 0.8rem;
}

.prop-value {
  color: #7f8c8d;
  font-weight: 500;
  font-size: 0.95rem;
}

/* Multi-select info panel */
.multi-select-info {
  background: #f8f9fa;
}

.multi-select-info .properties-header {
  background: #34495e;
}

.selected-connection {
  filter: drop-shadow(0 0 6px #3498db);
  stroke-width: 6 !important;
}
</style>
