<template>
  <div class="toolbar">
    <h3>Elements</h3>
    <div class="tool-group">
      <button
          v-for="tool in elementTools"
          :key="tool"
          class="tool-btn"
          :class="{ active: currentTool === tool }"
          @click="$emit('tool-selected', tool)"
      >
        {{ getToolLabel(tool) }}
      </button>
    </div>

    <div class="tool-group">
      <h3>Connections</h3>
      <button
          v-for="tool in connectionTools"
          :key="tool"
          class="tool-btn"
          :class="{ active: currentTool === tool }"
          @click="$emit('tool-selected', tool)"
      >
        {{ getToolLabel(tool) }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Toolbar',
  props: {
    currentTool: String
  },
  emits: ['tool-selected'],
  data() {
    return {
      elementTools: ['class', 'actor'],
      connectionTools: ['association']
    }
  },
  methods: {
    getToolLabel(tool) {
      const labels = {
        class: 'Class',
        interface: 'Interface',
        enum: 'Enum',
        actor: 'Actor',
        usecase: 'Use Case',
        note: 'Note',
        package: 'Package',
        association: 'Association',
        inheritance: 'Inheritance',
        composition: 'Composition'
      }
      return labels[tool] || tool
    }
  }
}
</script>

<style scoped>
.toolbar {
  width: 250px;
  background: #ecf0f1;
  padding: 1rem;
  border-right: 1px solid #bdc3c7;
  overflow-y: auto;
}

.tool-group {
  margin-bottom: 1.5rem;
}

.tool-group h3 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.tool-btn {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: white;
  border: 2px solid #bdc3c7;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.tool-btn:hover {
  border-color: #3498db;
  background: #f8f9fa;
}

.tool-btn.active {
  border-color: #e74c3c;
  background: #ffeaa7;
}
</style>