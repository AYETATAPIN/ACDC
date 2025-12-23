<template>
  <div class="app">
    <DiagramHeader
      :diagram-name="diagramName"
      :diagram-type="diagramType"
      :snap-to-grid="snapToGrid"
      :has-unsaved-changes="hasUnsavedChanges"
      :current-diagram-id="currentDiagramId"
      :selected-diagram-id="selectedDiagramId"
      :diagrams="diagrams"
      :is-loading-list="isLoadingList"
      :zoom="zoom"
      :selected-connection="selectedConnection"
      :selected-bend-point="selectedBendPoint"
      :has-bend-points="hasBendPoints"
      :set-diagram-name="setDiagramName"
      :set-diagram-type="setDiagramType"
      :set-selected-diagram-id="setSelectedDiagramId"
      :toggle-grid="toggleGrid"
      :save-diagram="saveDiagram"
      :new-diagram="newDiagram"
      :undo-diagram="undoDiagram"
      :redo-diagram="redoDiagram"
      :load-diagram="loadDiagram"
      :load-diagrams-list="loadDiagramsList"
      :adjust-zoom="adjustZoom"
      :remove-selected-bend-point="removeSelectedBendPoint"
      :remove-last-bend-point="removeLastBendPoint"
    />

    <div v-if="errorMessage" class="error-toast">
      <div class="error-content">
        <strong>Ошибка:</strong> {{ errorMessage }}
        <button @click="errorMessage = null" class="error-close">×</button>
      </div>
    </div>

    <div class="main">
      <DiagramToolbar
          :selection-tools="selectionTools"
          :available-element-tools="availableElementTools"
          :available-connection-tools="availableConnectionTools"
          :current-tool="currentTool"
          :select-tool="selectTool"
          :diagrams="diagrams"
          :current-diagram-id="currentDiagramId"
          :is-loading-list="isLoadingList"
          :load-diagrams-list="loadDiagramsList"
          :load-diagram="loadDiagram"
          :format-date="formatDate"
          :get-connection-color="getConnectionColor"
          :elements-count="elements.length"
          :connections-count="connections.length"
          :is-connecting="isConnecting"
          :is-dragging="isDragging"
      />

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
                :stroke-width="conn.strokeWidth || 2" 
                :stroke-dasharray="conn.customDash || getConnectionDash(conn.type) || null"
                :marker-end="`url(#${getMarkerId(conn)})`"
                fill="none"
                style="pointer-events: stroke; cursor: pointer;"
                @click.stop="handleConnectionClick(conn, $event)"
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
                    :fill="(draggingBendPoint.connId === conn.id && draggingBendPoint.pointIndex === idx) ? '#c0392b' : (selectedBendPoint.connId === conn.id && selectedBendPoint.pointIndex === idx ? '#f39c12' : '#e74c3c')"
                    stroke="#ffffff"
                    stroke-width="2"
                    style="pointer-events: all; cursor: move;"
                    @mousedown.stop.prevent="handleBendPointMouseDown(conn, idx, $event)"
                    @dblclick.stop.prevent="removeBendPoint(conn, idx)"
                />
                <circle v-if="idx > 0 && idx < (conn.points.length - 1)" :cx="pt.x" :cy="pt.y" r="14" fill="transparent" style="pointer-events: all; cursor: move;" @mousedown.stop.prevent="handleBendPointMouseDown(conn, idx, $event)" @dblclick.stop.prevent="removeBendPoint(conn, idx)" />
              </template>
            </g>

            <defs>
              <marker
                v-for="conn in connections"
                :key="`arrow-${conn.id}`"
                :id="`arrow-${conn.id}`"
                markerWidth="12"
                markerHeight="12"
                refX="12"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
                viewBox="0 0 12 12"
              >
                <polygon
                  points="0 0, 12 6, 0 12"
                  :fill="conn.customColor || getConnectionColor(conn.type)"
                  :stroke="conn.customColor || getConnectionColor(conn.type)"
                  stroke-width="0"
                />
              </marker>
              <marker
                id="arrow-default"
                markerWidth="12"
                markerHeight="12"
                refX="12"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
                viewBox="0 0 12 12"
              >
                <polygon points="0 0, 12 6, 0 12" :fill="getConnectionColor('association')" :stroke="getConnectionColor('association')" stroke-width="0" />
              </marker>
                  <!-- Пустая стрелка (для наследования и реализации) -->
              <marker
                  id="arrow-empty"
                  markerWidth="12"
                  markerHeight="12"
                  refX="12"
                  refY="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                  viewBox="0 0 12 12"
              >
                  <polygon
                      points="0 0, 12 6, 0 12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1"
                  />
              </marker>
              
              <!-- Закрашенный ромб (композиция) -->
              <marker
                  id="arrow-filled-diamond"
                  markerWidth="12"
                  markerHeight="12"
                  refX="12"
                  refY="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                  viewBox="0 0 12 12"
              >
                  <polygon
                      points="0 6, 6 0, 12 6, 6 12"
                      fill="currentColor"
                      stroke="currentColor"
                      stroke-width="0"
                  />
              </marker>
              
              <!-- Пустой ромб (агрегация) -->
              <marker
                  id="arrow-empty-diamond"
                  markerWidth="12"
                  markerHeight="12"
                  refX="12"
                  refY="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                  viewBox="0 0 12 12"
              >
                  <polygon
                      points="0 6, 6 0, 12 6, 6 12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1"
                  />
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

          <!-- Selection box -->
          <div
              v-if="selectionBox"
              class="selection-box"
              :style="{
              left: selectionBox.x + 'px',
              top: selectionBox.y + 'px',
              width: selectionBox.width + 'px',
              height: selectionBox.height + 'px'
            }"
          ></div>

          <!-- Elements -->
          <div
              v-for="element in elements"
              :key="element.id"
              class="element"
              :class="[{ 
                  dragging: dragElement?.id === element.id,
                  selected: isElementSelected(element)
              }, `shape-${getElementShape(element.type)}`]"
              :style="getElementStyle(element)"
              @click.stop="handleElementClick(element)"
          >
              <!-- Для классов с атрибутами и операциями -->
              <template v-if="element.type === 'class'">
                  <!-- Заголовок класса -->
                  <div class="class-header" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || 'Class' }}
                  </div>
                  
                  <!-- Разделитель -->
                  <hr class="class-divider" />
                  
                  <!-- Атрибуты -->
                  <div class="class-section attributes">
                      <div 
                          v-for="(attr, index) in (element.properties?.attributes || [])" 
                          :key="'attr-' + index"
                          class="class-line"
                      >
                          {{ attr }}
                      </div>
                      <div v-if="!(element.properties?.attributes?.length)" class="class-placeholder">
                          &lt;attributes&gt;
                      </div>
                  </div>
                  
                  <!-- Разделитель -->
                  <hr class="class-divider" />
                  
                  <!-- Операции -->
                  <div class="class-section operations">
                      <div 
                          v-for="(op, index) in (element.properties?.operations || [])" 
                          :key="'op-' + index"
                          class="class-line"
                      >
                          {{ op }}
                      </div>
                      <div v-if="!(element.properties?.operations?.length)" class="class-placeholder">
                          &lt;operations&gt;
                      </div>
                  </div>
                  
                  <div class="element-type-tag">{{ element.type }}</div>
              </template>

              <!-- Для ромбов (decision, merge) -->
              <template v-else-if="getElementShape(element.type) === 'diamond'">
                  <div class="diamond-content">
                      <div class="diamond-title" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                          {{ element.text || getDefaultText(element.type) }}
                      </div>
                      <div class="diamond-type">{{ element.type }}</div>
                  </div>
              </template>
              <template v-else-if="element.type === 'actor'">
                  <div class="actor-container">
                      <!-- Голова -->
                      <div class="actor-head" :style="{ 
                          width: '30px', 
                          height: '30px', 
                          backgroundColor: element.customColor || getElementPreset('actor')?.color || '#27ae60',
                          border: `2px solid ${element.customBorder || getElementPreset('actor')?.border || '#229954'}`,
                          borderRadius: '50%',
                          margin: '0 auto 8px'
                      }"></div>
                      
                      <!-- Тело -->
                      <div class="actor-body" :style="{ 
                          width: '2px', 
                          height: '30px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto'
                      }"></div>
                      
                      <!-- Руки -->
                      <div class="actor-arms" :style="{ 
                          width: '40px', 
                          height: '2px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto',
                          position: 'relative',
                          top: '-15px'
                      }"></div>
                      
                      <!-- Ноги -->
                      <div class="actor-legs" :style="{ 
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '10px',
                          marginTop: '8px'
                      }">
                          <div :style="{ 
                              width: '2px', 
                              height: '25px', 
                              backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                              transform: 'rotate(30deg)'
                          }"></div>
                          <div :style="{ 
                              width: '2px', 
                              height: '25px', 
                              backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                              transform: 'rotate(-30deg)'
                          }"></div>
                      </div>
                      
                      <!-- Название актора -->
                      <div class="actor-name" :style="{ 
                          fontSize: (element.fontSize || 12) + 'px',
                          color: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          textAlign: 'center',
                          marginTop: '10px',
                          fontWeight: 'bold'
                      }">
                          {{ element.text || 'Actor' }}
                      </div>
                  </div>
                  <div class="element-type-tag">{{ element.type }}</div>
              </template>
              <!-- Для остальных типов -->
              <template v-else>
                  <div class="element-text-main" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || getDefaultText(element.type) }}
                  </div>
                  <div class="element-type-tag">{{ element.type }}</div>
              </template>
              
              <div class="resize-handle" @mousedown.stop="handleResizeMouseDown(element, $event)" title="Изменить размер"></div>
          </div>
        </div>
      </div>

      <DiagramPropertiesPanel
        :selected-element="primarySelectedElement"
        :selected-connection="selectedConnection"
        :selected-bend-point="selectedBendPoint"
        :get-element-preset="getElementPreset"
        :deselect-all="deselectAll"
        :add-bend-point-at-midpoint="addBendPointAtMidpoint"
        :has-bend-points="hasBendPoints"
        :clear-bend-points="clearBendPoints"
        :remove-selected-bend-point="removeSelectedBendPoint"
        :remove-last-bend-point="removeLastBendPoint"
        :delete-connection="deleteConnection" 
      />

      <DiagramHistoryPanel
        v-if="currentDiagramId"
        :history-entries="historyEntries"
        :current-version="currentVersion"
        :history-collapsed="historyCollapsed"
        :format-date="formatDate"
        :toggle-history="toggleHistoryCollapsed"
      />
    </div>
  </div>
