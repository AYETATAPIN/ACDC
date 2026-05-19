<template>
  <aside class="panel" v-if="selectedElement || selectedConnection">
    <div class="header">
      <h3>{{ selectedElement ? 'Element Properties' : 'Connection Properties' }}</h3>
      <Button icon="pi pi-times" text rounded @click="deselectAll" />
    </div>

    <div class="content" v-if="selectedElement">
      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Attributes</label>
        <Textarea v-model="classAttributes" rows="4" autoResize :disabled="!canWrite" @update:modelValue="updateClassProperties" />
      </div>

      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Methods</label>
        <Textarea v-model="classOperations" rows="4" autoResize :disabled="!canWrite" @update:modelValue="updateClassProperties" />
      </div>

      <div class="field">
        <label>Title</label>
        <InputText v-model="selectedElement.text" :disabled="!canWrite" />
      </div>

      <div class="field field-group" v-if="elementFieldSchema.length">
        <label>Element Fields</label>
        <div class="custom-fields">
          <div class="custom-field-item" v-for="(field, idx) in elementFieldSchema" :key="`field-editor-${idx}-${field.key || 'no_key'}`">
            <small class="custom-field-label">{{ field.label || field.key || `field_${idx + 1}` }}</small>

            <Textarea
              v-if="resolveFieldType(field) === 'list'"
              :modelValue="listValueToText(getFieldValue(field))"
              rows="4"
              autoResize
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, listTextToValue($event))"
            />

            <InputText
              v-else-if="resolveFieldType(field) === 'input'"
              :modelValue="getFieldValue(field)"
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, $event)"
            />

            <div v-else class="label-preview">{{ String(field?.label || field?.key || '').trim() || 'Label' }}</div>

            <div class="custom-field-color">
              <small>Text color</small>
              <div class="color-inline">
                <ColorPicker
                  format="hex"
                  :modelValue="toPickerColor(getFieldTextColor(field))"
                  :disabled="!canWrite"
                  @update:modelValue="setFieldTextColor(field, toHexColor($event))"
                />
                <InputText
                  :modelValue="getFieldTextColor(field)"
                  :disabled="!canWrite"
                  placeholder="#ffffff"
                  @update:modelValue="setFieldTextColor(field, $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="field">
        <label>Title Text Size</label>
        <div class="row slider-row">
          <div class="slider-wrap">
          <Slider v-model="selectedElement.fontSize" :min="10" :max="30" :disabled="!canWrite" />
          </div>
          <Tag :value="`${selectedElement.fontSize || 14}px`" />
        </div>
      </div>

      <div class="field">
        <label>Inner Text Size</label>
        <div class="row slider-row">
          <div class="slider-wrap">
            <Slider :modelValue="getInnerTextSize()" :min="8" :max="28" :disabled="!canWrite" @update:modelValue="setInnerTextSize" />
          </div>
          <Tag :value="`${getInnerTextSize()}px`" />
        </div>
      </div>

      <div class="field">
        <label>Fill Color</label>
        <ColorPicker
          :modelValue="toPickerColor(selectedElement.customColor || getElementPreset(selectedElement.type)?.color || '#95a5a6')"
          :disabled="!canWrite"
          @update:modelValue="selectedElement.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Border Color</label>
        <ColorPicker
          :modelValue="toPickerColor(selectedElement.customBorder || getElementPreset(selectedElement.type)?.border || '#2c3e50')"
          :disabled="!canWrite"
          @update:modelValue="selectedElement.customBorder = toHexColor($event)"
        />
      </div>

      <Tag severity="info" :value="`Type: ${getElementDisplayType(selectedElement)}`" />
    </div>

    <div class="content" v-else-if="selectedConnection">
      <div class="field">
        <label>Label</label>
        <InputText v-model="selectedConnection.label" :disabled="!canWrite" />
      </div>

      <div class="field">
        <label>Label Color</label>
        <ColorPicker
          :modelValue="toPickerColor(selectedConnection.labelColor || '#2c3e50')"
          :disabled="!canWrite"
          @update:modelValue="selectedConnection.labelColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Label Size</label>
        <div class="row slider-row">
          <div class="slider-wrap">
            <Slider v-model="selectedConnection.labelFontSize" :min="8" :max="24" :disabled="!canWrite" />
          </div>
          <Tag :value="`${selectedConnection.labelFontSize || 12}px`" />
        </div>
      </div>

      <div class="field">
        <label>Line Color</label>
        <ColorPicker
          :modelValue="toPickerColor(selectedConnection.customColor || '#34495e')"
          :disabled="!canWrite"
          @update:modelValue="selectedConnection.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Line Style</label>
        <Dropdown v-model="selectedConnection.customDash" :options="dashOptions" optionLabel="label" optionValue="value" :disabled="!canWrite" />
      </div>

      <div class="actions">
        <Button icon="pi pi-plus" label="Add Bend Point" size="small" outlined :disabled="!canWrite" @click="addSelectedBendPoint()" />
        <Button
          icon="pi pi-minus-circle"
          label="Remove Point"
          size="small"
          outlined
          :disabled="!canWrite || !selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
        />
        <Button
          icon="pi pi-trash"
          label="Remove All Points"
          size="small"
          outlined
          :disabled="!canWrite || !selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedConnection && clearBendPoints(selectedConnection)"
        />
        <Button icon="pi pi-times" label="Delete Connection" size="small" severity="danger" :disabled="!canWrite" @click="deleteConnection(selectedConnection)" />
      </div>

      <Tag :severity="selectedConnection.rule_violation ? 'warning' : 'info'" :value="selectedConnection.rule_violation ? 'Rule Violation' : `Type: ${toReadableType(selectedConnection.type)}`" />
    </div>
  </aside>
