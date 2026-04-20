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
        <Button icon="pi pi-check" label="Apply To Diagram" :disabled="!selectedDiagramTypeId" @click="applySelectedType" />
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" :closable="false">{{ successMessage }}</Message>

    <TabView>
      <TabPanel header="Diagram Type">
        <div class="grid2">
          <section class="card">
            <h4>Create Type</h4>
            <div class="form">
              <label>Name</label>
              <InputText v-model="typeCreateForm.name" />
              <label>Key</label>
              <InputText v-model="typeCreateForm.key" />
              <label>Description</label>
              <InputText v-model="typeCreateForm.description" />
              <label>Free Mode</label>
              <InputSwitch v-model="typeCreateForm.is_free_mode" />
              <label>Clone From</label>
              <Dropdown
                v-model="typeCreateForm.cloneFromId"
                :options="diagramTypes"
                optionLabel="name"
                optionValue="id"
                showClear
                placeholder="Blank"
              />
            </div>
            <div class="actions">
              <Button label="Create Blank" icon="pi pi-plus" @click="createBlankType" />
              <Button label="Create Clone" icon="pi pi-copy" severity="secondary" :disabled="!typeCreateForm.cloneFromId" @click="createCloneType" />
            </div>
          </section>

          <section v-if="selectedType" class="card">
            <h4>Current Type</h4>
            <div class="form">
              <label>Name</label>
              <InputText v-model="typeEditForm.name" />
              <label>Key</label>
              <InputText v-model="typeEditForm.key" :disabled="selectedType.is_builtin" />
              <label>Description</label>
              <InputText v-model="typeEditForm.description" />
              <label>Free Mode</label>
              <InputSwitch v-model="typeEditForm.is_free_mode" />
            </div>
            <div class="actions">
              <Button label="Save" icon="pi pi-save" @click="updateType" />
              <Button v-if="!selectedType.is_builtin" label="Delete" icon="pi pi-trash" severity="danger" outlined @click="deleteType" />
            </div>
          </section>
        </div>
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
              <Column field="key" header="Key" />
              <Column field="shape" header="Shape" />
              <Column header="Ports">
                <template #body="{ data }">{{ asArray(data.ports).length }}</template>
              </Column>
            </DataTable>
          </section>

          <section class="card">
            <h4>Element Actions</h4>
            <div class="actions">
              <Button label="Create Element" icon="pi pi-plus" :disabled="!canMutate" @click="openCreateElementDialog" />
              <Button label="Edit Selected" icon="pi pi-pencil" severity="secondary" :disabled="!selectedElementType || !canMutate" @click="openEditElementDialog" />
              <Button label="Delete Selected" icon="pi pi-trash" severity="danger" outlined :disabled="!selectedElementType || selectedElementType?.is_builtin || !canMutate" @click="deleteElement" />
            </div>
            <div class="preview-block">
              <label>Quick Preview</label>
              <div class="preview-canvas">
                <div class="preview-element" :style="previewElementStyle">
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
        <div class="grid2">
          <section class="card">
            <DataTable
              :value="connectionTypes"
              dataKey="id"
              v-model:selection="selectedConnectionType"
              selectionMode="single"
              @rowSelect="fillConnectionForm"
              scrollable
              scrollHeight="28vh"
            >
              <Column field="name" header="Name" />
              <Column field="key" header="Key" />
              <Column field="directed" header="Directed" />
            </DataTable>

            <h4>{{ selectedConnectionType ? 'Edit Connection Type' : 'New Connection Type' }}</h4>
            <div class="form">
              <label>Name</label>
              <InputText v-model="connectionForm.name" />
              <label>Key</label>
              <InputText v-model="connectionForm.key" />
              <label>Color</label>
              <InputText v-model="connectionForm.color" />
              <label>Dash</label>
              <InputText v-model="connectionForm.dash" />
              <label>Arrow Start</label>
              <Dropdown v-model="connectionForm.arrow_start" :options="arrowOptions" optionLabel="label" optionValue="value" />
              <label>Arrow End</label>
              <Dropdown v-model="connectionForm.arrow_end" :options="arrowOptions" optionLabel="label" optionValue="value" />
              <label>Directed</label>
              <InputSwitch v-model="connectionForm.directed" />
            </div>
            <div class="actions">
              <Button label="Create" icon="pi pi-plus" :disabled="!canMutate" @click="createConnectionType" />
              <Button label="Save" icon="pi pi-save" severity="secondary" :disabled="!selectedConnectionType || !canMutate" @click="updateConnectionType" />
              <Button label="Delete" icon="pi pi-trash" severity="danger" outlined :disabled="!selectedConnectionType || selectedConnectionType?.is_builtin || !canMutate" @click="deleteConnectionType" />
            </div>
          </section>

          <section class="card">
            <div class="actions">
              <Button :label="matrixEditMode ? 'View' : 'Edit'" :icon="matrixEditMode ? 'pi pi-eye' : 'pi pi-pencil'" @click="matrixEditMode = !matrixEditMode" />
              <Dropdown v-model="bulkForm.mode" :options="bulkModes" optionLabel="label" optionValue="value" />
              <Dropdown v-model="bulkForm.target_id" :options="bulkTargets" optionLabel="label" optionValue="value" placeholder="Target" />
              <MultiSelect v-model="bulkForm.connection_type_ids" :options="connectionTypes" optionLabel="name" optionValue="id" display="chip" placeholder="All connection types" />
              <SelectButton v-model="bulkForm.allowed" :options="allowOptions" optionLabel="label" optionValue="value" />
              <Button label="Apply Bulk" icon="pi pi-bolt" :disabled="!bulkForm.target_id || !canMutate" @click="applyBulkRules" />
            </div>
            <DataTable :value="matrixRows" scrollable scrollHeight="52vh">
              <Column header="From \\ To" frozen>
                <template #body="{ data }">
                  <div>{{ data.fromElement.name }}</div>
                  <small class="muted">{{ data.fromElement.key }}</small>
                </template>
              </Column>
              <Column v-for="target in matrixElements" :key="target.id" :field="target.id" :header="target.name">
                <template #body="{ data }">
                  <div class="matrix-cell" :class="{ editable: matrixEditMode }" @click="matrixEditMode ? editCell(data.fromElement, target, data[target.id]) : null">
                    <div v-for="rule in data[target.id]" :key="rule.connection_type_id" class="rule-row">
                      <span class="rule-name">
                        <span class="rule-line" :style="ruleLineStyle(rule.connection_type_id)"></span>
                        <span>{{ connectionName(rule.connection_type_id) }} {{ arrowGlyph(rule.connection_type_id) }}</span>
                      </span>
                      <Tag :severity="rule.allowed ? 'success' : 'danger'" :value="rule.allowed ? 'allowed' : 'blocked'" />
                    </div>
                  </div>
                </template>
              </Column>
            </DataTable>
          </section>
        </div>
      </TabPanel>
    </TabView>

    <Dialog
      v-model:visible="elementEditor.visible"
      modal
      :draggable="false"
      :header="elementEditor.mode === 'edit' ? 'Edit Element' : 'Create Element'"
      :style="{ width: '98vw', maxWidth: '1880px' }"
      :contentStyle="{ maxHeight: '88vh' }"
      class="rules-dialog element-editor-dialog"
    >
      <div class="editor-grid">
        <section class="card editor-card">
          <h4>Basic Settings</h4>
          <div class="form">
            <label>Name</label>
            <InputText v-model="elementForm.name" />
            <label>Key</label>
            <InputText v-model="elementForm.key" />
            <label>Shape</label>
            <Dropdown v-model="elementForm.shape" :options="shapeOptions" optionLabel="label" optionValue="value" />
            <label>SVG Path</label>
            <Textarea v-model="elementForm.svg_path" rows="2" autoResize />
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
                <div class="compact-field">
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
                  <small class="field-chip-sub">{{ field.key || `field_${idx + 1}` }}</small>
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
                  <div class="compact-field">
                    <label>Key</label>
                    <InputText v-model="selectedField.key" placeholder="key_name" />
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

    <Dialog v-model:visible="cellEditor.visible" modal header="Edit Matrix Cell" :draggable="false" :style="{ width: '520px' }">
      <div class="muted">From {{ cellEditor.fromName }} to {{ cellEditor.toName }}</div>
      <div v-for="rule in cellEditor.rules" :key="rule.connection_type_id" class="rule-editor-row">
        <span>{{ connectionName(rule.connection_type_id) }}</span>
        <SelectButton v-model="rule.allowed" :options="allowOptions" optionLabel="label" optionValue="value" />
      </div>
      <template #footer>
        <Button label="Cancel" text @click="cellEditor.visible = false" />
        <Button label="Save" icon="pi pi-save" :disabled="!canMutate" @click="saveCellRules" />
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
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';
import InputNumber from 'primevue/inputnumber';
import ColorPicker from 'primevue/colorpicker';
import MultiSelect from 'primevue/multiselect';
import SelectButton from 'primevue/selectbutton';
import { diagramTypesService, rulesService } from '../services/index.js';
import { buildMatrixRows, matrixCellToPayload, normalizeRulesMatrix } from '../rules/connectionRules.js';

