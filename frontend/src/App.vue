<template>
  <div class="app">
    <DiagramHeader
      :diagram-name="diagramName"
      :diagram-type="diagramType"
      :snap-to-grid="snapToGrid"
      :has-unsaved-changes="hasUnsavedChanges"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :is-dark-theme="themeMode === 'dark'"
      :is-bend-edit-mode="bendEditMode"
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
      :open-rules-dialog="openRulesDialog"
      :toggle-theme="toggleTheme"
    />

    <DiagramRulesTypesDialog
      v-model="showRulesDialog"
      :current-diagram-type-id="currentDiagramTypeId"
      @apply-diagram-type="handleApplyDiagramType"
    />

    <div v-if="errorMessage" class="error-toast">
      <div class="error-content">
        <strong>Ошибка:</strong> {{ errorMessage }}
        <button @click="errorMessage = null" class="error-close">&times;</button>
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
           :style="{ background: snapToGrid ? `linear-gradient(90deg, ${themeMode === 'dark' ? '#4b5563' : '#d7dde6'} 1px, transparent 1px), linear-gradient(${themeMode === 'dark' ? '#4b5563' : '#d7dde6'} 1px, transparent 1px), ${themeMode === 'dark' ? '#111827' : '#ffffff'}` : (themeMode === 'dark' ? '#111827' : '#ffffff'),
                     backgroundSize: snapToGrid ? `${gridSize}px ${gridSize}px` : 'auto' }"
           @click="handleCanvasClick"
           @mousedown="handleMouseDown"
           @mousemove="handleMouseMove"
           @mouseup="handleMouseUp"
           @mouseleave="handleMouseUp"
           @wheel.prevent="handleWheel"
      >
        <div class="canvas-inner" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: canvasWidth + 'px', height: canvasHeight + 'px', transformOrigin: '0 0' }">
          <svg class="connections-layer" xmlns="http://www.w3.org/2000/svg">
            <path
                v-for="conn in connections"
                :key="`hit-${conn.id}`"
                :d="getConnectionPath(conn)"
                stroke="transparent"
                stroke-width="16"
                fill="none"
                class="connection-hit-area"
                @click.stop="handleConnectionClick(conn, $event)"
                @dblclick.stop="startLabelEdit(conn, $event)"
            />
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
                class="connection-path"
                @click.stop="handleConnectionClick(conn, $event)"
                @dblclick.stop="startLabelEdit(conn, $event)"
                :class="{ 'selected-connection': selectedConnection?.id === conn.id && selectedBendPoint.connId !== conn.id, 'rule-violation': conn.rule_violation }"
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
                <text
                    v-if="idx > 0 && idx < (conn.points.length - 1) && pt.label"
                    :x="pt.x"
                    :y="pt.y - 14"
                    text-anchor="middle"
                    class="bend-point-label"
                >
                  {{ pt.label }}
                </text>
              </template>
            </g>

            <g v-for="conn in connections" :key="`endpoints-${conn.id}`">
              <template v-if="selectedConnection?.id === conn.id && conn.points && conn.points.length >= 2">
                <circle
                    class="endpoint-handle"
                    :cx="conn.points[0].x"
                    :cy="conn.points[0].y"
                    r="6"
                    @mousedown.stop.prevent="startEndpointDrag(conn, 'from', $event)"
                />
                <circle
                    class="endpoint-handle"
                    :cx="conn.points[conn.points.length - 1].x"
                    :cy="conn.points[conn.points.length - 1].y"
                    r="6"
                    @mousedown.stop.prevent="startEndpointDrag(conn, 'to', $event)"
                />
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
                  <!-- РџСѓСЃС‚Р°СЏ СЃС‚СЂРµР»РєР° (РґР»СЏ РЅР°СЃР»РµРґРѕРІР°РЅРёСЏ Рё СЂРµР°Р»РёР·Р°С†РёРё) -->
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
              
              <!-- Р—Р°РєСЂР°С€РµРЅРЅС‹Р№ СЂРѕРјР± (РєРѕРјРїРѕР·РёС†РёСЏ) -->
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
              
              <!-- РџСѓСЃС‚РѕР№ СЂРѕРјР± (Р°РіСЂРµРіР°С†РёСЏ) -->
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
            <p>Select a tool on the left and click on the canvas</p>
            <p>Current tool: <strong>{{ currentTool }}</strong></p>
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
                  resizing: resizingElement?.id === element.id,
                  selected: isElementSelected(element)
              }, `shape-${getElementShape(element.type)}`]"
              :style="getElementStyle(element)"
              @click.stop="handleElementClick(element, $event)"
          >
              <!-- Р”Р»СЏ РєР»Р°СЃСЃРѕРІ СЃ Р°С‚СЂРёР±СѓС‚Р°РјРё Рё РѕРїРµСЂР°С†РёСЏРјРё -->
              <template v-if="element.type === 'class'">
                  <!-- Р—Р°РіРѕР»РѕРІРѕРє РєР»Р°СЃСЃР° -->
                  <div class="class-header" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || 'Class' }}
                  </div>
                  
                  <!-- Р Р°Р·РґРµР»РёС‚РµР»СЊ -->
                  <hr class="class-divider" />
                  
                  <!-- РђС‚СЂРёР±СѓС‚С‹ -->
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
                  
                  <!-- Р Р°Р·РґРµР»РёС‚РµР»СЊ -->
                  <hr class="class-divider" />
                  
                  <!-- РћРїРµСЂР°С†РёРё -->
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

              <!-- Р”Р»СЏ СЂРѕРјР±РѕРІ (decision, merge) -->
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
                      <!-- Р“РѕР»РѕРІР° -->
                      <div class="actor-head" :style="{ 
                          width: '30px', 
                          height: '30px', 
                          backgroundColor: element.customColor || getElementPreset('actor')?.color || '#27ae60',
                          border: `2px solid ${element.customBorder || getElementPreset('actor')?.border || '#229954'}`,
                          borderRadius: '50%',
                          margin: '0 auto 8px'
                      }"></div>
                      
                      <!-- РўРµР»Рѕ -->
                      <div class="actor-body" :style="{ 
                          width: '2px', 
                          height: '30px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto'
                      }"></div>
                      
                      <!-- Р СѓРєРё -->
                      <div class="actor-arms" :style="{ 
                          width: '40px', 
                          height: '2px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto',
                          position: 'relative',
                          top: '-15px'
                      }"></div>
                      
                      <!-- РќРѕРіРё -->
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
                      
                      <!-- РќР°Р·РІР°РЅРёРµ Р°РєС‚РѕСЂР° -->
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
              <!-- Р”Р»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… С‚РёРїРѕРІ -->
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
        :add-selected-bend-point="addSelectedConnectionBendPoint"
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
        :load-version="loadDiagramVersion"
      />
    </div>

    <Dialog v-model:visible="bendPointDialog.visible" modal header="Точка изгиба" :style="{ width: '420px' }">
      <div class="bend-dialog-form">
        <label for="bend-point-label">Подпись точки</label>
        <InputText id="bend-point-label" v-model="bendPointDialog.label" placeholder="Например: decision branch" />
      </div>
      <template #footer>
        <Button label="Удалить точку" icon="pi pi-trash" severity="danger" outlined @click="deleteBendPointFromDialog" />
        <Button label="Сохранить" icon="pi pi-check" @click="saveBendPointDialog" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { findBestSegmentIndex, toggleBendPointPoints } from './utils/bendPoints.js';
