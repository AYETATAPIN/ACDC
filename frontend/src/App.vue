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
      <div class="debug-info" style="color: white; font-size: 12px;">
        Текущий инструмент: {{ currentTool }} | Элементов: {{ elements.length }}
      </div>
    </header>

    <div class="main">
      <div class="toolbar">
        <h3>Tools</h3>
        <button @click="currentTool = 'class'" :class="{ active: currentTool === 'class' }">Class</button>
        <button @click="currentTool = 'actor'" :class="{ active: currentTool === 'actor' }">Actor</button>
        <button @click="currentTool = 'association'" :class="{ active: currentTool === 'association' }">Association</button>

        <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
          <p><strong>Отладка:</strong></p>
          <p>Инструмент: {{ currentTool }}</p>
          <p>Элементов: {{ elements.length }}</p>
          <p>Связей: {{ connections.length }}</p>
          <p v-if="isConnecting" style="color: #e74c3c;">Режим связи: выберите второй элемент</p>
          <p v-if="isDragging" style="color: #27ae60;">Перемещение элемента</p>
        </div>
      </div>

      <div class="canvas"
           @click="handleCanvasClick"
           @mousedown="handleMouseDown"
           @mousemove="handleMouseMove"
           @mouseup="handleMouseUp"
           @mouseleave="handleMouseUp"
      >
        <svg
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"
            xmlns="http://www.w3.org/2000/svg"
        >
          <line
              v-for="conn in connections"
              :key="conn.id"
              :x1="conn.points[0].x"
              :y1="conn.points[0].y"
              :x2="conn.points[1].x"
              :y2="conn.points[1].y"
              :stroke="getConnectionColor(conn.type)"
              stroke-width="3"
              marker-end="url(#arrowhead)"
          />

          <defs>
            <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
            >
              <polygon
                  points="0 0, 10 3.5, 0 7"
                  :fill="getConnectionColor('association')"
              />
            </marker>
          </defs>
        </svg>

        <div
            v-if="isConnecting && connectionStart"
            style="position: absolute; pointer-events: none; z-index: 1000;"
            :style="{
      left: (connectionStart.x + connectionStart.width/2) + 'px',
      top: (connectionStart.y + connectionStart.height/2) + 'px'
    }"
        >
          <div style="color: #e74c3c; font-weight: bold; background: white; padding: 5px; border-radius: 4px;">
            Выберите второй элемент
          </div>
        </div>

        <div style="padding: 20px; color: #666; text-align: center;" v-if="elements.length === 0">
          <p>Выберите инструмент слева и кликните здесь</p>
          <p>Текущий инструмент: <strong>{{ currentTool }}</strong></p>
        </div>

        <div
            v-for="element in elements"
            :key="element.id"
            class="element"
            :class="{ dragging: dragElement?.id === element.id }"
            :style="{
    left: element.x + 'px',
    top: element.y + 'px',
    width: element.width + 'px',
    height: element.height + 'px',
    background: element.type === 'class' ? '#3498db' :
               element.type === 'actor' ? '#27ae60' : '#e74c3c',
    border: selectedElement?.id === element.id ? '2px solid #e74c3c' :
            connectionStart?.id === element.id ? '2px solid #f39c12' : '2px solid #2c3e50'
  }"
            @click.stop="handleElementClick(element)"
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
      currentTool: 'class',
      elements: [],
      connections: [],
      selectedElement: null,
      zoom: 1,
      currentDiagramId: null,
      historyEntries: [],
      currentVersion: 0,
      connectionStart: null,
      isConnecting: false,
      tempConnection: null,
      dragElement: null,
      dragOffset: { x: 0, y: 0 },
      isDragging: false
    }
  },
  methods: {
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },

    handleCanvasClick(event) {
      console.log('Canvas clicked!', event);
      console.log('Current tool:', this.currentTool);

      if (!this.currentTool) {
        console.log('No tool selected');
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      console.log('Click coordinates:', x, y);

      const clickedElement = this.getElementAtPosition(x, y);

      if (clickedElement) {
        console.log('Clicked on existing element - skipping canvas click');
        return;
      }

      const connectionTools = ['association', 'inheritance', 'composition'];

      if (connectionTools.includes(this.currentTool)) {
        this.connectionStart = null;
        this.isConnecting = false;
        console.log('Clicked outside elements in connection mode - reset');
      } else {
        this.createElement(this.currentTool, x, y);
      }
    },

    handleElementClick(element) {
      console.log('Element clicked:', element);
      console.log('Current tool:', this.currentTool);
      console.log('Is connecting:', this.isConnecting);

      const connectionTools = ['association', 'inheritance', 'composition'];

      if (connectionTools.includes(this.currentTool)) {
        const rect = this.$el.querySelector('.canvas').getBoundingClientRect();
        const x = element.x + element.width / 2;
        const y = element.y + element.height / 2;

        this.handleConnectionMode(x, y);
      } else {
        this.selectElement(element);
      }
    },

    getConnectionColor(connectionType) {
      const colors = {
        association: '#34495e',
        inheritance: '#e74c3c',
        composition: '#27ae60'
      };
      return colors[connectionType] || '#34495e';
    },

    handleConnectionMode(x, y) {
      const clickedElement = this.getElementAtPosition(x, y);

      if (!clickedElement) {
        this.connectionStart = null;
        this.isConnecting = false;
        console.log('Clicked outside element - connection cancelled');
        return;
      }

      if (!this.connectionStart) {
        this.connectionStart = clickedElement;
        this.isConnecting = true;
        console.log('First element selected:', clickedElement);
      } else {
        if (this.connectionStart.id !== clickedElement.id) {
          this.createConnection(this.connectionStart, clickedElement);
          console.log('Connection created between:', this.connectionStart, 'and', clickedElement);
        } else {
          console.log('Cannot connect element to itself');
        }

        this.connectionStart = null;
        this.isConnecting = false;
      }
    },

    handleMouseDown(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const element = this.getElementAtPosition(x, y);

      if (element && !this.isConnecting) {
        this.dragElement = element;
        this.dragOffset.x = x - element.x;
        this.dragOffset.y = y - element.y;
        this.isDragging = true;

        this.selectedElement = element;

        console.log('Start dragging:', element);
        event.preventDefault();
      }
    },

    handleMouseMove(event) {
      if (!this.isDragging || !this.dragElement) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const newX = x - this.dragOffset.x;
      const newY = y - this.dragOffset.y;

      this.moveElement(this.dragElement.id, newX, newY);

      this.updateConnections();
    },

    handleMouseUp() {
      if (this.isDragging) {
        console.log('Stop dragging:', this.dragElement);
        this.isDragging = false;
        this.dragElement = null;
      }
    },

    updateConnections() {
      this.connections.forEach(conn => {
        const fromElement = this.elements.find(el => el.id === conn.from);
        const toElement = this.elements.find(el => el.id === conn.to);

        if (fromElement && toElement) {
          conn.points = this.calculateConnectionPoints(fromElement, toElement);
        }
      });
    },

    moveElement(elementId, newX, newY) {
      const element = this.elements.find(el => el.id === elementId);
      if (element) {
        element.x = newX;
        element.y = newY;
      }
    },


    getElementAtPosition(x, y) {
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i];
        if (x >= element.x && x <= element.x + element.width &&
            y >= element.y && y <= element.y + element.height) {
          return element;
        }
      }
      return null;
    },

    createConnection(fromElement, toElement) {
      console.log('Creating connection from:', fromElement, 'to:', toElement);

      const connection = {
        id: Date.now().toString(),
        from: fromElement.id,
        to: toElement.id,
        type: this.currentTool,
        label: '',
        points: this.calculateConnectionPoints(fromElement, toElement)
      };

      console.log('Connection points:', connection.points);
      this.connections.push(connection);

      console.log('Total connections:', this.connections.length);
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
      this.connections = []
      this.diagramName = ''
      this.diagramType = 'class'
      this.currentTool = 'class'
      this.selectedElement = null
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
      return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><!-- rendered elements --></svg>`
    },

    selectElement(element) {
      console.log('Element selected:', element);

      if (this.isConnecting) {
        console.log('In connection mode - skipping selection');
        return;
      }

      this.selectedElement = element;
    },


    createElement(type, x, y) {
      console.log('Creating element:', type, 'at', x, y);

      const element = {
        id: Date.now().toString(),
        type: type,
        x: x - 60,
        y: y - 30,
        width: 120,
        height: 60,
        text: this.getDefaultText(type)
      };

      console.log('New element:', element);
      this.elements.push(element);
      this.selectedElement = element;
    },


    getDefaultText(type) {
      const texts = {
        class: 'New Class',
        actor: 'Actor',
        association: 'Association'
      };
      return texts[type] || type;
    },

    calculateConnectionPoints(fromElement, toElement) {
      const fromCenter = {
        x: fromElement.x + fromElement.width / 2,
        y: fromElement.y + fromElement.height / 2
      };
      const toCenter = {
        x: toElement.x + toElement.width / 2,
        y: toElement.y + toElement.height / 2
      };

      return [
        { x: fromCenter.x, y: fromCenter.y },
        { x: toCenter.x, y: toCenter.y }
      ];
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
  color: white;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.element:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
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

.element.dragging {
  cursor: grabbing !important;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  z-index: 1000;
}

.canvas {
  flex: 1;
  background: white;
  position: relative;
  cursor: crosshair;
  min-height: 520px;
  user-select: none;
}
</style>