const BUILTIN_DIAGRAM_TYPE_IDS = {
  class: '00000000-0000-0000-0000-000000000101',
  use_case: '00000000-0000-0000-0000-000000000102',
  activity_diagram: '00000000-0000-0000-0000-000000000103',
  free_mode: '00000000-0000-0000-0000-000000000104',
};

const props = defineProps({ modelValue: Boolean, currentDiagramTypeId: { type: String, default: null } });
const emit = defineEmits(['update:modelValue', 'apply-diagram-type']);

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });
const diagramTypes = ref([]);
const selectedDiagramTypeId = ref(null);
const selectedType = ref(null);
const elementTypes = ref([]);
const connectionTypes = ref([]);
const matrix = ref(normalizeRulesMatrix(null));
const matrixEditMode = ref(false);
const selectedElementType = ref(null);
const selectedConnectionType = ref(null);
const errorMessage = ref('');
const successMessage = ref('');

const typeCreateForm = reactive({ name: '', key: '', description: '', is_free_mode: false, cloneFromId: null });
const typeEditForm = reactive({ name: '', key: '', description: '', is_free_mode: false });
const elementForm = reactive({
  name: '',
  key: '',
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
const previewDrag = reactive({
  active: false,
  fieldIndex: -1,
  startClientX: 0,
  startClientY: 0,
  startX: 0,
  startY: 0,
  rect: null,
});
const connectionForm = reactive({ name: '', key: '', color: '#34495e', dash: '', arrow_start: 'none', arrow_end: 'arrow', directed: true });
const elementEditor = reactive({ visible: false, mode: 'create' });
const bulkForm = reactive({ mode: 'row', target_id: null, connection_type_ids: [], allowed: true });
const cellEditor = reactive({ visible: false, fromId: null, toId: null, fromName: '', toName: '', rules: [] });

const shapeOptions = [{ label: 'Rect', value: 'rect' }, { label: 'RoundRect', value: 'roundrect' }, { label: 'Ellipse', value: 'ellipse' }, { label: 'Diamond', value: 'diamond' }, { label: 'Circle', value: 'circle' }, { label: 'Cylinder', value: 'cylinder' }, { label: 'Actor', value: 'actor' }, { label: 'Custom', value: 'custom' }];
const fieldTypeOptions = [{ label: 'Text', value: 'text' }, { label: 'Number', value: 'number' }, { label: 'Select', value: 'select' }, { label: 'Checkbox', value: 'checkbox' }];
const arrowOptions = [{ label: 'None', value: 'none' }, { label: 'Arrow', value: 'arrow' }, { label: 'Empty Arrow', value: 'empty_arrow' }, { label: 'Filled Diamond', value: 'filled_diamond' }, { label: 'Empty Diamond', value: 'empty_diamond' }];
const allowOptions = [{ label: 'Allowed', value: true }, { label: 'Blocked', value: false }];
const bulkModes = [{ label: 'By Row', value: 'row' }, { label: 'By Column', value: 'column' }, { label: 'By Connection Type', value: 'connection_type' }];

const matrixElements = computed(() => matrix.value.elements || []);
const matrixRows = computed(() => buildMatrixRows(matrix.value));
const canMutate = computed(() => Boolean(selectedType.value));
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
const fail = (msg) => { errorMessage.value = msg; successMessage.value = ''; };
const ok = (msg) => { successMessage.value = msg; errorMessage.value = ''; };
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const toOptionsCsv = (options) => asArray(options).join(', ');
const fromOptionsCsv = (csv) => String(csv || '').split(',').map((x) => x.trim()).filter(Boolean);
const makePort = () => ({ x: 0.5, y: 0.5, label: '' });
const makeField = (idx = 1) => ({
  type: 'text',
  label: `Field ${idx}`,
  key: `field_${idx}`,
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
  elementFields.value.map((field) => ({
    type: field.type || 'text',
    label: String(field.label || '').trim(),
    key: String(field.key || '').trim(),
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

const resetElementForm = () => {
  selectedElementType.value = null;
  Object.assign(elementForm, {
    name: '',
    key: '',
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
  Object.assign(connectionForm, { name: '', key: '', color: '#34495e', dash: '', arrow_start: 'none', arrow_end: 'arrow', directed: true });
};

const fillTypeEdit = () => {
  if (!selectedType.value) return;
  Object.assign(typeEditForm, { name: selectedType.value.name || '', key: selectedType.value.key || '', description: selectedType.value.description || '', is_free_mode: Boolean(selectedType.value.is_free_mode) });
};

const fillElementForm = ({ data }) => {
  selectedElementType.value = data;
  Object.assign(elementForm, {
    name: data.name || '',
    key: data.key || '',
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
  elementEditor.mode = 'create';
  resetElementForm();
  elementEditor.visible = true;
};

const openEditElementDialog = () => {
  if (!selectedElementType.value) return;
  elementEditor.mode = 'edit';
  fillElementForm({ data: selectedElementType.value });
  elementEditor.visible = true;
};

const fillConnectionForm = ({ data }) => {
  selectedConnectionType.value = data;
  Object.assign(connectionForm, { name: data.name || '', key: data.key || '', color: data.color || '#34495e', dash: data.dash || '', arrow_start: data.arrow_start || 'none', arrow_end: data.arrow_end || 'arrow', directed: Boolean(data.directed) });
};

const loadContext = async () => {
  const resolvedId = normalizeDiagramTypeId(selectedDiagramTypeId.value, selectedType.value?.key);
  if (!isUuid(resolvedId)) return;
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
    const currentId = normalizeDiagramTypeId(props.currentDiagramTypeId);
    if (isUuid(currentId) && diagramTypes.value.some((x) => x.id === currentId)) {
      selectedDiagramTypeId.value = currentId;
    } else if ((!isUuid(selectedDiagramTypeId.value)) && diagramTypes.value.length) {
      const firstUuid = diagramTypes.value.find((x) => isUuid(x.id));
      selectedDiagramTypeId.value = firstUuid?.id || diagramTypes.value[0].id;
    }
    await loadContext();
  } catch (e) {
    fail(e.message || 'Failed to load diagram types catalog');
  }
};

const onTypeChange = async () => { try { await loadContext(); } catch (e) { fail(e.message || 'Failed to load type'); } };

const createBlankType = async () => {
  if (!typeCreateForm.name.trim()) return fail('Name is required');
  try {
    const created = await diagramTypesService.create({ name: typeCreateForm.name.trim(), key: typeCreateForm.key?.trim() || null, description: typeCreateForm.description?.trim() || null, is_free_mode: Boolean(typeCreateForm.is_free_mode), metadata: { createdFrom: 'ui' } });
    selectedDiagramTypeId.value = created.id;
    await reloadCatalog();
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
    ok('Clone created');
  } catch (e) { fail(e.message || 'Failed to clone type'); }
};

const updateType = async () => {
  if (!selectedDiagramTypeId.value) return;
  try {
    selectedType.value = await diagramTypesService.update(selectedDiagramTypeId.value, { name: typeEditForm.name, key: typeEditForm.key, description: typeEditForm.description, is_free_mode: typeEditForm.is_free_mode });
    await reloadCatalog();
    ok('Type updated');
  } catch (e) { fail(e.message || 'Failed to update type'); }
};

const deleteType = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  try {
    await diagramTypesService.remove(selectedDiagramTypeId.value);
    selectedDiagramTypeId.value = null;
    await reloadCatalog();
    ok('Type deleted');
  } catch (e) { fail(e.message || 'Failed to delete type'); }
};

const createElement = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  if (!elementForm.name?.trim() || !elementForm.key?.trim()) return fail('Element name and key are required');
  try {
    await diagramTypesService.createElement(selectedDiagramTypeId.value, {
      key: elementForm.key,
      name: elementForm.name,
      shape: elementForm.shape,
      svg_path: elementForm.svg_path || null,
      default_style: { color: elementForm.color, border: elementForm.border },
      default_size: { width: elementForm.width, height: elementForm.height },
      ports: normalizePortsForApi(),
      field_schema: normalizeFieldsForApi(),
    });
    await loadContext();
    resetElementForm();
    ok('Element created');
  } catch (e) { fail(e.message || 'Failed to create element'); }
};

const updateElement = async () => {
  if (!selectedDiagramTypeId.value || !selectedElementType.value || !canMutate.value) return;
  if (!elementForm.name?.trim() || !elementForm.key?.trim()) return fail('Element name and key are required');
  try {
    await diagramTypesService.updateElement(selectedDiagramTypeId.value, selectedElementType.value.id, {
      key: elementForm.key,
      name: elementForm.name,
      shape: elementForm.shape,
      svg_path: elementForm.svg_path || null,
      default_style: { color: elementForm.color, border: elementForm.border },
      default_size: { width: elementForm.width, height: elementForm.height },
      ports: normalizePortsForApi(),
      field_schema: normalizeFieldsForApi(),
    });
    await loadContext();
    ok('Element updated');
  } catch (e) { fail(e.message || 'Failed to update element'); }
};

const deleteElement = async () => {
  if (!selectedDiagramTypeId.value || !selectedElementType.value || !canMutate.value) return;
  try {
    await diagramTypesService.deleteElement(selectedDiagramTypeId.value, selectedElementType.value.id);
    await loadContext();
    resetElementForm();
    ok('Element deleted');
  } catch (e) { fail(e.message || 'Failed to delete element'); }
};

const submitElementEditor = async () => {
  if (elementEditor.mode === 'edit') await updateElement();
  else await createElement();
  if (!errorMessage.value) elementEditor.visible = false;
};

const createConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !canMutate.value) return;
  try {
    await diagramTypesService.createConnectionType(selectedDiagramTypeId.value, { ...connectionForm });
    await loadContext();
    resetConnectionForm();
    ok('Connection type created');
  } catch (e) { fail(e.message || 'Failed to create connection type'); }
};

const updateConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !selectedConnectionType.value || !canMutate.value) return;
  try {
    await diagramTypesService.updateConnectionType(selectedDiagramTypeId.value, selectedConnectionType.value.id, { ...connectionForm });
    await loadContext();
    ok('Connection type updated');
  } catch (e) { fail(e.message || 'Failed to update connection type'); }
};

const deleteConnectionType = async () => {
  if (!selectedDiagramTypeId.value || !selectedConnectionType.value || !canMutate.value) return;
  try {
    await diagramTypesService.deleteConnectionType(selectedDiagramTypeId.value, selectedConnectionType.value.id);
    await loadContext();
    resetConnectionForm();
    ok('Connection type deleted');
  } catch (e) { fail(e.message || 'Failed to delete connection type'); }
};

const editCell = (fromEl, toEl, rules) => {
  cellEditor.visible = true;
  cellEditor.fromId = fromEl.id;
  cellEditor.toId = toEl.id;
  cellEditor.fromName = fromEl.name;
  cellEditor.toName = toEl.name;
  cellEditor.rules = asArray(rules).map((x) => ({ connection_type_id: x.connection_type_id, allowed: Boolean(x.allowed) }));
};

const saveCellRules = async () => {
  if (!selectedDiagramTypeId.value) return;
  try {
    await rulesService.updateCell(selectedDiagramTypeId.value, matrixCellToPayload({ fromElementTypeId: cellEditor.fromId, toElementTypeId: cellEditor.toId, rules: cellEditor.rules }));
    matrix.value = normalizeRulesMatrix(await rulesService.getMatrix(selectedDiagramTypeId.value));
    cellEditor.visible = false;
    ok('Cell updated');
  } catch (e) { fail(e.message || 'Failed to update cell'); }
};

const applyBulkRules = async () => {
  if (!selectedDiagramTypeId.value) return;
  try {
    await rulesService.bulkUpdate(selectedDiagramTypeId.value, { mode: bulkForm.mode, target_id: bulkForm.target_id, connection_type_ids: asArray(bulkForm.connection_type_ids), allowed: Boolean(bulkForm.allowed) });
    matrix.value = normalizeRulesMatrix(await rulesService.getMatrix(selectedDiagramTypeId.value));
    ok('Bulk update applied');
  } catch (e) { fail(e.message || 'Failed to apply bulk update'); }
};

const applySelectedType = () => {
  if (!selectedType.value) return;
  emit('apply-diagram-type', { type: selectedType.value, elements: elementTypes.value, connectionTypes: connectionTypes.value, rulesMatrix: matrix.value });
  ok('Type applied to diagram');
};

watch(() => visible.value, async (isOpen) => { if (isOpen) await reloadCatalog(); });
watch(() => elementEditor.visible, (isOpen) => {
  if (!isOpen) finishPreviewFieldDrag();
});
watch(() => props.currentDiagramTypeId, (id) => {
  const normalized = normalizeDiagramTypeId(id);
  if (isUuid(normalized)) {
    selectedDiagramTypeId.value = normalized;
  }
});
onBeforeUnmount(() => {
  finishPreviewFieldDrag();
});
</script>

<style>
.rules-dialog {
  --rt-surface: var(--app-panel, #ffffff);
  --rt-surface-soft: var(--app-panel-soft, #f8fafc);
  --rt-border: var(--app-border, #d1d5db);
  --rt-text: var(--app-text, #1f2937);
  --rt-muted: var(--app-muted, #64748b);
}

.top-bar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
.grid2 { display: grid; grid-template-columns: repeat(2, minmax(540px, 1fr)); gap: 1rem; align-items: start; }
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
.matrix-cell.editable { cursor: pointer; border-color: #7dd3fc; }
.rule-row { display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; }
.rule-name { display: inline-flex; align-items: center; gap: 0.35rem; }
.rule-line { flex: 0 0 auto; }
.rule-editor-row { border: 1px solid var(--rt-border); border-radius: 8px; padding: 0.5rem; margin-top: 0.5rem; display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; background: var(--rt-surface-soft); }

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
.editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
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
  max-height: 86vh;
  overflow: auto;
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

@media (max-width: 1400px) {
  .grid2 { grid-template-columns: 1fr; }
  .card { min-height: 42vh; }
  .editor-grid { grid-template-columns: 1fr; }
  .compact-grid.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fields-layout { grid-template-columns: 1fr; min-height: 0; }
  .fields-list { max-height: 180px; }
}

@media (max-width: 1024px) {
  .compact-grid.two,
  .compact-grid.three { grid-template-columns: 1fr; }
}
</style>