</template>

<script>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import Tag from 'primevue/tag';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import ColorPicker from 'primevue/colorpicker';

export default {
  name: 'DiagramPropertiesPanel',
  components: { Button, InputText, Slider, Tag, Dropdown, Textarea, ColorPicker },
  props: {
    selectedElement: { type: Object, default: null },
    selectedConnection: { type: Object, default: null },
    selectedBendPoint: { type: Object, default: null },
    getElementPreset: { type: Function, required: true },
    deselectAll: { type: Function, required: true },
    addSelectedBendPoint: { type: Function, required: true },
    deleteConnection: { type: Function, required: true },
    addBendPointAtMidpoint: { type: Function, required: true },
    hasBendPoints: { type: Function, required: true },
    clearBendPoints: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true },
    canWrite: { type: Boolean, default: true },
  },
  data() {
    return {
      classAttributes: '',
      classOperations: '',
      dashOptions: [
        { label: 'Solid', value: '' },
        { label: 'Dashed', value: '6 4' },
        { label: 'Long Dashed', value: '10 6' },
        { label: 'Dotted', value: '3 3' },
      ],
    };
  },
  computed: {
    elementFieldSchema() {
      const preset = this.selectedElement ? this.getElementPreset(this.selectedElement.type) : null;
      const schema = preset?.field_schema;
      if (!Array.isArray(schema)) return [];
      return schema.filter((field) => field && typeof field.key === 'string' && field.key.trim() !== '');
    },
  },
  watch: {
    selectedElement: {
      immediate: true,
      handler(newElement) {
        if (newElement?.type === 'class') {
          this.classAttributes = (newElement.properties?.attributes || []).join('\n');
          this.classOperations = (newElement.properties?.operations || []).join('\n');
        }
        this.syncFieldDefaults(newElement);
      },
    },
  },
  methods: {
    normalizeHexColor(value, fallback = '#000000') {
      const source = String(value || '').trim().replace(/^#/, '');
      if (/^[0-9a-fA-F]{6}$/.test(source)) return `#${source.toLowerCase()}`;
      if (/^[0-9a-fA-F]{3}$/.test(source)) {
        const expanded = source.split('').map((ch) => `${ch}${ch}`).join('');
        return `#${expanded.toLowerCase()}`;
      }
      return fallback;
    },
    toHexColor(value) {
      return this.normalizeHexColor(value, '#000000');
    },
    toPickerColor(value) {
      return this.normalizeHexColor(value, '#ffffff').slice(1);
    },
    updateClassProperties() {
      if (!this.canWrite) return;
      if (this.selectedElement?.type !== 'class') return;
      this.selectedElement.properties = {
        ...this.selectedElement.properties,
        attributes: this.classAttributes.split('\n').filter((line) => line.trim() !== ''),
        operations: this.classOperations.split('\n').filter((line) => line.trim() !== ''),
      };
    },
    resolveFieldType(field) {
      const t = String(field?.type || 'input').toLowerCase();
      if (['text', 'number', 'select', 'checkbox'].includes(t)) return 'input';
      return ['input', 'label', 'list'].includes(t) ? t : 'input';
    },
    normalizeListValue(value) {
      if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
      if (typeof value === 'string') return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return [];
    },
    listValueToText(value) {
      return this.normalizeListValue(value).join('\n');
    },
    listTextToValue(value) {
      return this.normalizeListValue(value);
    },
    resolveFieldDefault(field) {
      const type = this.resolveFieldType(field);
      if (type === 'list') return this.normalizeListValue(field?.default);
      if (type === 'checkbox') return Boolean(field?.default);
      if (type === 'number') {
        const n = Number(field?.default);
        return Number.isFinite(n) ? n : null;
      }
      if (field?.default === undefined || field?.default === null) return '';
      return String(field.default);
    },
    ensureElementProperties() {
      if (!this.selectedElement) return;
      if (!this.selectedElement.properties || typeof this.selectedElement.properties !== 'object') {
        this.selectedElement.properties = {};
      }
    },
    getInnerTextSize() {
      const fromProps = Number(this.selectedElement?.properties?.fieldFontSize);
      if (Number.isFinite(fromProps) && fromProps >= 8 && fromProps <= 28) return Math.round(fromProps);
      return 11;
    },
    setInnerTextSize(value) {
      if (!this.canWrite) return;
      this.ensureElementProperties();
      if (!this.selectedElement) return;
      const numeric = Number(value);
      const clamped = Math.max(8, Math.min(28, Number.isFinite(numeric) ? numeric : 11));
      this.selectedElement.properties = {
        ...this.selectedElement.properties,
        fieldFontSize: clamped,
      };
    },
    ensureFieldColorMap() {
      this.ensureElementProperties();
      if (!this.selectedElement) return {};
      if (!this.selectedElement.properties.__field_colors || typeof this.selectedElement.properties.__field_colors !== 'object') {
        this.selectedElement.properties.__field_colors = {};
      }
      return this.selectedElement.properties.__field_colors;
    },
    syncFieldDefaults(element = this.selectedElement) {
      if (!element) return;
      if (!element.properties || typeof element.properties !== 'object') {
        element.properties = {};
      }
      for (const field of this.elementFieldSchema) {
        const key = String(field?.key || '').trim();
        if (!key) continue;
        if (element.properties[key] === undefined) {
          element.properties[key] = this.resolveFieldDefault(field);
        }
      }
    },
    getFieldValue(field) {
      this.ensureElementProperties();
      const key = String(field?.key || '').trim();
      if (!key || !this.selectedElement) return this.resolveFieldDefault(field);
      if (this.selectedElement.properties[key] === undefined) {
        this.selectedElement.properties[key] = this.resolveFieldDefault(field);
      }
      return this.selectedElement.properties[key];
    },
    setFieldValue(field, value) {
      if (!this.canWrite) return;
      this.ensureElementProperties();
      const key = String(field?.key || '').trim();
      if (!key || !this.selectedElement) return;
      const type = this.resolveFieldType(field);
      if (type === 'label') {
        this.selectedElement.properties[key] = this.selectedElement.properties[key] ?? '';
        return;
      }
      if (type === 'list') {
        this.selectedElement.properties[key] = this.normalizeListValue(value);
        return;
      }
      this.selectedElement.properties[key] = value ?? '';
    },
    getFieldTextColor(field) {
      const key = String(field?.key || '').trim();
      const fallback = this.normalizeHexColor(field?.textColor, '#ffffff');
      if (!key || !this.selectedElement) return fallback;
      const colorMap = this.ensureFieldColorMap();
      const direct = this.normalizeHexColor(colorMap[key], '');
      return direct || fallback;
    },
    setFieldTextColor(field, value) {
      if (!this.canWrite) return;
      const key = String(field?.key || '').trim();
      if (!key || !this.selectedElement) return;
      const colorMap = this.ensureFieldColorMap();
      colorMap[key] = this.normalizeHexColor(value, this.getFieldTextColor(field));
      this.selectedElement.properties = {
        ...this.selectedElement.properties,
        __field_colors: {
          ...colorMap,
        },
      };
    },
    getSelectOptions(field) {
      const raw = Array.isArray(field?.options) ? field.options : [];
      return raw
        .map((opt) => {
          if (typeof opt === 'string') return { label: opt, value: opt };
          if (opt && typeof opt === 'object') {
            const value = opt.value ?? opt.label;
            const label = opt.label ?? opt.value;
            return { label: String(label ?? ''), value: value ?? '' };
          }
          return { label: String(opt ?? ''), value: String(opt ?? '') };
        })
        .filter((opt) => String(opt.value ?? '').trim() !== '');
    },
    toNumberValue(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    },
    toReadableType(value) {
      const raw = String(value || '').trim();
      if (!raw) return 'Element';
      return raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    },
    getElementDisplayType(element) {
      const preset = this.getElementPreset(element?.type);
      if (preset?.label && String(preset.label).trim()) return String(preset.label).trim();
      return this.toReadableType(element?.type);
    },
  },
};
</script>

