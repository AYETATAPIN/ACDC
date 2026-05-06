<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    header="Rules and Types"
    :style="{ width: '96vw', maxWidth: '1760px' }"
    class="rules-dialog"
  >
    <div class="top-bar">
      <Dropdown
        v-model="selectedDiagramTypeId"
        :options="diagramTypes"
        optionLabel="name"
        optionValue="id"
        placeholder="Select diagram type"
        class="w-20rem"
        @change="onTypeChange"
      />
      <div class="actions">
        <Button icon="pi pi-refresh" outlined label="Refresh" @click="reloadCatalog" />
      </div>
    </div>

    <div class="rt-toast-stack" aria-live="polite">
      <TransitionGroup name="rt-toast">
        <div v-for="toast in toasts" :key="toast.id" class="rt-toast" :class="toast.kind">
          <span class="rt-toast-icon" aria-hidden="true">{{ toast.kind === 'error' ? '!' : '✓' }}</span>
          <span class="rt-toast-text">{{ toast.message }}</span>
          <button type="button" class="rt-toast-close" @click="dismissToast(toast.id)">×</button>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="selectedType?.is_builtin" class="builtin-warning">
      <span class="builtin-warning-text">Built-in types are read-only. Clone this type to customize elements, connections, and rules.</span>
      <Button text icon="pi pi-copy" label="Clone for editing" class="builtin-warning-action" @click="quickCloneSelectedType" />
    </div>

    <TabView>
      <TabPanel header="Diagram Type">
        <section class="card type-workflow-card">
          <h4>Create Type</h4>
          <div class="form">
            <label>Name</label>
            <InputText v-model="typeCreateForm.name" placeholder="My diagram type" />
            <label>Description</label>
            <InputText v-model="typeCreateForm.description" />
            <label>Free Mode</label>
            <InputSwitch v-model="typeCreateForm.is_free_mode" />
            <label>Branch From Existing Type</label>
            <Dropdown
              v-model="typeCreateForm.cloneFromId"
              :options="diagramTypes"
              optionLabel="name"
              optionValue="id"
              showClear
              placeholder="Blank (start from scratch)"
            />
          </div>
          <div class="actions">
            <Button label="Create From Scratch" icon="pi pi-plus" @click="createBlankType" />
            <Button
              label="Create From Existing"
              icon="pi pi-copy"
              severity="secondary"
              :disabled="!typeCreateForm.cloneFromId"
              @click="createCloneType"
            />
          </div>

          <div v-if="selectedType" class="type-divider"></div>

          <template v-if="selectedType">
            <h4>Selected Type</h4>
            <div class="form">
              <label>Name</label>
              <InputText v-model="typeEditForm.name" :disabled="selectedType.is_builtin" />
              <label>Description</label>
              <InputText v-model="typeEditForm.description" :disabled="selectedType.is_builtin" />
              <label>Free Mode</label>
              <InputSwitch v-model="typeEditForm.is_free_mode" :disabled="selectedType.is_builtin" />
            </div>
            <div class="actions">
              <Button label="Save" icon="pi pi-save" :disabled="selectedType.is_builtin" @click="updateType" />
              <Button v-if="!selectedType.is_builtin" label="Delete" icon="pi pi-trash" severity="danger" outlined @click="deleteType" />
            </div>
          </template>
        </section>
      </TabPanel>

      <TabPanel header="Elements">
        <div class="grid2">
          <section class="card">
            <DataTable
              :value="elementTypes"
              dataKey="id"
              v-model:selection="selectedElementType"
              selectionMode="single"
              @rowSelect="fillElementForm"
              scrollable
              scrollHeight="45vh"
            >
              <Column field="name" header="Name" />
              <Column field="shape" header="Shape" />
              <Column header="Ports">
                <template #body="{ data }">{{ asArray(data.ports).length }}</template>
              </Column>
            </DataTable>
          </section>

          <section class="card">
            <h4>Element Actions</h4>
            <small class="muted">
              Ports are optional fixed connection points, fields are configurable labels/inputs on the block.
            </small>
            <div class="actions">
              <Button label="Create Element" icon="pi pi-plus" :disabled="!canMutate" @click="openCreateElementDialog" />
              <Button label="Edit Selected" icon="pi pi-pencil" severity="secondary" :disabled="!selectedElementType || !canMutate" @click="openEditElementDialog" />
              <Button label="Delete Selected" icon="pi pi-trash" severity="danger" outlined :disabled="!selectedElementType || selectedElementType?.is_builtin || !canMutate" @click="deleteElement" />
            </div>
            <div class="preview-block">
              <label>Quick Preview</label>
              <div class="preview-canvas">
                <div class="preview-element" :style="previewElementStyle">
                  <svg v-if="previewSvgPath" class="preview-custom-svg" :viewBox="previewSvgViewBox" preserveAspectRatio="none">
                    <path :d="previewSvgPath" :fill="elementForm.color || '#3498db'" :stroke="elementForm.border || '#2d83be'" stroke-width="2" />
                  </svg>
                  <div class="preview-title">{{ elementForm.name || 'New Element' }}</div>
                  <div
                    v-for="item in previewVisibleFields"
                    :key="`quick-preview-field-${item.index}`"
                    class="preview-field preview-field-placed"
                    :style="previewFieldStyle(item.field, item.order)"
                  >
                    {{ item.field.label || item.field.key || `Field ${item.order + 1}` }}
                  </div>
                </div>
              </div>
            </div>
            <div class="actions">
              <Button label="Reset" text icon="pi pi-times" @click="resetElementForm" />
            </div>
          </section>
        </div>
      </TabPanel>

      <TabPanel header="Connections and Rules">
        <section class="card matrix-only-card">
          <details class="connection-types-details">
            <summary>Connection Types (create, style, and edit)</summary>
            <div class="connection-types-grid">
              <DataTable
                :value="connectionTypes"
                dataKey="id"
                v-model:selection="selectedConnectionType"
                selectionMode="single"
                @rowSelect="fillConnectionForm"
                scrollable
                scrollHeight="24vh"
              >
                <Column field="name" header="Name" />
                <Column field="directed" header="Directed" />
              </DataTable>

              <div class="form">
                <label>Name</label>
                <InputText v-model="connectionForm.name" placeholder="Relation name" />
                <label>Color</label>
                <InputText v-model="connectionForm.color" />
                <label>Dash</label>
                <InputText v-model="connectionForm.dash" placeholder="e.g. 10 6" />
                <label>Arrow Start</label>
                <Dropdown v-model="connectionForm.arrow_start" :options="arrowOptions" optionLabel="label" optionValue="value" />
                <label>Arrow End</label>
                <Dropdown v-model="connectionForm.arrow_end" :options="arrowOptions" optionLabel="label" optionValue="value" />
                <label>Directed</label>
                <InputSwitch v-model="connectionForm.directed" />
              </div>
            </div>
            <div class="actions">
              <Button label="Create" icon="pi pi-plus" :disabled="!canMutate" @click="createConnectionType" />
              <Button label="Save" icon="pi pi-save" severity="secondary" :disabled="!selectedConnectionType || !canMutate" @click="updateConnectionType" />
              <Button label="Delete" icon="pi pi-trash" severity="danger" outlined :disabled="!selectedConnectionType || selectedConnectionType?.is_builtin || !canMutate" @click="deleteConnectionType" />
            </div>
          </details>

          <div class="actions matrix-actions">
            <Dropdown v-model="bulkForm.mode" :options="bulkModes" optionLabel="label" optionValue="value" />
            <Dropdown v-model="bulkForm.target_id" :options="bulkTargets" optionLabel="label" optionValue="value" placeholder="Target" />
            <MultiSelect v-model="bulkForm.connection_type_ids" :options="connectionTypes" optionLabel="name" optionValue="id" display="chip" placeholder="All connection types" />
            <SelectButton v-model="bulkForm.allowed" :options="allowOptions" optionLabel="label" optionValue="value" />
            <Button label="Apply Bulk" icon="pi pi-bolt" :disabled="!bulkForm.target_id || !canMutate" @click="applyBulkRules" />
          </div>

          <DataTable :value="matrixRows" scrollable scrollHeight="68vh" class="matrix-table">
            <Column header="From \\ To" frozen>
              <template #body="{ data }">
                <div>{{ data.fromElement.name }}</div>
              </template>
            </Column>
            <Column v-for="target in matrixElements" :key="target.id" :field="target.id" :header="target.name">
              <template #body="{ data }">
                <div class="matrix-cell">
                  <button
                    v-for="rule in data[target.id]"
                    :key="rule.connection_type_id"
                    type="button"
                    class="rule-toggle"
                    :class="{ allowed: rule.allowed, blocked: !rule.allowed }"
                    :disabled="!canMutate"
                    @click.stop="toggleCellRule(data.fromElement, target, rule)"
                  >
                    <span class="rule-name">
                      <span class="rule-line" :style="ruleLineStyle(rule.connection_type_id)"></span>
                      <span>{{ connectionName(rule.connection_type_id) }} {{ arrowGlyph(rule.connection_type_id) }}</span>
                    </span>
                    <span class="rule-state">{{ rule.allowed ? 'allowed' : 'blocked' }}</span>
                  </button>
                </div>
              </template>
            </Column>
          </DataTable>
        </section>
      </TabPanel>
    </TabView>

    <Dialog
      v-model:visible="elementEditor.visible"
      modal
      :draggable="false"
      :header="elementEditor.mode === 'edit' ? 'Edit Element' : 'Create Element'"
      :style="{ width: '99vw', maxWidth: 'none' }"
      :contentStyle="{ maxHeight: '92vh' }"
      class="rules-dialog element-editor-dialog"
    >
      <div class="editor-grid">
        <section class="card editor-card">
          <h4>Basic Settings</h4>
          <div class="form">
            <label>Name</label>
            <InputText v-model="elementForm.name" />
            <label>Shape</label>
            <Dropdown v-model="elementForm.shape" :options="shapeOptions" optionLabel="label" optionValue="value" />
            <label>SVG Path</label>
            <Textarea v-model="elementForm.svg_path" rows="2" autoResize />
            <small class="muted">For shape `Custom`, paste SVG path `d` data or import an SVG file below.</small>
            <div
              class="svg-dropzone"
              :class="{ active: svgDropActive }"
              @dragenter.prevent="onSvgDragEnter"
              @dragover.prevent="onSvgDragOver"
              @dragleave.prevent="onSvgDragLeave"
              @drop.prevent="onSvgDrop"
            >
              <input ref="svgFileInputRef" type="file" accept=".svg,image/svg+xml" class="svg-file-input" @change="onSvgFileInputChange" />
              <div class="svg-dropzone-text">Drop SVG here or pick a file</div>
              <Button label="Choose SVG File" icon="pi pi-upload" severity="secondary" outlined @click="openSvgFilePicker" />
            </div>
            <div class="compact-grid two">
              <div class="compact-field">
                <label>Width</label>
                <InputNumber v-model="elementForm.width" :min="20" showButtons />
              </div>
              <div class="compact-field">
                <label>Height</label>
                <InputNumber v-model="elementForm.height" :min="20" showButtons />
              </div>
            </div>
            <div class="compact-grid two">
              <div class="compact-field">
                <label>Fill Color</label>
                <div class="color-row">
                  <ColorPicker :modelValue="toPickerColor(elementForm.color)" @update:modelValue="elementForm.color = toHexColor($event)" />
                  <InputText v-model="elementForm.color" placeholder="#3498db" />
                </div>
              </div>
              <div class="compact-field">
                <label>Border Color</label>
                <div class="color-row">
                  <ColorPicker :modelValue="toPickerColor(elementForm.border)" @update:modelValue="elementForm.border = toHexColor($event)" />
                  <InputText v-model="elementForm.border" placeholder="#2d83be" />
                </div>
              </div>
            </div>
          </div>

            <div class="preview-block preview-block-editor">
              <label>Element Preview</label>
            <div ref="previewCanvasRef" class="preview-canvas">
              <div class="preview-element" :style="previewElementStyle">
                <svg v-if="previewSvgPath" class="preview-custom-svg" :viewBox="previewSvgViewBox" preserveAspectRatio="none">
                  <path :d="previewSvgPath" :fill="elementForm.color || '#3498db'" :stroke="elementForm.border || '#2d83be'" stroke-width="2" />
                </svg>
                <div class="preview-title">{{ elementForm.name || 'New Element' }}</div>
                <div
                  v-for="item in previewVisibleFields"
                  :key="`dialog-preview-field-${item.index}`"
                  class="preview-field preview-field-placed draggable"
                  :class="{ dragging: previewDrag.active && previewDrag.fieldIndex === item.index }"
                  :style="previewFieldStyle(item.field, item.order)"
                  @pointerdown.stop.prevent="beginPreviewFieldDrag(item.index, $event)"
                >
                  {{ item.field.label || item.field.key || `Field ${item.order + 1}` }}
                </div>
              </div>
            </div>
            <small class="muted">Drag labels in preview to set X/Y positions</small>
          </div>
        </section>

        <section class="card editor-card">
          <div class="builder-section">
            <div class="builder-header">
              <h4>Ports</h4>
              <Button icon="pi pi-plus" label="Add Port" text @click="addPort" />
            </div>
            <div v-if="!elementPorts.length" class="builder-empty">No ports yet</div>
            <div v-for="(port, idx) in elementPorts" :key="`port-editor-${idx}`" class="builder-item">
              <div class="builder-item-head">
                <span class="builder-index">#{{ idx + 1 }}</span>
                <Button icon="pi pi-trash" severity="danger" text @click="removePort(idx)" />
              </div>
              <div class="compact-grid three">
                <div class="compact-field">
                  <label>X (0..1)</label>
                  <InputNumber v-model="port.x" :min="0" :max="1" :minFractionDigits="2" :maxFractionDigits="2" :step="0.05" showButtons />
                </div>
              <div class="compact-field">
                <label>Y (0..1)</label>
                <InputNumber v-model="port.y" :min="0" :max="1" :minFractionDigits="2" :maxFractionDigits="2" :step="0.05" showButtons />
              </div>
              <div class="compact-field ports-label-field">
                <label>Label</label>
                <InputText v-model="port.label" placeholder="Port label" />
              </div>
              </div>
            </div>
          </div>

          <div class="builder-section">
            <div class="builder-header">
              <h4>Fields</h4>
              <Button icon="pi pi-plus" label="Add Field" text @click="addField" />
            </div>

            <div class="fields-layout">
              <div class="fields-list">
                <button
                  v-for="(field, idx) in elementFields"
                  :key="`field-chip-${idx}`"
                  type="button"
                  class="field-chip"
                  :class="{ active: selectedFieldIndex === idx }"
                  @click="selectField(idx)"
                >
                  <span class="field-chip-title">{{ field.label || `Field ${idx + 1}` }}</span>
                  <small class="field-chip-sub">{{ field.type || 'text' }}</small>
                </button>
                <div v-if="!elementFields.length" class="builder-empty">No fields yet</div>
              </div>

              <div class="field-editor-panel" v-if="selectedField">
                <div class="builder-item-head">
                  <span class="builder-index">#{{ selectedFieldIndex + 1 }}</span>
                  <Button icon="pi pi-trash" severity="danger" text @click="removeField(selectedFieldIndex)" />
                </div>
                <div class="compact-grid two">
                  <div class="compact-field">
                    <label>Label</label>
                    <InputText v-model="selectedField.label" placeholder="Label" />
                  </div>
                </div>
                <div class="compact-grid two">
                  <div class="compact-field">
                    <label>Type</label>
                    <Dropdown v-model="selectedField.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value" />
                  </div>
                  <div class="compact-field">
                    <label>Default Value</label>
                    <InputText v-model="selectedField.default" placeholder="Default value" />
                  </div>
                </div>
                <div class="compact-grid two">
                  <div class="compact-field">
                    <label>X Position (0..1)</label>
                    <InputNumber v-model="selectedField.x" :min="0" :max="1" :minFractionDigits="2" :maxFractionDigits="2" :step="0.05" showButtons />
                  </div>
                  <div class="compact-field">
                    <label>Y Position (0..1)</label>
                    <InputNumber v-model="selectedField.y" :min="0" :max="1" :minFractionDigits="2" :maxFractionDigits="2" :step="0.05" showButtons />
                  </div>
                </div>
                <div class="compact-grid two">
                  <div class="switch-wrap switch-wrap-wide"><small>Required</small><InputSwitch v-model="selectedField.required" /></div>
                  <div class="switch-wrap switch-wrap-wide"><small>Visible On Block</small><InputSwitch v-model="selectedField.visibleOnBlock" /></div>
                </div>
                <div class="compact-field" v-if="selectedField.type === 'select'">
                  <label>Options (comma separated)</label>
                  <InputText v-model="selectedField.optionsCsv" placeholder="one, two, three" />
                </div>
              </div>

              <div class="builder-empty field-editor-empty" v-else>Select a field to edit</div>
            </div>
          </div>
        </section>
      </div>
      <template #footer>
        <Button label="Cancel" text icon="pi pi-times" @click="elementEditor.visible = false" />
        <Button :label="elementEditor.mode === 'edit' ? 'Save' : 'Create'" icon="pi pi-check" :disabled="!canMutate" @click="submitElementEditor" />
      </template>
    </Dialog>

  </Dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputSwitch from 'primevue/inputswitch';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Textarea from 'primevue/textarea';
