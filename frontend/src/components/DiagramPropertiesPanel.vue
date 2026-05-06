<template>
  <aside class="panel" v-if="selectedElement || selectedConnection">
    <div class="header">
      <h3>{{ selectedElement ? 'Свойства элемента' : 'Свойства связи' }}</h3>
      <Button icon="pi pi-times" text rounded @click="deselectAll" />
    </div>

    <div class="content" v-if="selectedElement">
      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Атрибуты</label>
        <Textarea v-model="classAttributes" rows="4" autoResize :disabled="!canWrite" @update:modelValue="updateClassProperties" />
      </div>

      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Операции</label>
        <Textarea v-model="classOperations" rows="4" autoResize :disabled="!canWrite" @update:modelValue="updateClassProperties" />
      </div>

      <div class="field">
        <label>Текст</label>
        <InputText v-model="selectedElement.text" :disabled="!canWrite" />
      </div>

      <div class="field field-group" v-if="elementFieldSchema.length">
        <label>Поля элемента</label>
        <div class="custom-fields">
          <div class="custom-field-item" v-for="(field, idx) in elementFieldSchema" :key="`field-editor-${idx}-${field.key || 'no_key'}`">
            <small class="custom-field-label">{{ field.label || field.key || `field_${idx + 1}` }}</small>

            <InputText
              v-if="resolveFieldType(field) === 'text'"
              :modelValue="getFieldValue(field)"
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, $event)"
            />

            <InputNumber
              v-else-if="resolveFieldType(field) === 'number'"
              :modelValue="toNumberValue(getFieldValue(field))"
              :useGrouping="false"
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, $event)"
            />

            <Dropdown
              v-else-if="resolveFieldType(field) === 'select'"
              :modelValue="getFieldValue(field)"
              :options="getSelectOptions(field)"
              optionLabel="label"
              optionValue="value"
              placeholder="Выберите значение"
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, $event)"
            />

            <div v-else-if="resolveFieldType(field) === 'checkbox'" class="row checkbox-row">
              <InputSwitch
                :modelValue="Boolean(getFieldValue(field))"
                :disabled="!canWrite"
                @update:modelValue="setFieldValue(field, $event)"
              />
              <span class="checkbox-value">{{ Boolean(getFieldValue(field)) ? 'Да' : 'Нет' }}</span>
            </div>

            <InputText
              v-else
              :modelValue="getFieldValue(field)"
              :disabled="!canWrite"
              @update:modelValue="setFieldValue(field, $event)"
            />
          </div>
        </div>
      </div>

      <div class="field">
        <label>Размер шрифта</label>
        <div class="row slider-row">
          <div class="slider-wrap">
          <Slider v-model="selectedElement.fontSize" :min="10" :max="30" :disabled="!canWrite" />
          </div>
          <Tag :value="`${selectedElement.fontSize || 14}px`" />
        </div>
      </div>

      <div class="field">
        <label>Цвет фона</label>
        <ColorPicker
          :modelValue="selectedElement.customColor || getElementPreset(selectedElement.type)?.color || '#95a5a6'"
          :disabled="!canWrite"
          @update:modelValue="selectedElement.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Цвет границы</label>
        <ColorPicker
          :modelValue="selectedElement.customBorder || getElementPreset(selectedElement.type)?.border || '#2c3e50'"
          :disabled="!canWrite"
          @update:modelValue="selectedElement.customBorder = toHexColor($event)"
        />
      </div>

      <Tag severity="info" :value="`Тип: ${getElementDisplayType(selectedElement)}`" />
    </div>

    <div class="content" v-else-if="selectedConnection">
      <div class="field">
        <label>Надпись</label>
        <InputText v-model="selectedConnection.label" :disabled="!canWrite" />
      </div>

      <div class="field">
        <label>Цвет надписи</label>
        <ColorPicker
          :modelValue="selectedConnection.labelColor || '#2c3e50'"
          :disabled="!canWrite"
          @update:modelValue="selectedConnection.labelColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Размер надписи</label>
        <div class="row slider-row">
          <div class="slider-wrap">
            <Slider v-model="selectedConnection.labelFontSize" :min="8" :max="24" :disabled="!canWrite" />
          </div>
          <Tag :value="`${selectedConnection.labelFontSize || 12}px`" />
        </div>
      </div>

      <div class="field">
        <label>Цвет линии</label>
        <ColorPicker
          :modelValue="selectedConnection.customColor || '#34495e'"
          :disabled="!canWrite"
          @update:modelValue="selectedConnection.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Стиль линии</label>
        <Dropdown v-model="selectedConnection.customDash" :options="dashOptions" optionLabel="label" optionValue="value" :disabled="!canWrite" />
      </div>

      <div class="actions">
        <Button icon="pi pi-plus" label="Точка изгиба" size="small" outlined :disabled="!canWrite" @click="addSelectedBendPoint()" />
        <Button
          icon="pi pi-minus-circle"
          label="Удалить точку"
          size="small"
          outlined
          :disabled="!canWrite || !selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
        />
        <Button
          icon="pi pi-trash"
          label="Удалить все точки"
          size="small"
          outlined
          :disabled="!canWrite || !selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedConnection && clearBendPoints(selectedConnection)"
        />
        <Button icon="pi pi-times" label="Удалить связь" size="small" severity="danger" :disabled="!canWrite" @click="deleteConnection(selectedConnection)" />
      </div>

      <Tag :severity="selectedConnection.rule_violation ? 'warning' : 'info'" :value="selectedConnection.rule_violation ? 'Нарушение правила' : `Тип: ${toReadableType(selectedConnection.type)}`" />
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
import InputNumber from 'primevue/inputnumber';
import InputSwitch from 'primevue/inputswitch';

export default {
  name: 'DiagramPropertiesPanel',
  components: { Button, InputText, Slider, Tag, Dropdown, Textarea, ColorPicker, InputNumber, InputSwitch },
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
        { label: 'Сплошная', value: '' },
        { label: 'Пунктир', value: '6 4' },
        { label: 'Длинный пунктир', value: '10 6' },
        { label: 'Точки', value: '3 3' },
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
    toHexColor(value) {
      if (typeof value !== 'string') return '#000000';
      return value.startsWith('#') ? value : `#${value}`;
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
      const t = String(field?.type || 'text').toLowerCase();
      return ['text', 'number', 'select', 'checkbox'].includes(t) ? t : 'text';
    },
    resolveFieldDefault(field) {
      const type = this.resolveFieldType(field);
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
      if (type === 'number') {
        const normalized = value === null || value === undefined || value === '' ? null : Number(value);
        this.selectedElement.properties[key] = Number.isFinite(normalized) ? normalized : null;
        return;
      }
      if (type === 'checkbox') {
        this.selectedElement.properties[key] = Boolean(value);
        return;
      }
      this.selectedElement.properties[key] = value ?? '';
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
