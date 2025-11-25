<template>
  <div class="app">
    <header class="header">
      <div>
        <h1>ACDC Diagram Editor</h1>
        <p class="subtitle">Сохранение + undo/redo на бекенде</p>
      </div>
      <div class="controls">
        <input v-model="diagramName" placeholder="Diagram name">
        <select v-model="diagramType">
          <option value="class">Class</option>
          <option value="use_case">Use Case</option>
          <option value="free_mode">Free Mode</option>
        </select>
        <button @click="saveDiagram">Save</button>
        <button @click="newDiagram">New</button>
        <button :disabled="!currentDiagramId" @click="undoDiagram">Undo</button>
        <button :disabled="!currentDiagramId" @click="redoDiagram">Redo</button>
      </div>
      <div class="history-meta" v-if="currentDiagramId">
        <span class="badge">ID: {{ currentDiagramId }}</span>
        <span class="badge">Version: {{ currentVersion }} / {{ historyEntries.length }}</span>
      </div>
    </header>

    <div class="main">
      <div class="toolbar">
        <h3>Tools</h3>
        <button @click="currentTool = 'class'" :class="{ active: currentTool === 'class' }">Class</button>
        <button @click="currentTool = 'actor'" :class="{ active: currentTool === 'actor' }">Actor</button>
        <button @click="currentTool = 'association'" :class="{ active: currentTool === 'association' }">Association</button>
      </div>

      <div class="canvas" @click="createElement">
        <div
            v-for="element in elements"
            :key="element.id"
            class="element"
            :style="{
            left: element.x + 'px',
            top: element.y + 'px',
            width: element.width + 'px',
            height: element.height + 'px'
          }"
        >
          {{ element.text }}
        </div>
      </div>

      <aside class="history-panel" v-if="currentDiagramId">
        <h3>History</h3>
        <div v-if="historyEntries.length === 0" class="empty">No snapshots yet</div>
        <div
            v-for="entry in historyEntries"
            :key="entry.version"
            class="history-row"
            :class="{ active: entry.version === currentVersion }"
        >
          <div class="version">v{{ entry.version }}</div>
          <div class="time">{{ formatDate(entry.created_at) }}</div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      diagramName: '',
      diagramType: 'class',
      currentTool: null,
      elements: [],
      currentDiagramId: null,
      historyEntries: [],
      currentVersion: 0
    }
  },
  methods: {
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },
    createElement(event) {
      if (!this.currentTool) return

      const element = {
        id: Date.now(),
        type: this.currentTool,
        x: event.offsetX - 60,
        y: event.offsetY - 30,
        width: 120,
        height: 60,
        text: this.currentTool
      }

      this.elements.push(element)
    },
    async saveDiagram() {
      try {
        const payload = {
          name: this.diagramName || 'Untitled',
          type: this.diagramType,
          svg_data: this.exportToSvg()
        }

        let response
        if (this.currentDiagramId) {
          response = await fetch(`/api/v1/diagrams/${this.currentDiagramId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          })
        } else {
          response = await fetch('/api/v1/diagrams', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          })
        }

        if (!response.ok) {
          throw new Error(`Failed: ${response.status} ${await response.text()}`)
        }

        const result = await response.json()
        this.currentDiagramId = result.id || this.currentDiagramId
        await this.loadHistory()
        alert('Diagram saved and snapshot recorded!')
      } catch (error) {
        alert('Error saving: ' + error.message)
      }
    },
    newDiagram() {
      this.elements = []
      this.diagramName = ''
      this.diagramType = 'class'
      this.currentDiagramId = null
      this.historyEntries = []
      this.currentVersion = 0
    },
    async loadHistory() {
      if (!this.currentDiagramId) return
      const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/history`)
      if (!res.ok) return
      const data = await res.json()
      this.historyEntries = data.entries || []
      this.currentVersion = data.current_version || 0
    },
    async undoDiagram() {
      if (!this.currentDiagramId) return
      const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/undo`, {method: 'POST'})
      if (!res.ok) {
        alert('Nothing to undo')
        return
      }
      const data = await res.json()
      this.applySnapshot(data.state)
      this.currentVersion = data.version
      await this.loadHistory()
    },
    async redoDiagram() {
      if (!this.currentDiagramId) return
      const res = await fetch(`/api/v1/diagrams/${this.currentDiagramId}/redo`, {method: 'POST'})
      if (!res.ok) {
        alert('Nothing to redo')
        return
      }
      const data = await res.json()
      this.applySnapshot(data.state)
      this.currentVersion = data.version
      await this.loadHistory()
    },
    applySnapshot(snapshot) {
      if (!snapshot) return
      this.diagramName = snapshot.diagram?.name || this.diagramName
      this.diagramType = snapshot.diagram?.type || this.diagramType
      this.elements = (snapshot.blocks || []).map((b) => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        text: (b.properties && (b.properties.label || b.properties.name)) || b.type
      }))
    },
    exportToSvg() {
      // Заглушка: в реальном редакторе здесь будет экспорт текущего холста
      return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><!-- rendered elements --></svg>`
    }
  }
}
</script>

<style>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #2c3e50;
  color: white;
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-column-gap: 1rem;
  align-items: center;
}

.subtitle {
  margin: 0;
  color: #ecf0f1;
  font-size: 0.9rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-start;
}

.controls input,
.controls select {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid #d0d7de;
}

.controls button {
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #3498db;
  color: white;
  transition: background 0.2s;
}

.controls button:hover {
  background: #2d83be;
}

.controls button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.history-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.badge {
  background: #ecf0f1;
  color: #2c3e50;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.toolbar {
  width: 200px;
  background: #ecf0f1;
  padding: 1rem;
}

.toolbar h3 {
  margin-top: 0;
}

.toolbar button {
  display: block;
  width: 100%;
  margin: 5px 0;
  padding: 10px;
  border: 1px solid #bdc3c7;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar button.active {
  background: #ffeaa7;
  border-color: #f39c12;
}

.canvas {
  flex: 1;
  background: white;
  position: relative;
  cursor: crosshair;
  min-height: 520px;
}

.element {
  position: absolute;
  background: #3498db;
  color: white;
  border: 2px solid #2980b9;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  cursor: move;
}

.history-panel {
  width: 240px;
  border-left: 1px solid #e5e7eb;
  padding: 1rem;
  background: #fafafa;
  overflow-y: auto;
}

.history-panel h3 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: #2c3e50;
}

.history-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: white;
}

.history-row.active {
  border-color: #3498db;
  background: #eaf4ff;
}

.history-row .version {
  font-weight: 600;
  color: #2c3e50;
}

.history-row .time {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.empty {
  color: #95a5a6;
  font-style: italic;
}
</style>