import InputNumber from 'primevue/inputnumber';
import ColorPicker from 'primevue/colorpicker';
import MultiSelect from 'primevue/multiselect';
import SelectButton from 'primevue/selectbutton';
import { diagramTypesService, rulesService } from '../services/index.js';
import { buildMatrixRows, matrixCellToPayload, normalizeRulesMatrix } from '../rules/connectionRules.js';
import { extractCustomShapeFromSvgText, parseCustomShapeData } from '../utils/customShape.js';

const BUILTIN_DIAGRAM_TYPE_IDS = {
  class: '00000000-0000-0000-0000-000000000101',
  use_case: '00000000-0000-0000-0000-000000000102',
  activity_diagram: '00000000-0000-0000-0000-000000000103',
  free_mode: '00000000-0000-0000-0000-000000000104',
};
const SELECTED_TYPE_STORAGE_KEY = 'acdc.rulesDialog.selectedTypeId';

const props = defineProps({
  modelValue: Boolean,
  currentDiagramTypeId: { type: String, default: null },
  connections: { type: Array, default: () => [] },
  elements: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'apply-diagram-type']);

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });
const diagramTypes = ref([]);
const selectedDiagramTypeId = ref(null);
const selectedType = ref(null);
const elementTypes = ref([]);
const connectionTypes = ref([]);
const matrix = ref(normalizeRulesMatrix(null));
const selectedElementType = ref(null);
const selectedConnectionType = ref(null);
const toasts = ref([]);
const toastTimers = new Map();