import { diagramsService, diagramTypesService, ApiError } from './services/index.js';
import { isConnectionAllowedByMatrix, normalizeRulesMatrix } from './rules/connectionRules.js';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DiagramHeader from './components/DiagramHeader.vue';
import DiagramToolbar from './components/DiagramToolbar.vue';
import DiagramPropertiesPanel from './components/DiagramPropertiesPanel.vue';
import DiagramHistoryPanel from './components/DiagramHistoryPanel.vue';
import DiagramRulesTypesDialog from './components/DiagramRulesTypesDialog.vue';

const BUILTIN_DIAGRAM_TYPE_IDS = {
  class: '00000000-0000-0000-0000-000000000101',
  use_case: '00000000-0000-0000-0000-000000000102',
  activity_diagram: '00000000-0000-0000-0000-000000000103',
  free_mode: '00000000-0000-0000-0000-000000000104',
};

export default {
  name: 'App',
  components: {
    DiagramHeader,
    DiagramToolbar,
    DiagramPropertiesPanel,
    DiagramHistoryPanel,
    DiagramRulesTypesDialog,
    Dialog,
    InputText,
    Button
  },
  data() {
    return {
      lastSavedState: null,
      hasUnsavedChanges: false,
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
      showRulesDialog: false,
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
  mounted() {
    window.addEventListener('mouseup', this.handleGlobalMouseUp);
    window.addEventListener('mouseleave', this.handleGlobalMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.initTheme();
    this.pushLocalHistorySnapshot();
    this.loadDiagramTypesCatalog();
    this.loadDiagramsList();
  },

  beforeUnmount() {
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
      if (this.localHistoryIndex > 0) return true;
      if (this.currentDiagramId) return this.currentVersion > 1;
      return false;
    },

    canRedo() {
      if (this.localHistoryIndex >= 0 && this.localHistoryIndex < this.localHistory.length - 1) return true;
      if (this.currentDiagramId) return this.historyEntries.length > this.currentVersion;
      return false;
    },

    availableConnectionTools() {
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
      );
    },

    availableElementTools() {
      if (this.currentDiagramTypeId && this.customElementTypes.length > 0) {
        return this.customElementTypes.map((item) => ({
          type: item.key,
          label: item.name,
          shape: item.shape || 'rect',
          diagrams: [this.diagramType],
          width: Number(item.default_size?.width) || 120,
          height: Number(item.default_size?.height) || 60,
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

  methods: {
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
      this.diagramName = value;
      this.queueLocalHistorySnapshot();
    },

    setDiagramType(value) {
      this.diagramType = value;
      this.queueLocalHistorySnapshot();
      const matched = this.diagramTypesCatalog.find((item) => item.key === value);
      if (matched) {
        const normalizedId = this.normalizeDiagramTypeId(matched.id, matched.key);
        this.currentDiagramTypeId = normalizedId;
        this.currentDiagramTypeEntity = this.normalizeDiagramTypeEntity(matched);
        this.loadActiveDiagramTypeContext(normalizedId).catch((error) => {
          this.showError(error.message || 'Failed to load diagram type context');
        });
      }
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
      const type = payload?.type;
      if (!type) return;

      this.currentDiagramTypeId = this.normalizeDiagramTypeId(type.id, type.key);
      this.currentDiagramTypeEntity = this.normalizeDiagramTypeEntity(type);
      this.customElementTypes = Array.isArray(payload.elements) ? payload.elements : [];
      this.customConnectionTypes = Array.isArray(payload.connectionTypes) ? payload.connectionTypes : [];
      this.rulesMatrix = normalizeRulesMatrix(payload.rulesMatrix);

      if (['class', 'use_case', 'activity_diagram', 'free_mode'].includes(type.key)) {
        this.diagramType = type.key;
      } else {
        this.diagramType = type.is_free_mode ? 'free_mode' : 'class';
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
        if (event.shiftKey) {
          this.redoDiagram();
        } else {
          this.undoDiagram();
        }
        return;
      }

      if (ctrlOrMeta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        this.redoDiagram();
        return;
      }

      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
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
    // Р’ methods App.vue РґРѕР±Р°РІР»СЏРµРј:
    deleteConnection(connection) {
      if (confirm('Delete this connection?')) {
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
            element_type_id: found.id,
            field_schema: Array.isArray(found.field_schema) ? found.field_schema : [],
          };
        }
      }
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

    showError(message) {
      console.warn('Diagram error:', message);
      this.errorMessage = message;

      // Auto-clear after 6 seconds
      if (this.errorTimeout) clearTimeout(this.errorTimeout);
      this.errorTimeout = setTimeout(() => {
        this.errorMessage = null;
      }, 6000);
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
      // Ignore clicks right after drag (prevents deselection)
      if (this.justInteracted) {
        this.justInteracted = false;
        if (!this.isConnectionTool(this.currentTool) && this.currentTool !== 'delete') {
          return;
        }
      }

      // 1. Connection tool has highest priority
      if (this.isConnectionTool(this.currentTool)) {
        const x = element.x + element.width / 2;
        const y = element.y + element.height / 2;
        this.handleConnectionMode(x, y);
        return;
      }

      // 2. Delete tool
      if (this.currentTool === 'delete') {
        this.deleteElement(element);
        return;
      }

      // 3. Normal selection (only if not connection tool)
      this.selectElement(element, event);
    },

    deleteElement(element) {
      if (confirm(`Delete "${element.text}" and all linked connections?`)) {
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

    handleConnectionMode(x, y) {
      if (!this.isConnectionTool(this.currentTool)) return;

      const clickedElement = this.getElementAtPosition(x, y);

      if (!clickedElement) {
        this.connectionStart = null;
        this.isConnecting = false;
        return;
      }

      if (!this.connectionStart) {
        // First click: select starting element
        this.connectionStart = clickedElement;
        this.isConnecting = true;
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
    },

// Update element visual selection class
    isElementSelected(element) {
      return this.selectedElements.some(el => el.id === element.id);
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

    resolveElementTypeId(element) {
      if (!element) return null;
      if (element.element_type_id) return element.element_type_id;
      return this.customElementTypes.find((item) => item.key === element.type)?.id || null;
    },

    resolveConnectionTypeId(connectionType) {
      return this.customConnectionTypes.find((item) => item.key === connectionType)?.id || null;
    },

    isConnectionAllowed(fromElement, toElement, connectionType) {
      if (!fromElement || !toElement || fromElement.id === toElement.id) return false;
      if (this.currentDiagramTypeEntity?.is_free_mode || this.diagramType === 'free_mode') return true;

      if (this.currentDiagramTypeId && this.customElementTypes.length > 0 && this.customConnectionTypes.length > 0) {
        const fromElementTypeId = this.resolveElementTypeId(fromElement);
        const toElementTypeId = this.resolveElementTypeId(toElement);
        const connectionTypeId = this.resolveConnectionTypeId(connectionType);

        if (!fromElementTypeId || !toElementTypeId || !connectionTypeId) return false;

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
      this.bendEditMode = false;
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

    deselectAll() {
      this.selectedElements = [];
      this.selectedConnection = null;
      this.selectedBendPoint = { connId: null, pointIndex: null };
      this.selectionBox = null;
      this.bendEditMode = false;
    },

    handleResizeMouseDown(element, event) {
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
      const { connId, pointIndex } = this.bendPointDialog;
      const conn = this.connections.find((c) => c.id === connId);
      if (conn) this.removeBendPoint(conn, pointIndex);
      this.bendPointDialog.visible = false;
    },

    startEndpointDrag(conn, which) {
      if (!conn) return;
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

.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 8;
  pointer-events: none;
  overflow: visible;
}

.connection-hit-area {
  cursor: pointer;
  pointer-events: stroke;
}

.connection-path {
  pointer-events: stroke;
  cursor: pointer;
}

.bend-point-label {
  font-size: 11px;
  fill: var(--app-text, #0f172a);
  pointer-events: none;
  user-select: none;
}

.endpoint-handle {
  fill: #0ea5e9;
  stroke: #ffffff;
  stroke-width: 2;
  cursor: move;
  pointer-events: all;
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

.element.dragging:hover,
.element.resizing:hover,
.element.dragging,
.element.resizing {
  transform: none;
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
  background: var(--app-panel, white);
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
  stroke-width: 4 !important;
}

.rule-violation {
  stroke: #d97706 !important;
  stroke-dasharray: 4 4 !important;
  filter: drop-shadow(0 0 4px rgba(217, 119, 6, 0.6));
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

.bend-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bend-dialog-form label {
  font-size: 0.85rem;
  color: var(--app-muted, #475569);
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
/* РЎС‚РёР»Рё РґР»СЏ Activity Diagram */
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

/* Р”Р»СЏ СЂРѕРјР±РѕРІ РґРµР»Р°РµРј С‚РµРєСЃС‚ С‡РёС‚Р°РµРјС‹Рј */
.shape-diamond .diamond-text {
    font-size: 12px !important;
    width: 80%;
    word-wrap: break-word;
    line-height: 1.2;
}

/* Р”Р»СЏ РјР°Р»РµРЅСЊРєРёС… СЌР»РµРјРµРЅС‚РѕРІ СЃРєСЂС‹РІР°РµРј С‚РёРї */
.element[style*="width: 40px"] .element-type-tag,
.element[style*="height: 40px"] .element-type-tag,
.element.shape-bar .element-type-tag {
    display: none;
}

/* РџСЏС‚РёСѓРіРѕР»СЊРЅРёРє - С‚РµРєСЃС‚ РїРѕ С†РµРЅС‚СЂСѓ */
.shape-pentagon .element-text-main {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    text-align: center;
    font-size: 0.9em !important;
}
/* РЎС‚РёР»Рё РґР»СЏ СЂРѕРјР±РѕРІ (decision, merge) */
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
/* РЎС‚РёР»Рё РґР»СЏ Actor */
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
