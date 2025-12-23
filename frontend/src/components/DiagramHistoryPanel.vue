<template>
  <aside class="history-panel" :class="{ collapsed: historyCollapsed }">
    <div class="history-header" @click="toggleHistory">
      <h3>History</h3>
      <button class="collapse-btn">{{ historyCollapsed ? '▼' : '▲' }}</button>
    </div>
    <div v-if="!historyCollapsed">
      <div v-if="historyEntries.length === 0" class="empty">No snapshots yet</div>
      <div v-for="entry in historyEntries" :key="entry.version" class="history-row" :class="{ active: entry.version === currentVersion }">
        <div class="version">v{{ entry.version }}</div>
        <div class="time">{{ formatDate(entry.created_at) }}</div>
      </div>
    </div>
  </aside>
</template>

<script>
export default {
  name: 'DiagramHistoryPanel',
  props: {
    historyEntries: { type: Array, default: () => [] },
    currentVersion: { type: Number, required: true },
    historyCollapsed: { type: Boolean, required: true },
    formatDate: { type: Function, required: true },
    toggleHistory: { type: Function, required: true }
  }
};
</script>
