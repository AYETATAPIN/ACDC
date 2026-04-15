<template>
  <aside class="panel" v-if="selectedElement || selectedConnection">
    <div class="header">
      <h3>{{ selectedElement ? 'Свойства элемента' : 'Свойства связи' }}</h3>
      <Button icon="pi pi-times" text rounded @click="deselectAll" />
    </div>

    <div class="content" v-if="selectedElement">
      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Атрибуты</label>
        <Textarea v-model="classAttributes" rows="4" autoResize @update:modelValue="updateClassProperties" />
      </div>

      <div class="field" v-if="selectedElement.type === 'class'">
        <label>Операции</label>
        <Textarea v-model="classOperations" rows="4" autoResize @update:modelValue="updateClassProperties" />
      </div>

      <div class="field">
        <label>Текст</label>
        <InputText v-model="selectedElement.text" />
      </div>

      <div class="field">
        <label>Размер шрифта</label>
        <div class="row slider-row">
          <div class="slider-wrap">
            <Slider v-model="selectedElement.fontSize" :min="10" :max="30" />
          </div>
          <Tag :value="`${selectedElement.fontSize || 14}px`" />
        </div>
      </div>

      <div class="field">
        <label>Цвет фона</label>
        <ColorPicker
          :modelValue="selectedElement.customColor || getElementPreset(selectedElement.type)?.color || '#95a5a6'"
          @update:modelValue="selectedElement.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Цвет границы</label>
        <ColorPicker
          :modelValue="selectedElement.customBorder || getElementPreset(selectedElement.type)?.border || '#2c3e50'"
          @update:modelValue="selectedElement.customBorder = toHexColor($event)"
        />
      </div>

      <Tag severity="info" :value="`Тип: ${selectedElement.type}`" />
    </div>

    <div class="content" v-else-if="selectedConnection">
      <div class="field">
        <label>Надпись</label>
        <InputText v-model="selectedConnection.label" />
      </div>

      <div class="field">
        <label>Цвет надписи</label>
        <ColorPicker
          :modelValue="selectedConnection.labelColor || '#2c3e50'"
          @update:modelValue="selectedConnection.labelColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Размер надписи</label>
        <div class="row slider-row">
          <div class="slider-wrap">
            <Slider v-model="selectedConnection.labelFontSize" :min="8" :max="24" />
          </div>
          <Tag :value="`${selectedConnection.labelFontSize || 12}px`" />
        </div>
      </div>

      <div class="field">
        <label>Цвет линии</label>
        <ColorPicker
          :modelValue="selectedConnection.customColor || '#34495e'"
          @update:modelValue="selectedConnection.customColor = toHexColor($event)"
        />
      </div>

      <div class="field">
        <label>Стиль линии</label>
        <Dropdown v-model="selectedConnection.customDash" :options="dashOptions" optionLabel="label" optionValue="value" />
      </div>

      <div class="actions">
        <Button icon="pi pi-plus" label="Точка изгиба" size="small" outlined @click="selectedConnection && addBendPointAtMidpoint(selectedConnection)" />
        <Button
          icon="pi pi-minus-circle"
          label="Удалить точку"
          size="small"
          outlined
          :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
        />
        <Button
          icon="pi pi-trash"
          label="Удалить все точки"
          size="small"
          outlined
          :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedConnection && clearBendPoints(selectedConnection)"
        />
        <Button icon="pi pi-times" label="Удалить связь" size="small" severity="danger" @click="deleteConnection(selectedConnection)" />
      </div>

      <Tag :severity="selectedConnection.rule_violation ? 'warning' : 'info'" :value="selectedConnection.rule_violation ? 'Нарушение правила' : `Тип: ${selectedConnection.type}`" />
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
    deleteConnection: { type: Function, required: true },
    addBendPointAtMidpoint: { type: Function, required: true },
    hasBendPoints: { type: Function, required: true },
    clearBendPoints: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true },
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
  watch: {
    selectedElement: {
      immediate: true,
      handler(newElement) {
        if (newElement?.type === 'class') {
          this.classAttributes = (newElement.properties?.attributes || []).join('\n');
          this.classOperations = (newElement.properties?.operations || []).join('\n');
        }
      },
    },
  },
  methods: {
    toHexColor(value) {
      if (typeof value !== 'string') return '#000000';
      return value.startsWith('#') ? value : `#${value}`;
    },
    updateClassProperties() {
      if (this.selectedElement?.type !== 'class') return;
      this.selectedElement.properties = {
        ...this.selectedElement.properties,
        attributes: this.classAttributes.split('\n').filter((line) => line.trim() !== ''),
        operations: this.classOperations.split('\n').filter((line) => line.trim() !== ''),
      };
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
