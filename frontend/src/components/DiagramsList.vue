<template>
  <div class="diagrams-list">
    <h3>Saved Diagrams</h3>
    <div v-if="diagrams.length === 0" class="empty-state">
      No diagrams saved yet
    </div>
    <div
        v-for="diagram in diagrams"
        :key="diagram.id"
        class="diagram-item"
        @click="$emit('load-diagram', diagram.id)"
    >
      <h4>{{ diagram.name }}</h4>
      <div class="type">{{ diagram.type }}</div>
      <div class="date">{{ formatDate(diagram.created_at) }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DiagramsList',
  props: {
    diagrams: Array
  },
  emits: ['load-diagram'],
  methods: {
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString()
    }
  }
}
</script>

<style scoped>
.diagrams-list {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.diagrams-list h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.empty-state {
  text-align: center;
  color: #7f8c8d;
  font-style: italic;
  padding: 2rem;
}

.diagram-item {
  background: white;
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  border: 1px solid #bdc3c7;
  cursor: pointer;
  transition: all 0.2s;
}

.diagram-item:hover {
  border-color: #3498db;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.diagram-item h4 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.diagram-item .type {
  color: #7f8c8d;
  font-size: 0.8rem;
  text-transform: capitalize;
}

.diagram-item .date {
  color: #95a5a6;
  font-size: 0.8rem;
}
</style>