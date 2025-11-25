<template>
  <div class="app">
    <header class="header">
      <h1> ACDC Diagram Editor (Vue.js)</h1>
      <div class="controls">
        <input v-model="diagramName" placeholder="Diagram name">
        <button @click="saveDiagram">Save</button>
        <button @click="newDiagram">New</button>
      </div>
    </header>

    <div class="main">
      <div class="toolbar">
        <h3>Tools</h3>
        <button @click="currentTool = 'class'">Class</button>
        <button @click="currentTool = 'actor'">Actor</button>
        <button @click="currentTool = 'association'">Association</button>
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
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      diagramName: '',
      currentTool: null,
      elements: []
    }
  },
  methods: {
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
        const response = await fetch('/api/v1/diagrams', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            name: this.diagramName || 'Untitled',
            type: 'class',
            svg_data: '<svg>Diagram data</svg>'
          })
        })

        if (response.ok) {
          alert('Diagram saved!')
        }
      } catch (error) {
        alert('Error saving: ' + error.message)
      }
    },
    newDiagram() {
      this.elements = []
      this.diagramName = ''
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.main {
  display: flex;
  flex: 1;
}

.toolbar {
  width: 200px;
  background: #ecf0f1;
  padding: 1rem;
}

.toolbar button {
  display: block;
  width: 100%;
  margin: 5px 0;
  padding: 10px;
}

.canvas {
  flex: 1;
  background: white;
  position: relative;
  cursor: crosshair;
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
</style>