const typeCreateForm = reactive({ name: '', description: '', is_free_mode: false, cloneFromId: null });
const typeEditForm = reactive({ name: '', description: '', is_free_mode: false });
const elementForm = reactive({
  name: '',
  shape: 'rect',
  svg_path: '',
  width: 120,
  height: 60,
  color: '#3498db',
  border: '#2d83be',
});
const elementPorts = ref([]);
const elementFields = ref([]);
const selectedFieldIndex = ref(-1);
const previewCanvasRef = ref(null);
const svgFileInputRef = ref(null);
const svgDropActive = ref(false);
const previewDrag = reactive({
  active: false,
  fieldIndex: -1,
  startClientX: 0,
  startClientY: 0,
  startX: 0,
  startY: 0,
  rect: null,
});
const connectionForm = reactive({ name: '', color: '#34495e', dash: '', arrow_start: 'none', arrow_end: 'arrow', directed: true });
const elementEditor = reactive({ visible: false, mode: 'create' });
const bulkForm = reactive({ mode: 'row', target_id: null, connection_type_ids: [], allowed: true });
const pendingRuleKey = ref('');

const shapeOptions = [{ label: 'Rect', value: 'rect' }, { label: 'RoundRect', value: 'roundrect' }, { label: 'Ellipse', value: 'ellipse' }, { label: 'Diamond', value: 'diamond' }, { label: 'Circle', value: 'circle' }, { label: 'Cylinder', value: 'cylinder' }, { label: 'Actor', value: 'actor' }, { label: 'Custom', value: 'custom' }];
const fieldTypeOptions = [{ label: 'Text', value: 'text' }, { label: 'Number', value: 'number' }, { label: 'Select', value: 'select' }, { label: 'Checkbox', value: 'checkbox' }];
const arrowOptions = [{ label: 'None', value: 'none' }, { label: 'Arrow', value: 'arrow' }, { label: 'Empty Arrow', value: 'empty_arrow' }, { label: 'Filled Diamond', value: 'filled_diamond' }, { label: 'Empty Diamond', value: 'empty_diamond' }];
const allowOptions = [{ label: 'Allowed', value: true }, { label: 'Blocked', value: false }];
const bulkModes = [{ label: 'By Row', value: 'row' }, { label: 'By Column', value: 'column' }, { label: 'By Connection Type', value: 'connection_type' }];

const matrixElements = computed(() => matrix.value.elements || []);
const matrixRows = computed(() => buildMatrixRows(matrix.value));
const canMutate = computed(() => Boolean(selectedType.value && !selectedType.value.is_builtin));
const bulkTargets = computed(() => bulkForm.mode === 'connection_type' ? connectionTypes.value.map((x) => ({ label: x.name, value: x.id })) : matrixElements.value.map((x) => ({ label: x.name, value: x.id })));
const previewVisibleFields = computed(() =>
  elementFields.value
    .map((field, index) => ({ field, index }))
    .filter((entry) => entry.field.visibleOnBlock !== false)
    .map((entry, order) => ({ ...entry, order })),
);
const selectedField = computed(() => {
  if (selectedFieldIndex.value < 0) return null;
  return elementFields.value[selectedFieldIndex.value] || null;
});
const previewShapeData = computed(() => (elementForm.shape === 'custom' ? parseCustomShapeData(String(elementForm.svg_path || '')) : parseCustomShapeData('')));
const previewSvgPath = computed(() => previewShapeData.value.d);
const previewSvgViewBox = computed(() => previewShapeData.value.viewBox);
const previewElementStyle = computed(() => {
  const w = Math.max(60, Number(elementForm.width) || 120);
  const h = Math.max(40, Number(elementForm.height) || 60);
  const bg = elementForm.color || '#3498db';
  const border = elementForm.border || '#2d83be';
  const shape = elementForm.shape || 'rect';
  const style = {
    width: `${w}px`,
    minHeight: `${h}px`,
    background: bg,
    border: `2px solid ${border}`,
    color: '#ffffff',
  };
  if (shape === 'custom') {
    style.background = 'transparent';
    style.border = 'none';
  }
  if (shape === 'ellipse' || shape === 'circle') style.borderRadius = '50%';
  else if (shape === 'roundrect' || shape === 'cylinder') style.borderRadius = '16px';
  else if (shape === 'diamond') style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  return style;
});
const previewFieldStyle = (field, idx) => {
  const fallbackY = Math.min(0.9, 0.22 + idx * 0.16);
  const x = clamp01(field?.x ?? 0.5);
  const y = clamp01(field?.y ?? fallbackY);
  return {
    left: `${(x * 100).toFixed(1)}%`,
    top: `${(y * 100).toFixed(1)}%`,
  };
};

