<template>
  <div class="app">
    <div v-if="!authReady" class="auth-loading-screen">
      <div class="auth-loading-card">Restoring session...</div>
    </div>

    <AuthGate
      v-else-if="!authUser"
      :auth-mode="authMode"
      :auth-form="authForm"
      :auth-loading="authLoading"
      :auth-error="authError"
      :set-auth-mode="setAuthMode"
      :update-auth-field="updateAuthField"
      :submit-auth-form="submitAuthForm"
    />

    <template v-else>
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
      :auth-user="authUser"
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
      :logout="logout"
    />

    <DiagramRulesTypesDialog
      v-model="showRulesDialog"
      :current-diagram-type-id="currentDiagramTypeId"
      :connections="connections"
      :elements="elements"
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
                  
                  <div class="element-type-tag">{{ getElementTypeLabel(element.type) }}</div>
              </template>

              <!-- Р”Р»СЏ СЂРѕРјР±РѕРІ (decision, merge) -->
              <template v-else-if="getElementShape(element.type) === 'diamond'">
                  <div class="diamond-content">
                      <div class="diamond-title" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                          {{ element.text || getDefaultText(element.type) }}
                      </div>
                      <div class="diamond-type">{{ getElementTypeLabel(element.type) }}</div>
                  </div>
              </template>
              <template v-else-if="getElementShape(element.type) === 'custom'">
                  <svg
                    v-if="getCustomShapeInfo(element.type).d"
                    class="custom-shape-svg"
                    :viewBox="getCustomShapeInfo(element.type).viewBox"
                    preserveAspectRatio="none"
                  >
                    <path
                      :d="getCustomShapeInfo(element.type).d"
                      :fill="element.customColor || getElementPreset(element.type)?.color || '#3498db'"
                      :stroke="element.customBorder || getElementPreset(element.type)?.border || '#2d83be'"
                      stroke-width="2"
                    />
                  </svg>
                  <div class="element-text-main" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || getDefaultText(element.type) }}
                  </div>
                  <div
                    v-for="(field, idx) in getElementVisibleFields(element)"
                    :key="`field-${element.id}-${idx}`"
                    class="element-field-label"
                    :style="getElementFieldStyle(field)"
                  >
                    {{ getElementFieldDisplayValue(element, field, idx) }}
                  </div>
                  <div class="element-type-tag">{{ getElementTypeLabel(element.type) }}</div>
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
                  <div class="element-type-tag">{{ getElementTypeLabel(element.type) }}</div>
              </template>
              <!-- Р”Р»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… С‚РёРїРѕРІ -->
              <template v-else>
                  <div class="element-text-main" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || getDefaultText(element.type) }}
                  </div>
                  <div
                    v-for="(field, idx) in getElementVisibleFields(element)"
                    :key="`field-${element.id}-${idx}`"
                    class="element-field-label"
                    :style="getElementFieldStyle(field)"
                  >
                    {{ getElementFieldDisplayValue(element, field, idx) }}
                  </div>
                  <div class="element-type-tag">{{ getElementTypeLabel(element.type) }}</div>
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
    </template>
  </div>
</template>

<script src="./app-options.js"></script>

<style src="./styles/app.css"></style>