</template>

<script>
import { findBestSegmentIndex, toggleBendPointPoints } from './utils/bendPoints.js';
import DiagramHeader from './components/DiagramHeader.vue';
import DiagramToolbar from './components/DiagramToolbar.vue';
import DiagramPropertiesPanel from './components/DiagramPropertiesPanel.vue';
import DiagramHistoryPanel from './components/DiagramHistoryPanel.vue';

export default {
  name: 'App',
  components: {
    DiagramHeader,
    DiagramToolbar,
    DiagramPropertiesPanel,
    DiagramHistoryPanel
  },
  data() {
    return {
      lastSavedState: null,
      hasUnsavedChanges: false,
      snapToGrid: true,
      gridSize: 10,
      elementPresets: [
        // Инструменты (всегда доступны)
        { type: 'select', label: 'Select/Move', shape: '➡️', diagrams: ['class', 'use_case', 'activity_diagram', 'free_mode'] },
        { type: 'delete', label: 'Delete', shape: '🗑️', diagrams: ['class', 'use_case', 'activity_diagram', 'free_mode'] },
        
        // Class Diagram элементы
        { type: 'class', label: 'Class', shape: 'rect', color: '#3498db', border: '#2d83be', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'interface', label: 'Interface', shape: 'rect', color: '#9b59b6', border: '#8e44ad', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'enum', label: 'Enum', shape: 'rect', color: '#e67e22', border: '#d35400', textColor: '#ffffff', width: 140, height: 80, diagrams: ['class', 'free_mode'] },
        { type: 'component', label: 'Component', shape: 'rect', color: '#16a085', border: '#13856f', textColor: '#ffffff', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'database', label: 'Database', shape: 'cylinder', color: '#34495e', border: '#2c3e50', textColor: '#ecf0f1', width: 150, height: 90, diagrams: ['class', 'free_mode'] },
        { type: 'note', label: 'Note', shape: 'rect', color: '#fff7d6', border: '#f1c40f', textColor: '#2c3e50', width: 160, height: 100, diagrams: ['class', 'use_case', 'free_mode'], dashed: true },
        { type: 'package', label: 'Package', shape: 'rect', color: '#1abc9c', border: '#16a085', textColor: '#ffffff', width: 180, height: 100, diagrams: ['class', 'use_case', 'free_mode'] },
        
        // Use Case Diagram элементы
        { type: 'actor', label: 'Actor', shape: 'actor', color: '#27ae60', border: '#229954', textColor: '#ffffff', width: 60, height: 100, diagrams: ['use_case', 'free_mode'] },
        { type: 'usecase', label: 'Use Case', shape: 'ellipse', color: '#f97316', border: '#ea580c', textColor: '#ffffff', width: 160, height: 90, diagrams: ['use_case', 'free_mode'] },
        
        // Activity Diagram элементы
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
        // Общие связи (для нескольких типов диаграмм)
        { type: 'association', label: 'Ассоциация', color: '#34495e', diagrams: ['class', 'use_case', 'free_mode'], dash: '' },
        { type: 'dependency', label: 'Зависимость', color: '#7f8c8d', diagrams: ['class', 'use_case', 'free_mode'], dash: '6 4' },
        
        // Только для Class Diagram
        { type: 'inheritance', label: 'Наследование', color: '#8e44ad', diagrams: ['class', 'free_mode'], dash: '10 6' },
        { type: 'composition', label: 'Композиция', color: '#27ae60', diagrams: ['class', 'free_mode'], dash: '' },
        { type: 'realization', label: 'Реализация', color: '#9b59b6', diagrams: ['class', 'free_mode'], dash: '10 6' },
        { type: 'aggregation', label: 'Агрегация', color: '#e67e22', diagrams: ['class', 'free_mode'], dash: '' },
        
        // Только для Use Case Diagram
        { type: 'extend', label: 'Extend', color: '#c0392b', diagrams: ['use_case', 'free_mode'], dash: '4 4' },
        { type: 'include', label: 'Include', color: '#3498db', diagrams: ['use_case', 'free_mode'], dash: '4 4' },
        
        // Только для Activity Diagram
        { type: 'control_flow', label: 'Control Flow', color: '#2c3e50', diagrams: ['activity_diagram', 'free_mode'], dash: '' },
        { type: 'object_flow', label: 'Object Flow', color: '#e67e22', diagrams: ['activity_diagram', 'free_mode'], dash: '6 4' },
      ],
      diagramName: '',
      diagramType: 'class',
      currentTool: 'select',
      selectedConnection: null,
      editingConnectionLabel: null,
      elements: [],
      connections: [],
      selectedElement: null,
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
      selectedBendPoint: { connId: null, pointIndex: null },

      selectedElements: [],          // array of selected elements (replaces single selectedElement for multi)
      isMultiSelectDragging: false, // are we dragging the whole group?
      multiDragOffset: { x: 0, y: 0 }, // offset from mouse to group centre
      selectionBox: null,            // {x, y, width, height} for drag-select rectangle
      selectionBoxStart: null,       // start point of selection box
      // Prevent deselection right after drag or selection box
      justInteracted: false,

    }
  },
  mounted() {
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    window.addEventListener('mouseleave', this.handleGlobalMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.loadDiagramsList();
  },

  beforeUnmount() {
    window.removeEventListener('mouseup', this.handleGlobalMouseUp);
    window.removeEventListener('mouseleave', this.handleGlobalMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
  },

  computed: {
    availableConnectionTools() {
      // Получаем все связи для текущего типа диаграммы
      const allConnections = this.connectionPresets.filter(p => 
        p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode'
      );
      
      // Убираем дубликаты по type
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
      return this.availableElementTools.map(p => p.type);
    },
    connectionToolTypes() {
      return this.availableConnectionTools.map(p => p.type);
    },
    selectionTools() {
        return this.elementPresets.filter(p => 
            ['select', 'delete'].includes(p.type) && 
            (p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode')
        );
    },
    
    // Элементы без инструментов выбора/удаления
    availableElementTools() {
        return this.elementPresets.filter(p => 
            !['select', 'delete'].includes(p.type) && 
            (p.diagrams.includes(this.diagramType) || this.diagramType === 'free_mode')
        );
    },

    isElementSelected() {
      return (element) => {
        return this.selectedElements.some(el => el.id === element.id);
      };
    },

    // Helper: primary selected element (first one) – used for properties panel
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

  methods: {
    setElements(nextElements) {
      this.elements = nextElements;
      if (this.selectedElement) {
        const updated = nextElements.find(el => el.id === this.selectedElement.id);
        this.selectedElement = updated || null;
      }
    },

    setConnections(nextConnections) {
      this.connections = nextConnections;
      if (this.selectedConnection) {
        const updated = nextConnections.find(conn => conn.id === this.selectedConnection.id);
        this.selectedConnection = updated || null;
      }
    },

    setDiagramName(value) {
      this.diagramName = value;
    },

    setDiagramType(value) {
      this.diagramType = value;
    },

    setSelectedDiagramId(value) {
      this.selectedDiagramId = value;
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
        diagramType: this.diagramType
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

    handleKeyDown(event) {
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedBendPoint.connId) {
          this.removeSelectedBendPoint();
          return;
        }
        if (this.selectedElement) {
          this.deleteElement(this.selectedElement);
        }
      }
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
    // В methods App.vue добавляем:
    deleteConnection(connection) {
      if (confirm('Удалить эту связь?')) {
        this.setConnections(this.connections.filter(c => c.id !== connection.id));
        this.selectedConnection = null;
        this.selectedBendPoint = { connId: null, pointIndex: null };
      }
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
      this.setElements(this.elements.map(el => {
        const snapped = this.snapCoordinates(el.x, el.y);
        return {...el, x: snapped.x, y: snapped.y};
      }));
      this.updateConnections();
    },

    selectTool(toolType) {
      this.currentTool = toolType;
      this.connectionStart = null;
      this.isConnecting = false;
      this.selectedElement = null;
    },

    getElementShape(type) {
        const preset = this.elementPresets.find(p => p.type === type);
        if (preset) return preset.shape;
        
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
            'actor': 'actor'  // Добавляем
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

      // Базовый стиль
      const style = {
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        background: bgColor,
        color: preset?.textColor || '#ffffff',
        border: `2px solid ${borderColor}`,
      };

      // Специальные формы
      if (shape === 'actor') {
          // Для актора убираем стандартные стили
          style.background = 'transparent';
          style.border = 'none';
          style.boxShadow = 'none';
      }
      if (shape === 'ellipse') {
        style.borderRadius = '50%';
      } else if (shape === 'roundrect') {
        style.borderRadius = '20px';
      } else if (shape === 'diamond') {
        // Превращаем в ромб через трансформацию
      style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      style.width = `${element.width}px`;
      style.height = `${element.height}px`;
      style.display = 'flex';
      style.flexDirection = 'column';
      style.alignItems = 'center';
      style.justifyContent = 'center';
      } else if (shape === 'bar') {
        // Толстая линия для fork/join
        style.borderRadius = '0';
        style.height = `${element.height}px`;
        style.width = `${element.width}px`;
      } else if (shape === 'pentagon') {
        // Пятиугольник для сигналов
        style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
      } else if (shape === 'double-circle') {
        // Двойной круг для конечного состояния
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
      // Ignore clicks right after drag or selection box
      if (this.justInteracted) {
        this.justInteracted = false;
        return;
      }

      if (this.currentTool === 'select' || this.currentTool === 'delete') {
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
      // If we just finished a drag (single or multi) — ignore this click completely
      if (this.justInteracted) {
        return;
      }

      // PRIORITY 1: Connection tool active → handle connection, do NOT select
      if (this.isConnectionTool(this.currentTool)) {
        const x = element.x + element.width / 2;
        const y = element.y + element.height / 2;
        this.handleConnectionMode(x, y);
        return; // Important: do not fall through to selection
      }

      // PRIORITY 2: Delete tool
      if (this.currentTool === 'delete') {
        this.deleteElement(element);
        return;
      }

      // PRIORITY 3: Normal selection (select tool or other element tools)
      this.selectElement(element, event);
    },

    deleteElement(element) {
      if (confirm(`Удалить элемент "${element.text}" и все связанные связи?`)) {
        this.setConnections(this.connections.filter(
            c => c.from !== element.id && c.to !== element.id
        ));
        this.setElements(this.elements.filter(el => el.id !== element.id));
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

    getMarkerId(conn) {
      if (!conn) return 'arrow-default';
      
      // Для разных типов связей разные маркеры
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

    handleConnectionMode(x, y) {
      if (!this.isConnectionTool(this.currentTool)) return;

      const clickedElement = this.getElementAtPosition(x, y);

      if (!clickedElement) {
        this.connectionStart = null;
        this.isConnecting = false;
        return;
      }

      if (!this.connectionStart) {
        this.connectionStart = clickedElement;
        this.isConnecting = true;
      } else if (this.connectionStart.id !== clickedElement.id) {
        if (this.isConnectionAllowed(this.connectionStart, clickedElement, this.currentTool)) {
          this.createConnection(this.connectionStart, clickedElement);
        } else {
          this.showError(this.connectionRuleMessage(this.connectionStart, clickedElement, this.currentTool));
        }
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
        // If connection tool is active → do NOT select or start drag, let handleElementClick handle it
        if (this.isConnectionTool(this.currentTool)) {
          // Do nothing here — connection will be handled in handleElementClick via @click
          return;
        }

        // Normal case: select tool or element tool → handle selection and drag
        const alreadySelected = this.selectedElements.some(el => el.id === element.id);
        const hasMultiple = this.selectedElements.length > 1;

        // If clicking on already multi-selected element → start group drag without changing selection
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

        // After selection — prepare drag (single or multi)
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

      // 3. Clicked on empty space — handled by handleCanvasClick
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

        this.selectedElements.forEach(el => {
          const snapped = this.snapCoordinates(el.x + deltaX, el.y + deltaY);
          el.x = snapped.x;
          el.y = snapped.y;
        });

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

      if (!this.isDragging || !this.dragElement) return;

      const {x, y} = this.getCanvasCoords(event);

      const newX = x - this.dragOffset.x;
      const newY = y - this.dragOffset.y;

      this.moveElement(this.dragElement.id, newX, newY);

      this.updateConnections();
    },

    handleMouseUp() {
      this.handleGlobalMouseUp(); // Останавливаем все драги

      // НЕ сбрасываем justInteracted здесь!
      // Сбрасываем его ЧУТЬ ПОЗЖЕ — после того, как click-событие успеет отработать

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

      // Сбрасываем флаг с небольшой задержкой — после того, как click уже отработает
      setTimeout(() => {
        this.justInteracted = false;
      }, 50);  // 50 мс достаточно, чтобы click прошёл
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
    },

// Update element visual selection class
    isElementSelected(element) {
      return this.selectedElements.some(el => el.id === element.id);
    },

    updateConnections() {
      this.setConnections(this.connections.map(conn => {
        const fromElement = this.elements.find(el => el.id === conn.from);
        const toElement = this.elements.find(el => el.id === conn.to);
        if (!fromElement || !toElement) return conn;

        const start = this.getAnchorPoint(fromElement, toElement);
        const end = this.getAnchorPoint(toElement, fromElement);

        let points = Array.isArray(conn.points) ? conn.points.slice() : [];
        if (points.length < 2) {
          points = [start, end];
        } else {
          // update endpoints only, keep middle points as user-defined bend points
          points[0] = start;
          points[points.length - 1] = end;
        }

        return { ...conn, points };
      }));
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

    isConnectionAllowed(fromElement, toElement, connectionType) {
      if (this.diagramType === 'free_mode') return true;

      if (this.diagramType === 'class') {
        // Для Class диаграммы разрешаем только между структурными элементами
        if (!this.isClassLike(fromElement) || !this.isClassLike(toElement)) {
          return false;
        }
        
        // Разрешенные связи для Class диаграммы
        const allowedClassConnections = [
          'association', 'inheritance', 'composition', 
          'dependency', 'realization', 'aggregation'
        ];
        
        return allowedClassConnections.includes(connectionType);
      }

      if (this.diagramType === 'use_case') {
        // Для Use Case диаграммы разрешаем только между Use Case элементами
        if (!this.isUseCaseElement(fromElement) || !this.isUseCaseElement(toElement)) {
          return false;
        }
        
        // Разрешенные связи для Use Case диаграммы
        const allowedUseCaseConnections = [
          'association', 'dependency', 'extend', 'include'
        ];
        
        return allowedUseCaseConnections.includes(connectionType);
      }

      if (this.diagramType === 'activity_diagram') {
        // Для Activity Diagram разрешаем только между Activity элементами
        if (!this.isActivityElement(fromElement) || !this.isActivityElement(toElement)) {
          return false;
        }
        
        // Разрешенные связи для Activity Diagram
        const allowedActivityConnections = [
          'control_flow', 'object_flow'
        ];
        
        return allowedActivityConnections.includes(connectionType);
      }

      return false;
    },

    connectionRuleMessage(fromElement, toElement, connectionType) {
      if (this.diagramType === 'class') {
        if (!this.isClassLike(fromElement) || !this.isClassLike(toElement)) {
          return 'В Class диаграмме можно соединять только структурные элементы: классы, интерфейсы, перечисления, компоненты, базы данных, пакеты и заметки.';
        }
        
        const allowedClassConnections = [
          'association', 'inheritance', 'composition', 
          'dependency', 'realization', 'aggregation'
        ];
        
        if (!allowedClassConnections.includes(connectionType)) {
          return 'В Class диаграмме допустимы только: Association, Inheritance, Composition, Dependency, Realization, Aggregation.';
        }
        
        return 'Connection allowed';
      }

      if (this.diagramType === 'use_case') {
        if (!this.isUseCaseElement(fromElement) || !this.isUseCaseElement(toElement)) {
          return 'В Use Case диаграмме можно соединять только: Actor, Use Case, Package, Note.';
        }
        
        const allowedUseCaseConnections = [
          'association', 'dependency', 'extend', 'include'
        ];
        
        if (!allowedUseCaseConnections.includes(connectionType)) {
          return 'В Use Case диаграмме допустимы только: Association, Dependency, Extend, Include.';
        }
        
        // Особые правила для Extend и Include
        if ((connectionType === 'extend' || connectionType === 'include') && 
            (!fromElement?.type === 'usecase' || !toElement?.type === 'usecase')) {
          return 'Extend и Include работают только между Use Case элементами.';
        }
        
        return 'Connection allowed';
      }

      if (this.diagramType === 'activity_diagram') {
        if (!this.isActivityElement(fromElement) || !this.isActivityElement(toElement)) {
          return 'В Activity Diagram можно соединять только элементы Activity Diagram.';
        }
        
        const allowedActivityConnections = [
          'control_flow', 'object_flow'
        ];
        
        if (!allowedActivityConnections.includes(connectionType)) {
          return 'В Activity Diagram допустимы только Control Flow и Object Flow связи.';
        }
        
        return 'Connection allowed';
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

      const start = this.getAnchorPoint(fromElement, toElement);
      const end = this.getAnchorPoint(toElement, fromElement);
      const mid = this.getDefaultMidpoint(start, end);
      const connection = {
        id: this.generateId(),
        from: fromElement.id,
        to: toElement.id,
        type: this.currentTool,
        label: '',
        points: [start, mid, end],
        customColor: null,
        customDash: null,
        strokeWidth: 2, // Добавляем толщину по умолчанию
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
            width: Number(el.width) || 0,
            height: Number(el.height) || 0,
            text: el.text,
            properties: {
              ...(el.properties || {}),
              fontSize: el.fontSize ?? 14,
              customColor: el.customColor ?? null,
              customBorder: el.customBorder ?? null
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
              customColor: conn.customColor ?? null,
              customDash: conn.customDash ?? null,
              labelColor: conn.labelColor ?? '#2c3e50',
              labelFontSize: conn.labelFontSize ?? 12
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
      this.setElements([]);
      this.setConnections([]);
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
            x: Number(block.x),
            y: Number(block.y),
            width: Number(block.width),
            height: Number(block.height),
            text: props.text || props.label || block.type,
            fontSize: Number(props.fontSize) || 14,
            customColor: props.customColor ?? null,
            customBorder: props.customBorder ?? null,
            properties: {
                // Для классов убедимся, что есть массивы атрибутов и операций
                ...(block.type === 'class' ? {
                    attributes: Array.isArray(props.attributes) ? props.attributes : [],
                    operations: Array.isArray(props.operations) ? props.operations : [],
                } : {}),
                ...props
            }
        };
      }));

      // Преобразуем connections
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
          points: points,
          customColor: props.customColor ?? null,
          customDash: props.customDash ?? null,
          labelColor: props.labelColor ?? '#2c3e50',
          labelFontSize: Number(props.labelFontSize) || 12,
          properties: props
        };
      }));

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

      this.selectedConnection = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
    },

    selectConnection(conn) {
      this.selectedConnection = conn;
      this.selectedElement = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
    },

    hasBendPoints(conn) {
      return Array.isArray(conn?.points) && conn.points.length > 2;
    },

    handleConnectionClick(conn, event) {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        this.toggleBendPoint(conn, event);
        return;
      }
      this.selectConnection(conn);
    },

    deselectAll() {
      this.selectedElements = [];
      this.selectedConnection = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.selectionBox = null;
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

    getCanvasPointFromClient(clientX, clientY) {
      const canvasEl = this.$el.querySelector('.canvas');
      if (!canvasEl) return {x: 0, y: 0};
      const rect = canvasEl.getBoundingClientRect();
      return {
        x: (clientX - rect.left - this.pan.x) / this.zoom,
        y: (clientY - rect.top - this.pan.y) / this.zoom
      };
    },

    handleBendPointMouseDown(conn, pointIndex, event) {
      if (!conn || !Array.isArray(conn.points)) return;
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

      const { x, y } = this.getCanvasCoords(event);
      this.bendPointDragOffset = { x: x - pt.x, y: y - pt.y };

      // stop element dragging if any
      this.isDragging = false;
      this.dragElement = null;
    },

    removeBendPoint(conn, pointIndex) {
      if (!conn || !Array.isArray(conn.points)) return;
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
    },

    removeSelectedBendPoint() {
      if (!this.selectedBendPoint.connId) return;
      const conn = this.connections.find(c => c.id === this.selectedBendPoint.connId);
      if (!conn) return;
      this.removeBendPoint(conn, this.selectedBendPoint.pointIndex);
    },

    normalizeConnectionPoints(conn) {
      const fromElement = this.elements.find(el => el.id === conn.from);
      const toElement = this.elements.find(el => el.id === conn.to);
      if (!fromElement || !toElement) return [];
      const start = this.getAnchorPoint(fromElement, toElement);
      const end = this.getAnchorPoint(toElement, fromElement);
      const middle = Array.isArray(conn.points) ? conn.points.slice(1, -1) : [];
      return [start, ...middle, end];
    },

    addBendPoint(conn, event) {
      const point = this.getCanvasPointFromClient(event.clientX, event.clientY);
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const bestIndex = findBestSegmentIndex(points, point);
      points.splice(bestIndex + 1, 0, point);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points} : c));
    },

    toggleBendPoint(conn, event) {
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
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const segIndex = this.findLongestSegmentIndex(points);
      const a = points[segIndex];
      const b = points[segIndex + 1];
      const mid = this.getDefaultMidpoint(a, b);
      points.splice(segIndex + 1, 0, mid);
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points} : c));
    },

    clearBendPoints(conn) {
      const points = this.normalizeConnectionPoints(conn);
      if (points.length < 2) return;
      const trimmed = [points[0], points[points.length - 1]];
      this.setConnections(this.connections.map(c => c.id === conn.id ? {...c, points: trimmed} : c));
      if (this.selectedBendPoint.connId === conn.id) {
        this.selectedBendPoint = { connId: null, pointIndex: null };
      }
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
        
        // Для классов инициализируем атрибуты и операции
        if (type === 'class') {
            element.properties = {
                attributes: [],
                operations: [],
                ...element.properties
            };
        }
        
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
        // Без кавычек (валидные идентификаторы)
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
        
        // Activity Diagram элементы
        initial: 'Start',
        final: 'End',
        activity: 'Activity',
        decision: 'Decision',
        merge: 'Merge',
        fork: 'Fork',
        join: 'Join',
        send_signal: 'Send Signal', // С подчеркиванием - нужны кавычки
        receive_signal: 'Receive Signal', // С подчеркиванием - нужны кавычки
        
        // Connections        '
        // extend': 'Extend',
        'include': 'Include',
        
        // Class связи
        'dependency': 'Dependency',
        'realization': 'Realization',
        'aggregation': 'Aggregation',
        
        // Activity Diagram связи
        'control_flow': 'Control Flow',
        'object_flow': 'Object Flow',
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
  transform-origin: 0 0;
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

.properties-panel {
  width: 280px;
  min-width: 260px;
  background: #f9fafb;
  border-left: 1px solid #e5e7eb;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 12px rgba(0,0,0,0.05);
  z-index: 10;
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.properties-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #95a5a6;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #e74c3c;
}

.properties-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.prop-group label {
  font-weight: 600;
  color: #34495e;
  font-size: 0.95rem;
}

.prop-group input[type="text"] {
  padding: 0.6rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 1rem;
}

.prop-group input[type="color"] {
  width: 100%;
  height: 42px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  cursor: pointer;
}

.prop-value {
  color: #7f8c8d;
  font-size: 0.95rem;
}

.selected-connection {
  filter: drop-shadow(0 0 6px #3498db);
  stroke-width: 6 !important;
}


.prop-group span {
  margin-left: 0.5rem;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.prop-group select {
  padding: 0.6rem;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: white;
}

.prop-hint {
  font-size: 0.75rem;
  color: #6b7280;
}

.app { height: 100vh; display: flex; flex-direction: column; }
.header { background: #2c3e50; color: white; padding: 1.25rem 1rem 1rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; position: relative; z-index: 10; }
.controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, auto)); grid-auto-flow: column; grid-auto-columns: min-content; gap: 0.5rem; align-items: center; justify-content: start; width: 100%; overflow-x: auto; padding-bottom: 0.25rem; }
.class-header {
    font-weight: bold;
    text-align: center;
    padding: 6px;
    border-bottom: 1px solid rgba(0,0,0,0.2);
}

.class-divider {
    margin: 0;
    border: none;
    border-top: 1px solid rgba(0,0,0,0.2);
}

.class-section {
    padding: 4px 8px;
    min-height: 20px;
}

.class-section.attributes {
    border-bottom: 1px solid rgba(0,0,0,0.1);
}

.class-line {
    font-family: monospace;
    font-size: 0.85em;
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.class-placeholder {
    color: #7f8c8d;
    font-style: italic;
    font-size: 0.85em;
    text-align: center;
    padding: 4px;
}
/* Стили для Activity Diagram */
.diamond-text {
    transform: rotate(-45deg);
    width: 100%;
    text-align: center;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
}

.element.shape-bar {
    border-radius: 0;
    cursor: ns-resize;
}

.element.shape-bar .element-text-main {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(90deg);
}

/* Для ромбов делаем текст читаемым */
.shape-diamond .diamond-text {
    font-size: 12px !important;
    width: 80%;
    word-wrap: break-word;
    line-height: 1.2;
}

/* Для маленьких элементов скрываем тип */
.element[style*="width: 40px"] .element-type-tag,
.element[style*="height: 40px"] .element-type-tag,
.element.shape-bar .element-type-tag {
    display: none;
}

/* Пятиугольник - текст по центру */
.shape-pentagon .element-text-main {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    text-align: center;
    font-size: 0.9em !important;
}
/* Стили для ромбов (decision, merge) */
.diamond-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    text-align: center;
}

.diamond-title {
    font-weight: 600;
    margin-bottom: 4px;
    text-align: center;
    word-wrap: break-word;
    max-width: 90%;
}

.diamond-type {
    font-size: 0.8em;
    opacity: 0.8;
    color: inherit;
    text-transform: capitalize;
}
/* Стили для Actor */
.actor-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
}

.element.shape-actor {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

.actor-name {
    word-break: break-word;
    max-width: 90%;
}

.selection-box {
  position: absolute;
  border: 2px dashed #3498db;
  background: rgba(52, 152, 219, 0.1);
  pointer-events: none;
  z-index: 100;
}

/* Highlight multi-selected elements */
.element.selected {
  outline: 3px solid #e74c3c !important;
  outline-offset: 2px;
  z-index: 10;
}
</style>