const asArray = (x) => (Array.isArray(x) ? x : []);
const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalizeDiagramTypeId = (id, key) => {
  if (isUuid(id)) return id;
  if (typeof key === 'string' && BUILTIN_DIAGRAM_TYPE_IDS[key]) return BUILTIN_DIAGRAM_TYPE_IDS[key];
  if (typeof id === 'string' && BUILTIN_DIAGRAM_TYPE_IDS[id]) return BUILTIN_DIAGRAM_TYPE_IDS[id];
  return id;
};
const normalizeTypeEntity = (item) => ({ ...item, id: normalizeDiagramTypeId(item?.id, item?.key) });
const connectionById = (id) => connectionTypes.value.find((x) => x.id === id);
const connectionName = (id) => connectionById(id)?.name || id;
const arrowGlyph = (id) => {
  const marker = connectionById(id)?.arrow_end;
  if (marker === 'arrow') return '->';
  if (marker === 'empty_arrow') return '▷';
  if (marker === 'filled_diamond') return '◆';
  if (marker === 'empty_diamond') return '◇';
  return '';
};
const ruleLineStyle = (id) => {
  const conn = connectionById(id);
  const color = conn?.color || '#334155';
  return {
    borderBottom: `2px ${conn?.dash ? 'dashed' : 'solid'} ${color}`,
    width: '20px',
    display: 'inline-block',
  };
};
const generateClientKey = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
};
const dismissToast = (id) => {
  const timer = toastTimers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    toastTimers.delete(id);
  }
  toasts.value = toasts.value.filter((item) => item.id !== id);
};
const clearToasts = () => {
  for (const timer of toastTimers.values()) window.clearTimeout(timer);
  toastTimers.clear();
  toasts.value = [];
};
const pushToast = (kind, message, ttlMs = 2600) => {
  const id = generateClientKey('toast');
  toasts.value = [...toasts.value, { id, kind, message: String(message || '') }];
  const timer = window.setTimeout(() => dismissToast(id), ttlMs);
  toastTimers.set(id, timer);
};
const fail = (msg) => pushToast('error', msg, 4200);
const ok = (msg) => pushToast('success', msg, 2400);
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const toOptionsCsv = (options) => asArray(options).join(', ');
const fromOptionsCsv = (csv) => String(csv || '').split(',').map((x) => x.trim()).filter(Boolean);
const makePort = () => ({ x: 0.5, y: 0.5, label: '' });
const makeField = (idx = 1) => ({
  type: 'text',
  label: `Field ${idx}`,
  key: generateClientKey('field'),
  required: false,
  default: '',
  visibleOnBlock: true,
  x: 0.5,
  y: Math.min(0.9, 0.22 + (idx - 1) * 0.16),
  optionsCsv: '',
});
const normalizePortsForApi = () =>
  elementPorts.value.map((port) => ({ x: clamp01(port.x), y: clamp01(port.y), ...(String(port.label || '').trim() ? { label: String(port.label).trim() } : {}) }));
const normalizeFieldsForApi = () =>
  elementFields.value.map((field, index) => ({
    key: String(field.key || '').trim() || generateClientKey(`field${index + 1}`),
    type: field.type || 'text',
    label: String(field.label || '').trim(),
    required: Boolean(field.required),
    default: field.default ?? '',
    visibleOnBlock: field.visibleOnBlock !== false,
    x: clamp01(field.x),
    y: clamp01(field.y),
    options: field.type === 'select' ? fromOptionsCsv(field.optionsCsv) : [],
  }));
