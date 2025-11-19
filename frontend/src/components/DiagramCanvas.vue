<template>
  <div class="canvas-wrapper">
    <svg
        class="diagram-canvas"
        :style="{ transform: `scale(${zoom})` }"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleClick"
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#34495e"/>
        </marker>
        <marker id="composition" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" fill="white" stroke="#34495e" stroke-width="2"/>
        </marker>
      </defs>

      <!-- Render connections -->
      <path
          v-for="conn in connections"
          :key="conn.id"
          :d="`M ${conn.points[0].x} ${conn.points[0].y} L ${conn.points[1].x} ${conn.points[1].y}`"
          :class="['connection', conn.type]"
      />

      <!-- Render elements -->
      <rect
          v-for="element in elements"
          v-if="['class', 'interface', 'enum', 'actor', 'note', 'package'].includes(element.type)"
          :key="element.id"
          :x="element.x"
          :y="element.y"
          :width="element.width"
          :height="element.height"
          :class="['diagram-element', `${element.type}-rect`, { selected: selectedElement?.id === element.id }]"
          @mousedown="onElementMouseDown(element, $event)"
      />

      <ellipse
          v-for="element in elements"
          v-if="element.type === 'usecase'"
          :key="element.id"
          :cx="element.x + element.width / 2"
          :cy="element.y + element.height / 2"
          :rx="element.width / 2"
          :ry="element.height / 2"
          :class="['diagram-element', `${element.type}-ellipse`, { selected: selectedElement?.id === element.id }]"
          @mousedown="onElementMouseDown(element, $event)"
      />

      <!-- Element texts -->
      <text
          v-for="element in elements"
          :key="`text-${element.id}`"
          :x="element.x + element.width / 2"
          :y="element.y + element.height / 2"
          class="element-text"
          dy="0.3em"
      >
        {{ element.text }}
      </text>

      <!-- Connection labels -->
      <text
          v-for="conn in connections"
          v-if="conn.label"
          :key="`label-${conn.id}`"
          :x="(conn.points[0].x + conn.points[1].x) / 2"
          :y="(conn.points[0].y + conn.points[1].y) / 2 - 10"
          class="connection-label"
          text-anchor="middle"
      >
        {{ conn.label }}
      </text>
    </svg>
  </div>
</template>

<script>
export default {
  name: 'DiagramCanvas',
  props: {
    elements: Array,
    connections: Array,
    selectedElement: Object,
    currentTool: String,
    zoom: Number
  },
  emits: ['element-selected', 'element-moved', 'element-created', 'connection-created'],
  data() {
    return {
      dragging: false,
      dragElement: null,
      dragOffset: {x: 0, y: 0},
      connectionStart: null
    }
  },
  methods: {
    handleMouseDown(event) {
      const rect = this.$el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const element = this.getElementAt(x, y)
      if (element) {
        this.dragging = true
        this.dragElement = element
        this.dragOffset.x = x - element.x
        this.dragOffset.y = y - element.y
        this.$emit('element-selected', element)
        return
      }

      // Create new element if a tool is selected and it's not a connection tool
      if (this.currentTool && !['association', 'inheritance', 'composition'].includes(this.currentTool)) {
        this.$emit('element-created', this.currentTool, x, y)
      }
    },

    handleMouseMove(event) {
      if (!this.dragging || !this.dragElement) return

      const rect = this.$el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const newX = x - this.dragOffset.x
      const newY = y - this.dragOffset.y

      this.$emit('element-moved', this.dragElement.id, newX, newY)
    },

    handleMouseUp() {
      this.dragging = false
      this.dragElement = null
    },

    handleClick(event) {
      if (this.currentTool && ['association', 'inheritance', 'composition'].includes(this.currentTool)) {
        this.handleConnectionTool(event)
      }
    },

    handleConnectionTool(event) {
      const rect = this.$el.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      const element = this.getElementAt(x, y)
      if (element) {
        if (!this.connectionStart) {
          this.connectionStart = element
        } else if (this.connectionStart !== element) {
          this.$emit('connection-created', this.connectionStart, element)
          this.connectionStart = null
        }
      }
    },

    onElementMouseDown(element, event) {
      event.stopPropagation()
      this.$emit('element-selected', element)
    },

    getElementAt(x, y) {
      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i]
        if (x >= element.x && x <= element.x + element.width &&
            y >= element.y && y <= element.y + element.height) {
          return element
        }
      }
      return null
    }
  }
}
</script>

<style scoped>
.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, #f0f0f0 1px, transparent 1px),
  linear-gradient(#f0f0f0 1px, transparent 1px);
  background-size: 20px 20px;
}

.diagram-canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  transform-origin: 0 0;
  transition: transform 0.2s;
}

.diagram-element {
  cursor: move;
  transition: filter 0.2s;
}

.diagram-element:hover {
  filter: brightness(1.1);
}

.diagram-element.selected {
  filter: brightness(1.2);
  stroke: #e74c3c;
  stroke-width: 2;
}

.connection {
  stroke: #34495e;
  stroke-width: 2;
  fill: none;
  marker-end: url(#arrowhead);
}

.connection.selected {
  stroke: #e74c3c;
}

.connection-label {
  font-size: 12px;
  fill: #2c3e50;
  pointer-events: none;
}

/* Element styles */
.class-rect {
  fill: #3498db;
  stroke: #2980b9;
  stroke-width: 2;
}

.interface-rect {
  fill: #9b59b6;
  stroke: #8e44ad;
  stroke-width: 2;
}

.enum-rect {
  fill: #e67e22;
  stroke: #d35400;
  stroke-width: 2;
}

.actor-rect {
  fill: #27ae60;
  stroke: #229954;
  stroke-width: 2;
}

.usecase-ellipse {
  fill: #e74c3c;
  stroke: #c0392b;
  stroke-width: 2;
}

.note-rect {
  fill: #f1c40f;
  stroke: #f39c12;
  stroke-width: 2;
  stroke-dasharray: 5, 5;
}

.package-rect {
  fill: #1abc9c;
  stroke: #16a085;
  stroke-width: 2;
}

.element-text {
  fill: white;
  font-size: 14px;
  text-anchor: middle;
  pointer-events: none;
  font-weight: 500;
}

/* Connection types */
.association {
  stroke-dasharray: none;
}

.inheritance {
  stroke-dasharray: 10, 5;
}

.composition {
  stroke-dasharray: none;
  marker-end: url(#composition);
}
</style>