<style scoped>
.panel {
  width: 320px;
  min-width: 300px;
  border-left: 1px solid var(--app-border, #dbe7ef);
  background: var(--app-sidebar-bg, var(--app-panel-soft, #f8fbff));
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--app-accent, #14b8a6);
  border-radius: 10px;
  padding: 0.45rem 0.55rem;
}

.header h3 {
  margin: 0;
  color: #ffffff;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field label {
  font-size: 0.8rem;
  color: var(--app-muted, #334155);
  font-weight: 600;
}

.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.slider-row {
  min-width: 0;
}

.slider-wrap {
  flex: 1 1 auto;
  min-width: 140px;
  display: flex;
  align-items: center;
}

.slider-wrap :deep(.p-slider) {
  width: 100%;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.field-group {
  gap: 0.45rem;
}

.custom-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.custom-field-item {
  padding: 0.45rem;
  border-radius: 8px;
  border: 1px solid var(--app-border, #dbe7ef);
  background: var(--app-panel-soft, #f8fbff);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.custom-field-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--app-muted, #334155);
}

.label-preview {
  font-size: 0.82rem;
  color: var(--app-text, #1f2937);
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px dashed var(--app-border, #dbe7ef);
  background: var(--app-panel, #ffffff);
}

.custom-field-color {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.custom-field-color small {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--app-muted, #334155);
}

.color-inline {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.4rem;
  align-items: center;
}

.checkbox-row {
  justify-content: space-between;
}

.checkbox-value {
  font-size: 0.8rem;
  color: var(--app-muted, #334155);
}

.panel :deep(.p-inputtext),
.panel :deep(.p-inputnumber-input),
.panel :deep(.p-dropdown),
.panel :deep(.p-textarea) {
  background: var(--app-panel, #ffffff);
  border-color: var(--app-border, #dbe7ef);
  color: var(--app-text, #1f2937);
}

.panel :deep(.p-tag) {
  border: 1px solid var(--app-border, #dbe7ef);
}
</style>