const addPort = () => elementPorts.value.push(makePort());
const removePort = (idx) => elementPorts.value.splice(idx, 1);
const selectField = (idx) => {
  if (idx < 0 || idx >= elementFields.value.length) {
    selectedFieldIndex.value = -1;
    return;
  }
  selectedFieldIndex.value = idx;
};
const addField = () => {
  elementFields.value.push(makeField(elementFields.value.length + 1));
  selectedFieldIndex.value = elementFields.value.length - 1;
};
const removeField = (idx) => {
  if (idx < 0 || idx >= elementFields.value.length) return;
  elementFields.value.splice(idx, 1);
  if (elementFields.value.length === 0) {
    selectedFieldIndex.value = -1;
    return;
  }
  if (selectedFieldIndex.value >= elementFields.value.length) {
    selectedFieldIndex.value = elementFields.value.length - 1;
  } else if (idx <= selectedFieldIndex.value) {
    selectedFieldIndex.value = Math.max(0, selectedFieldIndex.value - 1);
  }
};
const beginPreviewFieldDrag = (fieldIndex, event) => {
  if (event.button !== 0) return;
  const canvas = previewCanvasRef.value;
  const field = elementFields.value[fieldIndex];
  if (!canvas || !field) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  previewDrag.active = true;
  previewDrag.fieldIndex = fieldIndex;
  previewDrag.startClientX = event.clientX;
  previewDrag.startClientY = event.clientY;
  previewDrag.startX = clamp01(field.x ?? 0.5);
  previewDrag.startY = clamp01(field.y ?? 0.5);
  previewDrag.rect = rect;

  window.addEventListener('pointermove', handlePreviewFieldDragMove);
  window.addEventListener('pointerup', finishPreviewFieldDrag);
  window.addEventListener('pointercancel', finishPreviewFieldDrag);
};
const handlePreviewFieldDragMove = (event) => {
  if (!previewDrag.active) return;
  const field = elementFields.value[previewDrag.fieldIndex];
  const rect = previewDrag.rect;
  if (!field || !rect || !rect.width || !rect.height) return;

  const dx = (event.clientX - previewDrag.startClientX) / rect.width;
  const dy = (event.clientY - previewDrag.startClientY) / rect.height;
  field.x = clamp01(previewDrag.startX + dx);
  field.y = clamp01(previewDrag.startY + dy);
};
const finishPreviewFieldDrag = () => {
  if (!previewDrag.active) return;
  previewDrag.active = false;
  previewDrag.fieldIndex = -1;
  previewDrag.rect = null;
  window.removeEventListener('pointermove', handlePreviewFieldDragMove);
  window.removeEventListener('pointerup', finishPreviewFieldDrag);
  window.removeEventListener('pointercancel', finishPreviewFieldDrag);
};
const toHexColor = (value) => {
  if (typeof value !== 'string') return '#000000';
  return value.startsWith('#') ? value : `#${value}`;
};
const toPickerColor = (value) => String(value || '#3498db').replace('#', '');
const validateSvgInput = () => {
  if (elementForm.shape !== 'custom') return true;
  const shapeData = parseCustomShapeData(String(elementForm.svg_path || ''));
  if (!shapeData.d) {
    fail('SVG path is required for custom shape');
    return false;
  }
  return true;
};
const applyImportedSvg = async (file) => {
  if (!file) return;
  const text = await file.text();
  const extracted = extractCustomShapeFromSvgText(text);
  elementForm.shape = 'custom';
  elementForm.svg_path = extracted.payload;
  const ratio = Math.max(0.2, Math.min(5, extracted.width / Math.max(1, extracted.height)));
  const baseHeight = Math.max(40, Number(elementForm.height) || 60);
  elementForm.width = Math.max(40, Math.round(baseHeight * ratio));
  ok('SVG imported');
};
const openSvgFilePicker = () => {
  if (!svgFileInputRef.value) return;
  svgFileInputRef.value.value = '';
  svgFileInputRef.value.click();
};
const onSvgFileInputChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  try {
    await applyImportedSvg(file);
  } catch (e) {
    fail(e?.message || 'Failed to import SVG');
  }
};
const onSvgDragEnter = () => {
  svgDropActive.value = true;
};
const onSvgDragOver = () => {
  svgDropActive.value = true;
};
const onSvgDragLeave = (event) => {
  if (event?.currentTarget && event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
  svgDropActive.value = false;
};
const onSvgDrop = async (event) => {
  svgDropActive.value = false;
  const file = event?.dataTransfer?.files?.[0];
  if (!file) return;
  if (!/\.svg$/i.test(file.name || '') && file.type !== 'image/svg+xml') {
    fail('Only SVG files are supported');
    return;
  }
  try {
    await applyImportedSvg(file);
  } catch (e) {
    fail(e?.message || 'Failed to import SVG');
  }
};

const resetElementForm = () => {
  selectedElementType.value = null;
  Object.assign(elementForm, {
    name: '',
    shape: 'rect',
    svg_path: '',
    width: 120,
    height: 60,
    color: '#3498db',
    border: '#2d83be',
  });
  elementPorts.value = [];
  elementFields.value = [];
  selectedFieldIndex.value = -1;
};

const resetConnectionForm = () => {
  selectedConnectionType.value = null;
  Object.assign(connectionForm, { name: '', color: '#34495e', dash: '', arrow_start: 'none', arrow_end: 'arrow', directed: true });
};

const fillTypeEdit = () => {
  if (!selectedType.value) return;
  Object.assign(typeEditForm, { name: selectedType.value.name || '', description: selectedType.value.description || '', is_free_mode: Boolean(selectedType.value.is_free_mode) });
};

const fillElementForm = ({ data }) => {
  selectedElementType.value = data;
  Object.assign(elementForm, {
    name: data.name || '',
    shape: data.shape || 'rect',
    svg_path: data.svg_path || '',
    width: Number(data.default_size?.width) || 120,
    height: Number(data.default_size?.height) || 60,
    color: data.default_style?.color || '#3498db',
    border: data.default_style?.border || '#2d83be',
  });
  elementPorts.value = asArray(data.ports).map((port) => ({
    x: clamp01(port?.x),
    y: clamp01(port?.y),
    label: String(port?.label || ''),
  }));
  elementFields.value = asArray(data.field_schema).map((field, idx) => ({
    type: field?.type || 'text',
    label: String(field?.label || ''),
    key: String(field?.key || `field_${idx + 1}`),
    required: Boolean(field?.required),
    default: field?.default ?? '',
    visibleOnBlock: field?.visibleOnBlock !== false,
    x: clamp01(field?.x ?? 0.5),
    y: clamp01(field?.y ?? Math.min(0.9, 0.22 + idx * 0.16)),
    optionsCsv: toOptionsCsv(field?.options),
  }));
  selectedFieldIndex.value = elementFields.value.length ? 0 : -1;
};

const openCreateElementDialog = () => {
  if (!canMutate.value) {
    fail('Select a custom diagram type (or clone built-in) to create elements');
    return;
  }
  elementEditor.mode = 'create';
  resetElementForm();
  elementEditor.visible = true;
};

const openEditElementDialog = () => {
  if (!canMutate.value) {
    fail('Built-in diagram types are read-only. Clone it to edit.');
    return;
  }
  if (!selectedElementType.value) return;
  elementEditor.mode = 'edit';
  fillElementForm({ data: selectedElementType.value });
  elementEditor.visible = true;
};

const quickCloneSelectedType = async () => {
  if (!selectedType.value) return;
  try {
    const name = `${selectedType.value.name} (Custom)`;
    const cloned = await diagramTypesService.clone(selectedType.value.id, name);
    selectedDiagramTypeId.value = cloned.id;
    await reloadCatalog();
    ok('Type cloned. You can edit it now.');
  } catch (e) {
    fail(e.message || 'Failed to clone type');
  }
};

const fillConnectionForm = ({ data }) => {
  selectedConnectionType.value = data;
  Object.assign(connectionForm, { name: data.name || '', color: data.color || '#34495e', dash: data.dash || '', arrow_start: data.arrow_start || 'none', arrow_end: data.arrow_end || 'arrow', directed: Boolean(data.directed) });
};

const loadContext = async () => {
  const resolvedId = normalizeDiagramTypeId(selectedDiagramTypeId.value, selectedType.value?.key);
  if (!isUuid(resolvedId)) {
    selectedType.value = null;
    elementTypes.value = [];
    connectionTypes.value = [];
    matrix.value = normalizeRulesMatrix(null);
    return;
  }
  selectedType.value = normalizeTypeEntity(await diagramTypesService.getById(resolvedId));
  selectedDiagramTypeId.value = selectedType.value.id;
  fillTypeEdit();
  elementTypes.value = await diagramTypesService.listElements(resolvedId);
  connectionTypes.value = await diagramTypesService.listConnectionTypes(resolvedId);
  matrix.value = normalizeRulesMatrix(await rulesService.getMatrix(resolvedId));
};

const reloadCatalog = async () => {
  try {
    diagramTypes.value = (await diagramTypesService.list()).map((item) => normalizeTypeEntity(item));
    const selectedId = normalizeDiagramTypeId(selectedDiagramTypeId.value);
    const persistedRaw = typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_TYPE_STORAGE_KEY) : null;
    const persistedId = normalizeDiagramTypeId(persistedRaw);
    const currentId = normalizeDiagramTypeId(props.currentDiagramTypeId);

    if (isUuid(selectedId) && diagramTypes.value.some((x) => x.id === selectedId)) {
      selectedDiagramTypeId.value = selectedId;
    } else if (isUuid(persistedId) && diagramTypes.value.some((x) => x.id === persistedId)) {
      selectedDiagramTypeId.value = persistedId;
    } else if (isUuid(currentId) && diagramTypes.value.some((x) => x.id === currentId)) {
      selectedDiagramTypeId.value = currentId;
    } else if (diagramTypes.value.length) {
      const firstUuid = diagramTypes.value.find((x) => isUuid(x.id));
      selectedDiagramTypeId.value = firstUuid?.id || diagramTypes.value[0].id;
    }
    await loadContext();
  } catch (e) {
    fail(e.message || 'Failed to load diagram types catalog');
  }
};

const emitTypeToDiagram = ({ toast = false } = {}) => {
  if (!selectedType.value) return;
  emit('apply-diagram-type', {
    type: selectedType.value,
    elements: elementTypes.value,
    connectionTypes: connectionTypes.value,
    rulesMatrix: matrix.value,
  });
  if (toast) ok('Type applied to diagram');
};

const onTypeChange = async () => {
  try {
    await loadContext();
    emitTypeToDiagram();
  } catch (e) {
    fail(e.message || 'Failed to load type');
  }
};

const createBlankType = async () => {
  if (!typeCreateForm.name.trim()) return fail('Name is required');
  try {
    const created = await diagramTypesService.create({
      name: typeCreateForm.name.trim(),
      description: typeCreateForm.description?.trim() || null,
      is_free_mode: Boolean(typeCreateForm.is_free_mode),
      metadata: { createdFrom: 'ui' },
    });
    selectedDiagramTypeId.value = created.id;
    await reloadCatalog();
    emitTypeToDiagram();
    ok('Type created');
  } catch (e) { fail(e.message || 'Failed to create type'); }
};

const createCloneType = async () => {
  if (!typeCreateForm.cloneFromId) return fail('Select source type for clone');
  if (!typeCreateForm.name.trim()) return fail('Name is required');
  try {
    const created = await diagramTypesService.clone(typeCreateForm.cloneFromId, typeCreateForm.name.trim());
    selectedDiagramTypeId.value = created.id;
    await reloadCatalog();
    emitTypeToDiagram();
    ok('Clone created');
  } catch (e) { fail(e.message || 'Failed to clone type'); }
};

const updateType = async () => {
  if (!selectedDiagramTypeId.value) return;
  try {
    selectedType.value = await diagramTypesService.update(selectedDiagramTypeId.value, {
      name: typeEditForm.name,
      description: typeEditForm.description,
      is_free_mode: typeEditForm.is_free_mode,
    });
    await reloadCatalog();
    emitTypeToDiagram();
    ok('Type updated');
  } catch (e) { fail(e.message || 'Failed to update type'); }
};

