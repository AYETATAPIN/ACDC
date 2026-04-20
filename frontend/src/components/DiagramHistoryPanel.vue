<template>
  <aside class="history-shell" :class="{ collapsed: historyCollapsed }">
    <div class="header">
      <h3>History</h3>
      <Button :icon="historyCollapsed ? 'pi pi-angle-left' : 'pi pi-angle-right'" text rounded @click="toggleHistory" />
    </div>
    <div v-if="!historyCollapsed" class="content">
      <Message v-if="historyEntries.length === 0" severity="info" :closable="false">No snapshots yet</Message>
      <button
        v-for="entry in historyEntries"
        :key="entry.version"
        class="item"
        :class="{ active: entry.version === currentVersion }"
        @click="loadVersion(entry.version)"
      >
        <Tag :severity="entry.version === currentVersion ? 'success' : 'info'" :value="`v${entry.version}`" />
        <small>{{ formatDate(entry.created_at) }}</small>
      </button>
    </div>
  </aside>
</template>

<script>
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';

export default {
  name: 'DiagramHistoryPanel',
  components: { Button, Message, Tag },
  props: {
    historyEntries: { type: Array, default: () => [] },
    currentVersion: { type: Number, required: true },
    historyCollapsed: { type: Boolean, required: true },
    formatDate: { type: Function, required: true },
    toggleHistory: { type: Function, required: true },
    loadVersion: { type: Function, required: true },
  },
};
</script>

<style scoped>
.history-shell {
  width: 250px;
  border-left: 1px solid var(--app-border, #dbe7ef);
  background: var(--app-panel-soft, #f8fbff);
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  overflow-y: auto;
}

.history-shell.collapsed {
  width: 72px;
  padding: 0.55rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--app-text, #284357);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.item {
  border: 1px solid var(--app-border, #dbe7ef);
  border-radius: 8px;
  padding: 0.45rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.45rem;
  background: var(--app-panel, #fff);
  color: var(--app-text, #1f2937);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  text-align: left;
  appearance: none;
  width: 100%;
}

.item.active {
  border-color: var(--app-accent, #14b8a6);
  background: color-mix(in srgb, var(--app-accent, #14b8a6) 12%, var(--app-panel, #fff));
}
</style>
