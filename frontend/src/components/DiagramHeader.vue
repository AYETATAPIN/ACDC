<template>
  <header class="header">
    <div class="logo-placeholder"></div>
    <div class="controls">
      <input :value="diagramName" placeholder="Diagram name" @input="setDiagramName($event.target.value)">
      <select :value="diagramType" @change="setDiagramType($event.target.value)">
        <option value="class">Class</option>
        <option value="use_case">Use Case</option>
        <option value="activity_diagram">Activity Diagram</option>
        <option value="free_mode">Free Mode</option>
      </select>
      <button
        @click="toggleGrid"
        :class="{ active: snapToGrid }"
        :title="snapToGrid ? 'Привязка к сетке: ВКЛ' : 'Привязка к сетке: ВЫКЛ'"
      >
        {{ snapToGrid ? '📐 Сетка: ВКЛ' : '📏 Сетка: ВЫКЛ' }}
      </button>
      <button @click="saveDiagram" :class="{ 'has-changes': hasUnsavedChanges }">
        {{ hasUnsavedChanges ? '💾 Save*' : '💾 Save' }}
      </button>
      <button @click="newDiagram">New</button>
      <button :disabled="!canUndo" @click="undoDiagram">Undo</button>
      <button :disabled="!canRedo" @click="redoDiagram">Redo</button>
      <select :value="selectedDiagramId" @change="handleDiagramSelect" class="diagram-select">
        <option value="" disabled>Выбрать диаграмму...</option>
        <option v-for="d in diagrams" :key="d.id" :value="d.id">
          {{ d.name }} ({{ d.type }})
        </option>
      </select>
      <button @click="loadDiagramsList" :disabled="isLoadingList">↻</button>
      <div class="canvas-size-controls">
        <button type="button" @click="adjustZoom(-0.1)">−</button>
        <div style="min-width:60px;text-align:center;">{{ Math.round(zoom * 100) }}%</div>
        <button type="button" @click="adjustZoom(0.1)">+</button>
      </div>
      <button
        :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
        @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
      >
        Удалить точку
      </button>
    </div>
  </header>
</template>

<script>
export default {
  name: 'DiagramHeader',
  props: {
    diagramName: { type: String, required: true },
    diagramType: { type: String, required: true },
    snapToGrid: { type: Boolean, required: true },
    hasUnsavedChanges: { type: Boolean, required: true },
    currentDiagramId: { type: String, default: null },
    selectedDiagramId: { type: String, default: null },
    diagrams: { type: Array, default: () => [] },
    isLoadingList: { type: Boolean, required: true },
    zoom: { type: Number, required: true },
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
    canUndo: { type: Boolean, required: true },
    canRedo: { type: Boolean, required: true },
    loadDiagram: { type: Function, required: true },
    loadDiagramsList: { type: Function, required: true },
    adjustZoom: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true }
  },
  methods: {
    handleDiagramSelect(event) {
      const value = event.target.value || null;
      this.setSelectedDiagramId(value);
      if (value) {
        this.loadDiagram(value);
      }
    }
  }
};
</script>