const deleteType = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  try {
    await diagramTypesService.remove(selectedDiagramTypeId.value);
    selectedDiagramTypeId.value = null;
    await reloadCatalog();
    emitTypeToDiagram();
    ok('Type deleted');
  } catch (e) { fail(e.message || 'Failed to delete type'); }
};

const createElement = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) {
    fail('Built-in diagram types cannot be modified. Clone type first.');
    return false;
  }
  if (!elementForm.name?.trim()) {
    fail('Element name is required');
    return false;
  }
  if (!validateSvgInput()) return false;
  try {
    await diagramTypesService.createElement(selectedDiagramTypeId.value, {
      name: elementForm.name,
      shape: elementForm.shape,
      svg_path: elementForm.shape === 'custom' ? String(elementForm.svg_path || '').trim() : null,
      default_style: { color: elementForm.color, border: elementForm.border },
      default_size: { width: elementForm.width, height: elementForm.height },
      ports: normalizePortsForApi(),
      field_schema: normalizeFieldsForApi(),
    });
    await loadContext();
    emitTypeToDiagram();
    resetElementForm();
    ok('Element created');
    return true;
  } catch (e) {
    fail(e.message || 'Failed to create element');
    return false;
  }
};

const updateElement = async () => {
  if (!selectedDiagramTypeId.value || !selectedElementType.value || !canMutate.value) {
    fail('Built-in diagram types cannot be modified. Clone type first.');
    return false;
  }
  if (!elementForm.name?.trim()) {
    fail('Element name is required');
    return false;
  }
  if (!validateSvgInput()) return false;
  try {
    await diagramTypesService.updateElement(selectedDiagramTypeId.value, selectedElementType.value.id, {
      name: elementForm.name,
      shape: elementForm.shape,
      svg_path: elementForm.shape === 'custom' ? String(elementForm.svg_path || '').trim() : null,
      default_style: { color: elementForm.color, border: elementForm.border },
      default_size: { width: elementForm.width, height: elementForm.height },
      ports: normalizePortsForApi(),
      field_schema: normalizeFieldsForApi(),
    });
    await loadContext();
    emitTypeToDiagram();
    ok('Element updated');
    return true;
  } catch (e) {
    fail(e.message || 'Failed to update element');
    return false;
  }
};

const deleteElement = async () => {
  if (!selectedDiagramTypeId.value || !selectedElementType.value || !canMutate.value) return;
  try {
    const previousIndex = elementTypes.value.findIndex((item) => item.id === selectedElementType.value.id);
    await diagramTypesService.deleteElement(selectedDiagramTypeId.value, selectedElementType.value.id);
    await loadContext();
    emitTypeToDiagram();
    if (elementTypes.value.length) {
      const nextIndex = Math.min(Math.max(previousIndex, 0), elementTypes.value.length - 1);
      fillElementForm({ data: elementTypes.value[nextIndex] });
    } else {
      resetElementForm();
    }
    ok('Element deleted');
  } catch (e) { fail(e.message || 'Failed to delete element'); }
};

const submitElementEditor = async () => {
  const success = elementEditor.mode === 'edit' ? await updateElement() : await createElement();
  if (success) elementEditor.visible = false;
};

const createConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  if (!connectionForm.name?.trim()) return fail('Connection type name is required');
  try {
    await diagramTypesService.createConnectionType(selectedDiagramTypeId.value, { ...connectionForm, name: connectionForm.name.trim() });
    await loadContext();
    emitTypeToDiagram();
    resetConnectionForm();
    ok('Connection type created');
  } catch (e) { fail(e.message || 'Failed to create connection type'); }
};

const updateConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !selectedConnectionType.value || !canMutate.value) return;
  if (!connectionForm.name?.trim()) return fail('Connection type name is required');
  try {
    await diagramTypesService.updateConnectionType(selectedDiagramTypeId.value, selectedConnectionType.value.id, { ...connectionForm, name: connectionForm.name.trim() });
    await loadContext();
    emitTypeToDiagram();
    ok('Connection type updated');
  } catch (e) { fail(e.message || 'Failed to update connection type'); }
};

const deleteConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !selectedConnectionType.value || !canMutate.value) return;
  try {
    await diagramTypesService.deleteConnectionType(selectedDiagramTypeId.value, selectedConnectionType.value.id);
    await loadContext();
    emitTypeToDiagram();
    resetConnectionForm();
    ok('Connection type deleted');
  } catch (e) { fail(e.message || 'Failed to delete connection type'); }
};

const toggleCellRule = async (fromEl, toEl, rule) => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  const opKey = `${fromEl.id}:${toEl.id}:${rule.connection_type_id}`;
  if (pendingRuleKey.value === opKey) return;

  // If we are about to BLOCK this rule, check if existing diagram connections violate it
  const nextAllowed = !Boolean(rule.allowed);
  if (!nextAllowed) {
    const violations = asArray(props.connections).filter((conn) => {
      const fromElement = asArray(props.elements).find((e) => e.id === conn.fromId);
      const toElement = asArray(props.elements).find((e) => e.id === conn.toId);
      const fromTypeMatch =
        fromElement?.element_type_id === fromEl.id ||
        fromElement?.type === fromEl.key;
      const toTypeMatch =
        toElement?.element_type_id === toEl.id ||
        toElement?.type === toEl.key;
      const connTypeMatch =
        conn.connection_type_id === rule.connection_type_id ||
        conn.type === connectionById(rule.connection_type_id)?.key;
      return fromTypeMatch && toTypeMatch && connTypeMatch;
    });
    if (violations.length > 0) {
      fail(
        `Cannot block: ${violations.length} existing connection(s) of this type already exist between these elements on the canvas. Remove them first.`,
      );
      return;
    }
  }

  pendingRuleKey.value = opKey;
  try {
    const rows = buildMatrixRows(matrix.value);
    const row = rows.find((item) => item.fromElement.id === fromEl.id);
    const currentRules = asArray(row?.[toEl.id]).map((item) => ({ ...item }));
    const nextRules = currentRules.map((item) =>
      item.connection_type_id === rule.connection_type_id
        ? { ...item, allowed: nextAllowed }
        : item,
    );

    await rulesService.updateCell(
      selectedDiagramTypeId.value,
      matrixCellToPayload({
        fromElementTypeId: fromEl.id,
        toElementTypeId: toEl.id,
        rules: nextRules,
      }),
    );
    matrix.value = normalizeRulesMatrix(await rulesService.getMatrix(selectedDiagramTypeId.value));
    emitTypeToDiagram();
  } catch (e) {
    fail(e.message || 'Failed to update rule');
  } finally {
    pendingRuleKey.value = '';
  }
};

const applyBulkRules = async () => {
  if (!selectedDiagramTypeId.value) return;
  try {
    await rulesService.bulkUpdate(selectedDiagramTypeId.value, { mode: bulkForm.mode, target_id: bulkForm.target_id, connection_type_ids: asArray(bulkForm.connection_type_ids), allowed: Boolean(bulkForm.allowed) });
    matrix.value = normalizeRulesMatrix(await rulesService.getMatrix(selectedDiagramTypeId.value));
    emitTypeToDiagram();
    ok('Bulk update applied');
  } catch (e) { fail(e.message || 'Failed to apply bulk update'); }
};

