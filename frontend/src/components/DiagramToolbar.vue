<template>
  <aside class="toolbar-shell">
    <section class="section" v-if="selectionTools.length > 0">
      <h3>Инструменты</h3>
      <div class="tool-grid">
        <Button
          v-for="tool in selectionTools"
          :key="tool.type"
          size="small"
          :label="tool.label"
          :severity="currentTool === tool.type ? 'primary' : 'secondary'"
          :outlined="currentTool !== tool.type"
          @click="selectTool(tool.type)"
        />
      </div>
    </section>

    <section class="section">
      <h3>Элементы</h3>
      <div class="tool-grid">
        <Button
          v-for="tool in availableElementTools"
          :key="tool.type"
          size="small"
          :label="tool.label"
          :severity="currentTool === tool.type ? 'primary' : 'secondary'"
          :outlined="currentTool !== tool.type"
          @click="selectTool(tool.type)"
        />
      </div>
    </section>

    <section class="section">
      <h3>Связи</h3>
      <div class="tool-grid">
        <Button
          v-for="tool in availableConnectionTools"
          :key="tool.type"
          size="small"
          :label="tool.label"
          :severity="currentTool === tool.type ? 'info' : 'secondary'"
          :outlined="currentTool !== tool.type"
          @click="selectTool(tool.type)"
        />
      </div>
      <Message v-if="availableConnectionTools.length === 0" severity="warn" :closable="false">
        Для выбранного типа диаграммы связи недоступны
      </Message>
    </section>

    <section class="section">
      <div class="section-header">
        <h3>Диаграммы</h3>
        <Button icon="pi pi-refresh" text rounded :loading="isLoadingList" @click="loadDiagramsList" />
      </div>
      <Listbox
        :options="diagramOptions"
        optionLabel="label"
        optionValue="id"
        :modelValue="currentDiagramId"
        @update:modelValue="loadDiagram"
        listStyle="max-height: 220px"
      />
    </section>

    <section class="section debug">
      <h3>Состояние</h3>
      <div class="debug-row">
        <span>Инструмент</span>
        <Badge :value="currentTool || 'none'" />
      </div>
      <div class="debug-row">
        <span>Элементы</span>
        <Badge severity="info" :value="elementsCount" />
      </div>
      <div class="debug-row">
        <span>Связи</span>
        <Badge severity="help" :value="connectionsCount" />
      </div>
      <Tag v-if="isConnecting" severity="warning" value="Режим соединения" />
      <Tag v-if="isDragging" severity="success" value="Перетаскивание" />
    </section>
  </aside>
</template>

<script>
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Listbox from 'primevue/listbox';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

export default {
  name: 'DiagramToolbar',
  components: { Button, Badge, Listbox, Tag, Message },
  props: {
    selectionTools: { type: Array, default: () => [] },
    availableElementTools: { type: Array, default: () => [] },
    availableConnectionTools: { type: Array, default: () => [] },
    currentTool: { type: String, default: null },
    selectTool: { type: Function, required: true },
    diagrams: { type: Array, default: () => [] },
    currentDiagramId: { type: String, default: null },
    isLoadingList: { type: Boolean, required: true },
    loadDiagramsList: { type: Function, required: true },
    loadDiagram: { type: Function, required: true },
    formatDate: { type: Function, required: true },
    elementsCount: { type: Number, required: true },
    connectionsCount: { type: Number, required: true },
    isConnecting: { type: Boolean, required: true },
    isDragging: { type: Boolean, required: true },
  },
  computed: {
    diagramOptions() {
      return this.diagrams.map((item) => ({
        id: item.id,
        label: `${item.name} • ${item.type} • ${this.formatDate(item.created_at)}`,
      }));
    },
  },
};
</script>

<style scoped>
.toolbar-shell {
  width: 320px;
  min-width: 300px;
  border-right: 1px solid var(--app-border, #dbe7ef);
  background: linear-gradient(180deg, var(--app-bg-0, #f7fbfd), var(--app-bg-1, #f2f9ff));
  padding: 0.8rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.section {
  border: 1px solid var(--app-border, #dbe7ef);
  border-radius: 10px;
  background: var(--app-panel, #fff);
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.section h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--app-text, #284357);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.debug .debug-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
