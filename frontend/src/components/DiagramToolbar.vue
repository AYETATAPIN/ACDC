<template>
  <div class="toolbar">
    <div class="toolbar-section">
      <h3>Элементы</h3>
      <div class="tool-grid">
        <button
          v-for="tool in availableElementTools"
          :key="tool.type"
          class="tool-btn"
          :class="{ active: currentTool === tool.type }"
          @click="selectTool(tool.type)"
        >
          <span class="tool-label">{{ tool.label }}</span>
          <span class="tool-hint">{{ tool.shape }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar-section">
      <h3>Связи</h3>
      <div class="tool-grid">
        <button
          v-for="tool in availableConnectionTools"
          :key="tool.type"
          class="tool-btn connection-btn"
          :class="{ active: currentTool === tool.type }"
          @click="selectTool(tool.type)"
        >
          <span class="tool-label">{{ tool.label }}</span>
          <span class="tool-hint" :style="{ color: getConnectionColor(tool.type) }">{{ tool.type }}</span>
        </button>
        <div v-if="availableConnectionTools.length === 0" class="empty-tools">
          Связи недоступны для текущего типа диаграммы
        </div>
      </div>
    </div>

    <div class="toolbar-section">
      <h3>Диаграммы</h3>
      <button class="tool-btn" @click="loadDiagramsList" :disabled="isLoadingList">
        {{ isLoadingList ? 'Загрузка...' : 'Обновить список' }}
      </button>
      <div class="diagram-list">
        <div
          v-for="item in diagrams"
          :key="item.id"
          class="diagram-item"
          :class="{ active: currentDiagramId === item.id }"
          @click="loadDiagram(item.id)"
        >
          <div class="diagram-title">{{ item.name }}</div>
          <div class="diagram-meta">
            <span class="badge small">{{ item.type }}</span>
            <span class="diagram-date">{{ formatDate(item.created_at) }}</span>
          </div>
        </div>
        <div v-if="!isLoadingList && diagrams.length === 0" class="empty-tools">
          Нет сохранённых диаграмм
        </div>
      </div>
    </div>

    <div class="debug-panel">
      <p><strong>Отладка:</strong></p>
      <p>Инструмент: {{ currentTool || 'none' }}</p>
      <p>Элементов: {{ elementsCount }}</p>
      <p>Связей: {{ connectionsCount }}</p>
      <p v-if="isConnecting" class="debug-badge warn">Режим связи: выберите второй элемент</p>
      <p v-if="isDragging" class="debug-badge ok">Перемещение элемента</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiagramToolbar',
  props: {
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
    getConnectionColor: { type: Function, required: true },
    elementsCount: { type: Number, required: true },
    connectionsCount: { type: Number, required: true },
    isConnecting: { type: Boolean, required: true },
    isDragging: { type: Boolean, required: true }
  }
};
</script>