watch(() => visible.value, async (isOpen) => {
  if (isOpen) {
    await reloadCatalog();
    return;
  }
  finishPreviewFieldDrag();
  svgDropActive.value = false;
  clearToasts();
});
watch(() => elementEditor.visible, (isOpen) => {
  if (!isOpen) {
    finishPreviewFieldDrag();
    svgDropActive.value = false;
  }
});
watch(() => selectedDiagramTypeId.value, (id) => {
  if (!isUuid(id)) return;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SELECTED_TYPE_STORAGE_KEY, id);
  }
});
watch(() => props.currentDiagramTypeId, (id) => {
  const normalized = normalizeDiagramTypeId(id);
  if (isUuid(normalized) && !isUuid(selectedDiagramTypeId.value)) {
    selectedDiagramTypeId.value = normalized;
  }
});
onBeforeUnmount(() => {
  finishPreviewFieldDrag();
  clearToasts();
});
</script>

<style>
.rules-dialog {
  --rt-surface: var(--app-panel, #ffffff);
  --rt-surface-soft: var(--app-panel-soft, #f8fafc);
  --rt-border: var(--app-border, #d1d5db);
  --rt-text: var(--app-text, #1f2937);
  --rt-muted: var(--app-muted, #64748b);
  --rt-success-bg: color-mix(in srgb, #10b981 18%, var(--rt-surface) 82%);
  --rt-success-border: color-mix(in srgb, #10b981 45%, var(--rt-border) 55%);
  --rt-danger-bg: color-mix(in srgb, #ef4444 16%, var(--rt-surface) 84%);
  --rt-danger-border: color-mix(in srgb, #ef4444 45%, var(--rt-border) 55%);
  --rt-warning-bg: color-mix(in srgb, #f59e0b 14%, var(--rt-surface) 86%);
  --rt-warning-border: color-mix(in srgb, #f59e0b 35%, var(--rt-border) 65%);
}

.top-bar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(540px, 1fr)); gap: 1rem; align-items: start; }
.type-workflow-card { min-height: auto; }
.type-divider {
  height: 1px;
  background: var(--rt-border);
  margin: 1rem 0;
}
.builtin-warning {
  margin-bottom: 0.85rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--rt-warning-border);
  border-left: 4px solid #f59e0b;
  border-radius: 10px;
  background: var(--rt-warning-bg);
  color: var(--rt-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.builtin-warning-text {
  flex: 1 1 300px;
}
.builtin-warning-action {
  white-space: nowrap;
}
.rt-toast-stack {
  position: fixed;
  z-index: 5000;
  right: 1.5rem;
  bottom: 1.5rem;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.55rem;
  pointer-events: none;
}
.rt-toast {
  pointer-events: auto;
  min-width: 280px;
  max-width: 520px;
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--rt-border);
  background: var(--rt-surface);
  color: var(--rt-text);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.2);
}
.rt-toast.success {
  border-color: var(--rt-success-border);
  background: var(--rt-success-bg);
}
.rt-toast.error {
  border-color: var(--rt-danger-border);
  background: var(--rt-danger-bg);
}
.rt-toast-icon {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
  background: #0f766e;
}
.rt-toast.error .rt-toast-icon {
  background: #b91c1c;
}
.rt-toast-text {
  font-size: 0.9rem;
  line-height: 1.3;
}
.rt-toast-close {
  border: none;
  background: transparent;
  color: var(--rt-muted);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.2rem;
}
.rt-toast-enter-active,
.rt-toast-leave-active {
  transition: all 180ms ease;
}
.rt-toast-enter-from,
.rt-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.card {
  border: 1px solid var(--rt-border);
  border-radius: 12px;
  padding: 1rem;
  background: var(--rt-surface);
  min-height: 58vh;
  overflow: auto;
  color: var(--rt-text);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}
.card.type-workflow-card {
  min-height: auto;
  overflow: visible;
}
.card h4 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--rt-text);
}
.form { display: grid; grid-template-columns: 1fr; gap: 0.4rem; margin-bottom: 0.8rem; }
.form label {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--rt-muted);
}
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.muted { color: var(--app-muted, #64748b); }
.matrix-cell { border: 1px solid var(--rt-border); border-radius: 8px; padding: 0.4rem; background: var(--rt-surface-soft); min-width: 170px; display: flex; flex-direction: column; gap: 0.3rem; }
.rule-row { display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; }
.rule-name { display: inline-flex; align-items: center; gap: 0.35rem; }
.rule-line { flex: 0 0 auto; }
.rule-editor-row { border: 1px solid var(--rt-border); border-radius: 8px; padding: 0.5rem; margin-top: 0.5rem; display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; background: var(--rt-surface-soft); }
.matrix-only-card {
  min-height: 82vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.connection-types-details {
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  background: var(--rt-surface-soft);
  padding: 0.65rem 0.75rem;
}
.connection-types-details > summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--rt-text);
}
.connection-types-grid {
  margin-top: 0.65rem;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(300px, 1fr);
  gap: 0.75rem;
}
.matrix-actions {
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  background: var(--rt-surface-soft);
}
.matrix-table {
  flex: 1;
  min-height: 0;
}
.matrix-table :deep(.p-datatable-wrapper),
.matrix-table :deep(.p-datatable-table-container) {
  overflow-x: scroll !important;
  overflow-y: auto !important;
  scrollbar-gutter: stable both-edges;
}
.rule-toggle {
  width: 100%;
  border: 1px solid var(--rt-border);
  border-radius: 8px;
  background: var(--rt-surface);
  color: var(--rt-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35rem 0.45rem;
  cursor: pointer;
}
.rule-toggle.allowed {
  border-color: var(--rt-success-border);
  background: var(--rt-success-bg);
}
.rule-toggle.blocked {
  border-color: var(--rt-danger-border);
  background: var(--rt-danger-bg);
}
.rule-toggle:disabled {
  opacity: 0.64;
  cursor: not-allowed;
}
.rule-state {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.svg-dropzone {
  border: 1px dashed var(--rt-border);
  border-radius: 10px;
  padding: 0.75rem;
  background: var(--rt-surface-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.svg-dropzone.active {
  border-color: var(--app-accent, #0f766e);
  box-shadow: inset 0 0 0 1px var(--app-accent, #0f766e);
}
.svg-dropzone-text {
  font-size: 0.84rem;
  color: var(--rt-muted);
}
.svg-file-input {
  display: none;
}

.builder-section {
  border: 1px solid var(--rt-border);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--rt-surface-soft);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.builder-header h4 {
  margin: 0;
  font-size: 0.95rem;
}
.builder-item {
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  padding: 0.65rem;
  background: var(--rt-surface);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.builder-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.builder-index {
  font-size: 0.82rem;
  color: var(--rt-muted);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rt-border);
  border-radius: 8px;
  background: var(--rt-surface-soft);
}
.builder-empty {
  border: 1px dashed var(--rt-border);
  border-radius: 10px;
  padding: 0.85rem;
  color: var(--rt-muted);
  text-align: center;
  background: rgba(148, 163, 184, 0.08);
}
.fields-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 0.75rem;
  min-height: 260px;
}
.fields-list {
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  background: var(--rt-surface);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow: auto;
}
.field-chip {
  appearance: none;
  border: 1px solid var(--rt-border);
  background: var(--rt-surface-soft);
  color: var(--rt-text);
  border-radius: 8px;
  text-align: left;
  padding: 0.5rem 0.6rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.field-chip:hover {
  border-color: var(--app-accent, #0f766e);
}
.field-chip.active {
  border-color: var(--app-accent, #0f766e);
  box-shadow: inset 0 0 0 1px var(--app-accent, #0f766e);
}
.field-chip-title {
  font-weight: 600;
  font-size: 0.9rem;
}
.field-chip-sub {
  color: var(--rt-muted);
  font-size: 0.75rem;
}
.field-editor-panel {
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  background: var(--rt-surface);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.field-editor-empty {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compact-grid {
  display: grid;
  gap: 0.6rem;
}
.compact-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.compact-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.compact-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.compact-field label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--rt-muted);
}
.switch-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  min-width: 80px;
}
.switch-wrap-wide {
  border: 1px solid var(--rt-border);
  border-radius: 10px;
  padding: 0.5rem 0.7rem;
  background: var(--rt-surface-soft);
}
.editor-grid { display: grid; grid-template-columns: minmax(520px, 1fr) minmax(520px, 1fr); gap: 1rem; align-items: start; }
.editor-card {
  min-height: 52vh;
}
.color-row { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; align-items: center; }
.preview-block-editor {
  margin-top: 0.8rem;
}

.preview-block { margin-bottom: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; }
.preview-canvas {
  border: 1px dashed var(--rt-border);
  border-radius: 10px;
  min-height: 180px;
  padding: 0.8rem;
  background: var(--rt-surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-element {
  padding: 0.55rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
  position: relative;
  overflow: hidden;
}
.preview-title { font-weight: 700; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.35); padding-bottom: 0.25rem; }
.preview-field { font-size: 0.8rem; opacity: 0.95; border-top: 1px solid rgba(255, 255, 255, 0.22); padding-top: 0.25rem; }
.preview-field-placed {
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  padding: 2px 6px;
  white-space: nowrap;
  border-top: none;
}
.preview-field-placed.draggable {
  cursor: grab;
  pointer-events: auto;
  user-select: none;
}
.preview-field-placed.draggable.dragging {
  cursor: grabbing;
  z-index: 3;
}
.preview-custom-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.rules-dialog.p-dialog {
  background: var(--rt-surface) !important;
  color: var(--rt-text) !important;
  border: 1px solid var(--rt-border) !important;
}

.rules-dialog :deep(.p-dialog-header),
.rules-dialog :deep(.p-dialog-content),
.rules-dialog :deep(.p-dialog-footer) {
  background: var(--rt-surface) !important;
  color: var(--rt-text) !important;
}

.rules-dialog.p-dialog,
.rules-dialog .p-dialog-header,
.rules-dialog .p-dialog-content,
.rules-dialog .p-dialog-footer,
.rules-dialog .p-tabview,
.rules-dialog .p-tabview-panels,
.rules-dialog .p-tabview-panel,
.rules-dialog .p-tabview-nav,
.rules-dialog .p-tabview-nav-link {
  background: var(--rt-surface) !important;
  color: var(--rt-text) !important;
}

.rules-dialog :deep(.p-tabview-nav),
.rules-dialog :deep(.p-tabview-panels),
.rules-dialog :deep(.p-tabview-panel) {
  background: var(--rt-surface) !important;
  color: var(--rt-text) !important;
}

.rules-dialog :deep(.p-component),
.rules-dialog :deep(.p-tabview),
.rules-dialog :deep(.p-tabview-panels),
.rules-dialog :deep(.p-tabview-panel),
.rules-dialog :deep(.p-dialog-content > div) {
  color: var(--rt-text) !important;
}

.rules-dialog :deep(.p-datatable),
.rules-dialog :deep(.p-datatable-table),
.rules-dialog :deep(.p-datatable-thead > tr > th),
.rules-dialog :deep(.p-datatable-tbody > tr > td) {
  background: var(--rt-surface);
  color: var(--rt-text);
  border-color: var(--rt-border);
}
.rules-dialog :deep(.p-datatable-thead > tr > th) {
  background: var(--rt-surface) !important;
}
.rules-dialog :deep(.p-datatable-tbody > tr > td) {
  background: var(--rt-surface-soft) !important;
}
.rules-dialog :deep(.p-datatable-wrapper),
.rules-dialog :deep(.p-datatable-table-container) {
  background: var(--rt-surface) !important;
}

.p-dialog-mask {
  background: rgba(2, 6, 23, 0.55) !important;
}

.rules-dialog :deep(.p-dialog-content) {
  background: var(--rt-surface) !important;
  max-height: 92vh;
  overflow: hidden;
}

.element-editor-dialog :deep(.p-dialog-content) {
  padding-bottom: 1rem;
}

.ports-label-field {
  grid-column: 1 / -1;
}

.rules-dialog :deep(.p-inputtext),
.rules-dialog :deep(.p-inputnumber-input),
.rules-dialog :deep(.p-dropdown),
.rules-dialog :deep(.p-multiselect),
.rules-dialog :deep(.p-selectbutton),
.rules-dialog :deep(.p-textarea) {
  width: 100%;
  background: var(--rt-surface);
  color: var(--rt-text);
  border-color: var(--rt-border);
}

.rules-dialog :deep(.p-dropdown-panel),
.rules-dialog :deep(.p-multiselect-panel) {
  background: var(--rt-surface);
  color: var(--rt-text);
  border: 1px solid var(--rt-border);
}

.rules-dialog :deep(.p-dropdown-item),
.rules-dialog :deep(.p-multiselect-item) {
  color: var(--rt-text);
}

html[data-theme='dark'] .p-dialog.rules-dialog,
html[data-theme='dark'] .p-dialog.rules-dialog .p-dialog-header,
html[data-theme='dark'] .p-dialog.rules-dialog .p-dialog-content,
html[data-theme='dark'] .p-dialog.rules-dialog .p-dialog-footer,
html[data-theme='dark'] .p-dialog.rules-dialog .p-tabview,
html[data-theme='dark'] .p-dialog.rules-dialog .p-tabview-panels,
html[data-theme='dark'] .p-dialog.rules-dialog .p-tabview-panel,
html[data-theme='dark'] .p-dialog.rules-dialog .p-tabview-nav,
html[data-theme='dark'] .p-dialog.rules-dialog .p-tabview-nav-link,
html[data-theme='dark'] .p-dialog.rules-dialog .p-datatable,
html[data-theme='dark'] .p-dialog.rules-dialog .p-datatable-table,
html[data-theme='dark'] .p-dialog.rules-dialog .p-datatable-wrapper,
html[data-theme='dark'] .p-dialog.rules-dialog .p-datatable-table-container {
  background: #111827 !important;
  color: #e2e8f0 !important;
  border-color: #2b3850 !important;
}

html[data-theme='dark'] .p-dialog.rules-dialog .p-datatable-tbody > tr > td,
html[data-theme='dark'] .p-dialog.rules-dialog .builder-section,
html[data-theme='dark'] .p-dialog.rules-dialog .matrix-cell,
html[data-theme='dark'] .p-dialog.rules-dialog .preview-canvas,
html[data-theme='dark'] .p-dialog.rules-dialog .builder-index {
  background: #0f172a !important;
}

html[data-theme='dark'] .p-dialog.rules-dialog .card,
html[data-theme='dark'] .p-dialog.rules-dialog .builder-item,
html[data-theme='dark'] .p-dialog.rules-dialog .fields-list,
html[data-theme='dark'] .p-dialog.rules-dialog .field-editor-panel {
  background: #111827 !important;
  color: #e2e8f0 !important;
  border-color: #2b3850 !important;
}

html[data-theme='dark'] .p-dialog.rules-dialog .connection-types-details,
html[data-theme='dark'] .p-dialog.rules-dialog .matrix-actions,
html[data-theme='dark'] .p-dialog.rules-dialog .builtin-warning,
html[data-theme='dark'] .p-dialog.rules-dialog .svg-dropzone {
  background: #0f172a !important;
  border-color: #2b3850 !important;
  color: #e2e8f0 !important;
}

html[data-theme='dark'] .p-dialog.rules-dialog .rt-toast {
  background: #111827;
  color: #e2e8f0;
  border-color: #334155;
}

@media (max-width: 1400px) {
  .grid2 { grid-template-columns: 1fr; }
  .card { min-height: 42vh; }
  .editor-grid { grid-template-columns: 1fr; }
  .matrix-only-card { min-height: 70vh; }
  .connection-types-grid { grid-template-columns: 1fr; }
  .compact-grid.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ports-label-field { grid-column: 1 / -1; }
  .fields-layout { grid-template-columns: 1fr; min-height: 0; }
  .fields-list { max-height: 180px; }
}

@media (max-width: 1024px) {
  .compact-grid.two,
  .compact-grid.three { grid-template-columns: 1fr; }
}
</style>
