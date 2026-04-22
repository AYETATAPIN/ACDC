<template>
  <header class="header-shell">
    <div class="header-main">
      <div class="row">
        <div class="field">
          <label>Название</label>
          <InputText :modelValue="diagramName" placeholder="Название диаграммы" @update:modelValue="setDiagramName" />
        </div>
        <div class="field">
          <label>Тип</label>
          <Dropdown
            :modelValue="diagramType"
            :options="typeOptions"
            optionLabel="label"
            optionValue="value"
            @update:modelValue="setDiagramType"
          />
        </div>
        <div class="field">
          <label>Масштаб</label>
          <div class="zoom-controls">
            <Button icon="pi pi-search-minus" text @click="adjustZoom(-0.1)" />
            <span>{{ Math.round(zoom * 100) }}%</span>
            <Button icon="pi pi-search-plus" text @click="adjustZoom(0.1)" />
          </div>
        </div>
      </div>

      <div class="row actions">
        <Button :label="snapToGrid ? 'Сетка: вкл' : 'Сетка: выкл'" :severity="snapToGrid ? 'success' : 'secondary'" outlined @click="toggleGrid" />
        <Button icon="pi pi-save" :label="hasUnsavedChanges ? 'Сохранить *' : 'Сохранить'" :severity="hasUnsavedChanges ? 'warning' : 'primary'" @click="saveDiagram" />
        <Button icon="pi pi-plus" label="Новая" outlined @click="newDiagram" />
        <Button icon="pi pi-undo" label="Undo" outlined :disabled="!canUndo" @click="undoDiagram" />
        <Button icon="pi pi-redo" label="Redo" outlined :disabled="!canRedo" @click="redoDiagram" />
        <Button :icon="isDarkTheme ? 'pi pi-sun' : 'pi pi-moon'" :label="isDarkTheme ? 'Светлая тема' : 'Темная тема'" outlined @click="toggleTheme" />
        <Button icon="pi pi-sitemap" label="Правила и типы" severity="help" outlined @click="openRulesDialog" />
        <div v-if="authUser" class="auth-chip">
          <span>{{ authUser.display_name || authUser.email }}</span>
          <Button icon="pi pi-sign-out" label="Выйти" severity="secondary" text @click="logout" />
        </div>
      </div>

      <div class="row">
        <div class="field long">
          <label>Сохраненные диаграммы</label>
          <Dropdown
            :modelValue="selectedDiagramId"
            :options="diagramOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выбрать диаграмму..."
            @update:modelValue="onDiagramSelect"
          />
        </div>
        <Button icon="pi pi-refresh" outlined :loading="isLoadingList" @click="loadDiagramsList" />
        <Button
          v-if="isBendEditMode"
          icon="pi pi-minus-circle"
          label="Удалить точку изгиба"
          outlined
          :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
          @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
        />
      </div>
    </div>
  </header>
</template>

<script>
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';

export default {
  name: 'DiagramHeader',
  components: { InputText, Dropdown, Button },
  props: {
    diagramName: { type: String, required: true },
    diagramType: { type: String, required: true },
    snapToGrid: { type: Boolean, required: true },
    hasUnsavedChanges: { type: Boolean, required: true },
    canUndo: { type: Boolean, required: true },
    canRedo: { type: Boolean, required: true },
    isDarkTheme: { type: Boolean, required: true },
    isBendEditMode: { type: Boolean, required: true },
    currentDiagramId: { type: String, default: null },
    selectedDiagramId: { type: String, default: null },
    diagrams: { type: Array, default: () => [] },
    isLoadingList: { type: Boolean, required: true },
    zoom: { type: Number, required: true },
    authUser: { type: Object, default: null },
    selectedConnection: { type: Object, default: null },
    selectedBendPoint: { type: Object, default: null },
    hasBendPoints: { type: Function, required: true },
    setDiagramName: { type: Function, required: true },
    setDiagramType: { type: Function, required: true },
    setSelectedDiagramId: { type: Function, required: true },
    toggleGrid: { type: Function, required: true },
    saveDiagram: { type: Function, required: true },
    newDiagram: { type: Function, required: true },
    undoDiagram: { type: Function, required: true },
    redoDiagram: { type: Function, required: true },
    loadDiagram: { type: Function, required: true },
    loadDiagramsList: { type: Function, required: true },
    adjustZoom: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true },
    openRulesDialog: { type: Function, required: true },
    toggleTheme: { type: Function, required: true },
    logout: { type: Function, required: true },
  },
  computed: {
    typeOptions() {
      return [
        { label: 'Class', value: 'class' },
        { label: 'Use Case', value: 'use_case' },
        { label: 'Activity', value: 'activity_diagram' },
        { label: 'Free Mode', value: 'free_mode' },
      ];
    },
    diagramOptions() {
      return this.diagrams.map((d) => ({ value: d.id, label: `${d.name} (${d.type})` }));
    },
  },
  methods: {
    onDiagramSelect(value) {
      this.setSelectedDiagramId(value || null);
      if (value) {
        this.loadDiagram(value);
      }
    },
  },
};
</script>

<style scoped>
.header-shell {
  border-bottom: 1px solid var(--app-border, #dbe7ef);
  background: linear-gradient(120deg, var(--app-bg-0, #f3f9fa) 0%, var(--app-bg-1, #eef6fb) 65%, var(--app-bg-2, #fff6ec) 100%);
  padding: 0.9rem;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  align-items: flex-end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 190px;
}

.field.long {
  flex: 1;
  min-width: 320px;
}

.field label {
  font-size: 0.75rem;
  color: var(--app-muted, #334155);
  font-weight: 600;
}

.zoom-controls {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--app-border, #d2dbe6);
  border-radius: 8px;
  padding: 0.1rem 0.25rem;
  background: var(--app-panel, #ffffff);
  gap: 0.2rem;
}

.zoom-controls span {
  min-width: 56px;
  text-align: center;
  font-weight: 600;
  color: var(--app-text, #0f172a);
}

.actions {
  align-items: center;
}

.auth-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  padding: 0.25rem 0.35rem 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--app-border, #d2dbe6);
  color: var(--app-text, #0f172a);
  font-size: 0.86rem;
  font-weight: 600;
}
</style>
