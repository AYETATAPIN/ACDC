<template>
  <div class="app">
    <div v-if="!authReady" class="auth-loading-screen">
      <div class="auth-loading-card">Restoring session...</div>
    </div>

    <AuthGate
      v-else-if="requiresAuthGate"
      :auth-mode="authMode"
      :auth-form="authForm"
      :auth-loading="authLoading"
      :auth-error="authError"
      :title-override="authGateTitle"
      :lead-override="authGateLead"
      :set-auth-mode="setAuthMode"
      :update-auth-field="updateAuthField"
      :submit-auth-form="submitAuthForm"
    />

    <div v-else-if="shareLoadError" class="share-error-screen">
      <div class="share-error-card">
        <p class="share-error-eyebrow">ACDC</p>
        <h1>РЎСЃС‹Р»РєР° РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР°</h1>
        <p>{{ shareLoadError }}</p>
      </div>
    </div>

    <template v-else>
    <DiagramHeader
      :diagram-name="diagramName"
      :diagram-type="diagramType"
      :current-diagram-type-id="currentDiagramTypeId"
      :diagram-types-catalog="diagramTypesCatalog"
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
      :access-policy="accessPolicy"
      :set-diagram-name="setDiagramName"
      :set-diagram-type="setDiagramType"
      :set-selected-diagram-id="setSelectedDiagramId"
      :toggle-grid="toggleGrid"
      :save-diagram="saveDiagram"
      :new-diagram="newDiagram"
      :export-diagram="exportDiagram"
      :handle-import-file-selected="handleImportFileSelected"
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
      :open-share-dialog="openShareDialog"
    />

    <DiagramRulesTypesDialog
      v-model="showRulesDialog"
      :current-diagram-type-id="currentDiagramTypeId"
      :connections="connections"
      :elements="elements"
      :access-policy="accessPolicy"
      @apply-diagram-type="handleApplyDiagramType"
    />

    <ShareDialog
      v-model="shareDialogVisible"
      :diagram-id="currentDiagramId"
    />

    <Dialog v-model:visible="importDialog.visible" modal header="РРјРїРѕСЂС‚ РґРёР°РіСЂР°РјРјС‹" :style="{ width: '440px' }" class="themed-dialog import-dialog">
      <div class="bend-dialog-form">
        <label>Р¤Р°Р№Р»</label>
        <InputText :modelValue="importDialog.fileName" readonly />
      </div>
      <template #footer>
        <Button label="РЎРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ" icon="pi pi-plus" :loading="isImporting" @click="confirmImportDiagram('create')" />
        <Button
          label="Р—Р°РјРµРЅРёС‚СЊ С‚РµРєСѓС‰СѓСЋ"
          icon="pi pi-refresh"
          severity="warning"
          outlined
          :disabled="!currentDiagramId"
          :loading="isImporting"
          @click="confirmImportDiagram('replace')"
        />
      </template>
    </Dialog>

    <div v-if="errorMessage" class="error-toast">
      <div class="error-content">
        <strong>РћС€РёР±РєР°:</strong> {{ errorMessage }}
        <button @click="errorMessage = null" class="error-close">&times;</button>
      </div>
    </div>

    <section v-if="diagramTypeVersionStatus?.has_update" class="type-version-banner">
      <div class="type-version-banner-main">
        <strong>Р”РѕСЃС‚СѓРїРЅР° РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ РїСЂР°РІРёР»</strong>
        <span>
          РўРµРєСѓС‰Р°СЏ РІРµСЂСЃРёСЏ: {{ diagramTypeVersionStatus.current_version_number || 'вЂ”' }},
          РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ: {{ diagramTypeVersionStatus.latest_version_number || 'вЂ”' }}.
        </span>
      </div>
      <Button
        label="РћР±РЅРѕРІРёС‚СЊ"
        icon="pi pi-refresh"
        :loading="isUpdatingTypeVersion"
        :disabled="!accessPolicy.canWrite"
        @click="updateDiagramTypeVersion"
      />
      <ul v-if="typeVersionUpdateIssues.length" class="type-version-issues">
        <li v-for="(issue, index) in typeVersionUpdateIssues" :key="`${issue.kind}-${issue.connection_id || issue.block_id || index}`">
          {{ issue.message }}
        </li>
      </ul>
    </section>

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
          :access-policy="accessPolicy"
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
                    @dblclick.stop.prevent="accessPolicy.canWrite && removeBendPoint(conn, idx)"
                />
                <circle v-if="idx > 0 && idx < (conn.points.length - 1)" :cx="pt.x" :cy="pt.y" r="14" fill="transparent" style="pointer-events: all; cursor: move;" @mousedown.stop.prevent="handleBendPointMouseDown(conn, idx, $event)" @dblclick.stop.prevent="accessPolicy.canWrite && removeBendPoint(conn, idx)" />
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
                  <!-- Р СџРЎС“РЎРѓРЎвЂљР В°РЎРЏ РЎРѓРЎвЂљРЎР‚Р ВµР В»Р С”Р В° (Р Т‘Р В»РЎРЏ Р Р…Р В°РЎРѓР В»Р ВµР Т‘Р С•Р Р†Р В°Р Р…Р С‘РЎРЏ Р С‘ РЎР‚Р ВµР В°Р В»Р С‘Р В·Р В°РЎвЂ Р С‘Р С‘) -->
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
              
              <!-- Р вЂ”Р В°Р С”РЎР‚Р В°РЎв‚¬Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎР‚Р С•Р СР В± (Р С”Р С•Р СР С—Р С•Р В·Р С‘РЎвЂ Р С‘РЎРЏ) -->
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
              
              <!-- Р СџРЎС“РЎРѓРЎвЂљР С•Р в„– РЎР‚Р С•Р СР В± (Р В°Р С–РЎР‚Р ВµР С–Р В°РЎвЂ Р С‘РЎРЏ) -->
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
              <!-- Р вЂќР В»РЎРЏ Р С”Р В»Р В°РЎРѓРЎРѓР С•Р Р† РЎРѓ Р В°РЎвЂљРЎР‚Р С‘Р В±РЎС“РЎвЂљР В°Р СР С‘ Р С‘ Р С•Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏР СР С‘ -->
              <template v-if="element.type === 'class'">
                  <!-- Р вЂ”Р В°Р С–Р С•Р В»Р С•Р Р†Р С•Р С” Р С”Р В»Р В°РЎРѓРЎРѓР В° -->
                  <div class="class-header" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || 'Class' }}
                  </div>
                  
                  <!-- Р В Р В°Р В·Р Т‘Р ВµР В»Р С‘РЎвЂљР ВµР В»РЎРЉ -->
                  <hr class="class-divider" />
                  
                  <!-- Р С’РЎвЂљРЎР‚Р С‘Р В±РЎС“РЎвЂљРЎвЂ№ -->
                  <div class="class-section class-list" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">
                      <div class="class-list-header">
                          <button
                              type="button"
                              class="class-list-toggle"
                              :aria-label="isElementListExpanded(element, 'attributes') ? 'Collapse attributes' : 'Expand attributes'"
                              @mousedown.stop
                              @click.stop="toggleElementList(element, 'attributes')"
                          >
                              {{ isElementListExpanded(element, 'attributes') ? 'v' : '>' }}
                          </button>
                          <span class="element-list-title">Attributes</span>
                          <span class="element-list-count">({{ getElementListItems(element, 'attributes').length }})</span>
                      </div>
                      <div v-if="isElementListExpanded(element, 'attributes')" class="class-list-items">
                          <div
                              v-for="(attr, index) in getElementListItems(element, 'attributes')"
                              :key="'attr-' + index"
                              class="class-line"
                          >
                              {{ attr }}
                          </div>
                          <div v-if="!getElementListItems(element, 'attributes').length" class="class-placeholder">
                              &lt;attributes&gt;
                          </div>
                      </div>
                  </div>
                  
                  <!-- Р В Р В°Р В·Р Т‘Р ВµР В»Р С‘РЎвЂљР ВµР В»РЎРЉ -->
                  <hr class="class-divider" />
                  
                  <!-- Р С›Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘ -->
                  <div class="class-section class-list" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">
                      <div class="class-list-header">
                          <button
                              type="button"
                              class="class-list-toggle"
                              :aria-label="isElementListExpanded(element, 'operations') ? 'Collapse methods' : 'Expand methods'"
                              @mousedown.stop
                              @click.stop="toggleElementList(element, 'operations')"
                          >
                              {{ isElementListExpanded(element, 'operations') ? 'v' : '>' }}
                          </button>
                          <span class="element-list-title">Methods</span>
                          <span class="element-list-count">({{ getElementListItems(element, 'operations').length }})</span>
                      </div>
                      <div v-if="isElementListExpanded(element, 'operations')" class="class-list-items">
                          <div
                              v-for="(op, index) in getElementListItems(element, 'operations')"
                              :key="'op-' + index"
                              class="class-line"
                          >
                              {{ op }}
                          </div>
                          <div v-if="!getElementListItems(element, 'operations').length" class="class-placeholder">
                              &lt;methods&gt;
                          </div>
                      </div>
                  </div>
                  
                  <div class="element-type-tag" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">{{ getElementTypeLabel(element.type) }}</div>
              </template>

              <!-- Р вЂќР В»РЎРЏ РЎР‚Р С•Р СР В±Р С•Р Р† (decision, merge) -->
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
                      :stroke="isElementSelected(element) ? '#e74c3c' : (element.customBorder || getElementPreset(element.type)?.border || '#2d83be')"
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
                    :class="{ 'element-field-list': resolveElementFieldType(field) === 'list' }"
                    :style="getElementFieldStyle(element, field, idx)"
                  >
                    <template v-if="resolveElementFieldType(field) === 'list'">
                      <div class="element-list-header">
                        <button
                          type="button"
                          class="element-list-toggle"
                          :aria-label="isElementListExpanded(element, getElementFieldKey(field, idx)) ? 'Collapse list' : 'Expand list'"
                          @mousedown.stop
                          @click.stop="toggleElementList(element, getElementFieldKey(field, idx))"
                        >
                          {{ isElementListExpanded(element, getElementFieldKey(field, idx)) ? 'v' : '>' }}
                        </button>
                        <span class="element-list-title">{{ getElementFieldLabel(field, idx) }}</span>
                        <span class="element-list-count">({{ getElementListItems(element, field, idx).length }})</span>
                      </div>
                      <div v-if="isElementListExpanded(element, getElementFieldKey(field, idx))" class="element-list-items">
                        <div
                          v-for="(item, itemIdx) in getElementListItems(element, field, idx)"
                          :key="`field-${element.id}-${idx}-item-${itemIdx}`"
                          class="element-list-item"
                        >
                          {{ item }}
                        </div>
                        <div v-if="!getElementListItems(element, field, idx).length" class="element-list-empty">empty</div>
                      </div>
                    </template>
                    <template v-else>
                      {{ getElementFieldDisplayValue(element, field, idx) }}
                    </template>
                  </div>
                  <div class="element-type-tag" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">{{ getElementTypeLabel(element.type) }}</div>
              </template>
              <template v-else-if="element.type === 'actor'">
                  <div class="actor-container">
                      <!-- Р вЂњР С•Р В»Р С•Р Р†Р В° -->
                      <div class="actor-head" :style="{ 
                          width: '30px', 
                          height: '30px', 
                          backgroundColor: element.customColor || getElementPreset('actor')?.color || '#27ae60',
                          border: `2px solid ${element.customBorder || getElementPreset('actor')?.border || '#229954'}`,
                          borderRadius: '50%',
                          margin: '0 auto 8px'
                      }"></div>
                      
                      <!-- Р СћР ВµР В»Р С• -->
                      <div class="actor-body" :style="{ 
                          width: '2px', 
                          height: '30px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto'
                      }"></div>
                      
                      <!-- Р В РЎС“Р С”Р С‘ -->
                      <div class="actor-arms" :style="{ 
                          width: '40px', 
                          height: '2px', 
                          backgroundColor: element.customBorder || getElementPreset('actor')?.border || '#229954',
                          margin: '0 auto',
                          position: 'relative',
                          top: '-15px'
                      }"></div>
                      
                      <!-- Р СњР С•Р С–Р С‘ -->
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
                      
                      <!-- Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р В°Р С”РЎвЂљР С•РЎР‚Р В° -->
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
                  <div class="element-type-tag" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">{{ getElementTypeLabel(element.type) }}</div>
              </template>
              <!-- Р вЂќР В»РЎРЏ Р С•РЎРѓРЎвЂљР В°Р В»РЎРЉР Р…РЎвЂ№РЎвЂ¦ РЎвЂљР С‘Р С—Р С•Р Р† -->
              <template v-else>
                  <div class="element-text-main" :style="{ fontSize: (element.fontSize || 14) + 'px' }">
                      {{ element.text || getDefaultText(element.type) }}
                  </div>
                  <div
                    v-for="(field, idx) in getElementVisibleFields(element)"
                    :key="`field-${element.id}-${idx}`"
                    class="element-field-label"
                    :class="{ 'element-field-list': resolveElementFieldType(field) === 'list' }"
                    :style="getElementFieldStyle(element, field, idx)"
                  >
                    <template v-if="resolveElementFieldType(field) === 'list'">
                      <div class="element-list-header">
                        <button
                          type="button"
                          class="element-list-toggle"
                          :aria-label="isElementListExpanded(element, getElementFieldKey(field, idx)) ? 'Collapse list' : 'Expand list'"
                          @mousedown.stop
                          @click.stop="toggleElementList(element, getElementFieldKey(field, idx))"
                        >
                          {{ isElementListExpanded(element, getElementFieldKey(field, idx)) ? 'v' : '>' }}
                        </button>
                        <span class="element-list-title">{{ getElementFieldLabel(field, idx) }}</span>
                        <span class="element-list-count">({{ getElementListItems(element, field, idx).length }})</span>
                      </div>
                      <div v-if="isElementListExpanded(element, getElementFieldKey(field, idx))" class="element-list-items">
                        <div
                          v-for="(item, itemIdx) in getElementListItems(element, field, idx)"
                          :key="`field-${element.id}-${idx}-item-${itemIdx}`"
                          class="element-list-item"
                        >
                          {{ item }}
                        </div>
                        <div v-if="!getElementListItems(element, field, idx).length" class="element-list-empty">empty</div>
                      </div>
                    </template>
                    <template v-else>
                      {{ getElementFieldDisplayValue(element, field, idx) }}
                    </template>
                  </div>
                  <div class="element-type-tag" :style="{ fontSize: `${getElementInnerTextSize(element)}px` }">{{ getElementTypeLabel(element.type) }}</div>
              </template>
              
              <div v-if="accessPolicy.canWrite" class="resize-handle" @mousedown.stop="handleResizeMouseDown(element, $event)" title="РР·РјРµРЅРёС‚СЊ СЂР°Р·РјРµСЂ"></div>
          </div>

        <svg class="connection-handles-layer" xmlns="http://www.w3.org/2000/svg">
          <g v-for="conn in connections" :key="`endpoints-overlay-${conn.id}`">
            <template v-if="selectedConnection?.id === conn.id && getConnectionEndpoints(conn)">
              <circle
                  class="endpoint-handle"
                  :cx="getConnectionEndpoints(conn).start.x"
                  :cy="getConnectionEndpoints(conn).start.y"
                  r="6"
                  @mousedown.stop.prevent="startEndpointDrag(conn, 'from', $event)"
              />
              <circle
                  class="endpoint-handle"
                  :cx="getConnectionEndpoints(conn).end.x"
                  :cy="getConnectionEndpoints(conn).end.y"
                  r="6"
                  @mousedown.stop.prevent="startEndpointDrag(conn, 'to', $event)"
              />
            </template>
          </g>
        </svg>
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
        :can-write="accessPolicy.canWrite"
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

    <Dialog v-model:visible="bendPointDialog.visible" modal header="РўРѕС‡РєР° РёР·РіРёР±Р°" :style="{ width: '420px' }" class="themed-dialog bend-point-dialog">
      <div class="bend-dialog-form">
        <label for="bend-point-label">РџРѕРґРїРёСЃСЊ С‚РѕС‡РєРё</label>
        <InputText id="bend-point-label" v-model="bendPointDialog.label" placeholder="РќР°РїСЂРёРјРµСЂ: decision branch" />
      </div>
      <template #footer>
        <Button label="РЈРґР°Р»РёС‚СЊ С‚РѕС‡РєСѓ" icon="pi pi-trash" severity="danger" outlined :disabled="!accessPolicy.canWrite" @click="deleteBendPointFromDialog" />
        <Button label="РЎРѕС…СЂР°РЅРёС‚СЊ" icon="pi pi-check" :disabled="!accessPolicy.canWrite" @click="saveBendPointDialog" />
      </template>
    </Dialog>
    </template>
  </div>
</template>

<script src="./app-options.js"></script>

<style src="./styles/app.css"></style>
