<template>
  <aside class="properties-panel" v-if="selectedElement || selectedConnection">
    <div class="properties-header">
      <h3>{{ selectedElement ? 'Свойства элемента' : 'Свойства связи' }}</h3>
      <button @click="deselectAll" class="close-btn">×</button>
    </div>
    <div class="properties-content">
      <template v-if="selectedElement">
        <div class="prop-group" v-if="selectedElement.type === 'class'">
            <label>Атрибуты (каждый с новой строки)</label>
            <textarea 
                v-model="classAttributes" 
                @input="updateClassProperties"
                placeholder="name: String&#10;age: Integer&#10;email: String"
                rows="4"
                class="property-textarea"
            />
        </div>

        <div class="prop-group" v-if="selectedElement.type === 'class'">
            <label>Операции (каждый с новой строки)</label>
            <textarea 
                v-model="classOperations" 
                @input="updateClassProperties"
                placeholder="getName(): String&#10;setName(name: String): void&#10;calculateAge(): Integer"
                rows="4"
                class="property-textarea"
            />
        </div>
        <div class="prop-group">
          <label>Текст</label>
          <input v-model="selectedElement.text" placeholder="Введите текст" />
        </div>
        <div class="prop-group">
          <label>Размер шрифта</label>
          <input type="range" min="10" max="30" v-model.number="selectedElement.fontSize" />
          <span>{{ selectedElement.fontSize || 14 }}px</span>
        </div>
        <div class="prop-group">
          <label>Цвет фона</label>
          <input type="color" :value="selectedElement.customColor || getElementPreset(selectedElement.type)?.color || '#95a5a6'" @input="selectedElement.customColor = $event.target.value" />
        </div>
        <div class="prop-group">
          <label>Цвет границы</label>
          <input type="color" :value="selectedElement.customBorder || getElementPreset(selectedElement.type)?.border || '#2c3e50'" @input="selectedElement.customBorder = $event.target.value" />
        </div>
        <div class="prop-group">
          <label>Тип</label>
          <span class="prop-value">{{ selectedElement.type }}</span>
        </div>
      </template>

      <template v-else-if="selectedConnection">
        <div class="prop-group">
          <label>Удалить связь</label>
          <button 
            class="tool-btn delete-btn"
            @click="deleteConnection(selectedConnection)"
          >
            🗑️ Удалить связь
          </button>
          <span class="prop-hint">Удалить выбранную связь</span>
        </div>

        <div class="prop-group">
          <label>Надпись</label>
          <input v-model="selectedConnection.label" placeholder="Текст надписи" />
        </div>

        <div class="prop-group">
          <label>Цвет надписи</label>
          <input type="color" v-model="selectedConnection.labelColor" />
        </div>

        <div class="prop-group">
          <label>Размер шрифта надписи</label>
          <input type="range" min="8" max="24" step="1" v-model.number="selectedConnection.labelFontSize" />
          <span>{{ selectedConnection.labelFontSize || 12 }}px</span>
        </div>
        
        <div class="prop-group">
          <label>Цвет линии</label>
          <input type="color" v-model="selectedConnection.customColor" />
        </div>

        <div class="prop-group">
          <label>Стиль линии</label>
          <select v-model="selectedConnection.customDash">
            <option value="">Сплошная</option>
            <option value="6 4">Пунктир</option>
            <option value="10 6">Длинный пунктир</option>
            <option value="3 3">Точечная</option>
          </select>
        </div>

        <div class="prop-group">
          <label>Точки изгиба</label>
          <button class="tool-btn" @click="selectedConnection && addBendPointAtMidpoint(selectedConnection)">
            Добавить точку
          </button>
          <button
            class="tool-btn"
            :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
            @click="selectedBendPoint?.connId ? removeSelectedBendPoint() : (selectedConnection && removeLastBendPoint(selectedConnection))"
          >
            Удалить точку
          </button>
          <button
            class="tool-btn"
            :disabled="!selectedConnection || !hasBendPoints(selectedConnection)"
            @click="selectedConnection && clearBendPoints(selectedConnection)"
          >
            Удалить все точки
          </button>
          <span class="prop-hint">Alt/Option + клик по линии добавляет/удаляет точку рядом с кликом</span>
        </div>

        <div class="prop-group">
          <label>Тип связи</label>
          <span class="prop-value">{{ selectedConnection.type }}</span>
        </div>
      </template>
    </div>
  </aside>
</template>

<script>
export default {
  name: 'DiagramPropertiesPanel',
  props: {
    selectedElement: { type: Object, default: null },
    selectedConnection: { type: Object, default: null },
    selectedBendPoint: { type: Object, default: null },
    getElementPreset: { type: Function, required: true },
    deselectAll: { type: Function, required: true },
    deleteConnection: { type: Function, required: true },
    addBendPointAtMidpoint: { type: Function, required: true },
    hasBendPoints: { type: Function, required: true },
    clearBendPoints: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true }
  },
  data() {
    return {
      classAttributes: '',
      classOperations: ''
    };
  },
  watch: {
    selectedElement: {
      immediate: true,
      handler(newElement) {
        if (newElement?.type === 'class') {
          this.classAttributes = (newElement.properties?.attributes || []).join('\n');
          this.classOperations = (newElement.properties?.operations || []).join('\n');
        }
      }
    }
  },
  methods: {
    updateClassProperties() {
      if (this.selectedElement?.type === 'class') {
        // Обновляем properties напрямую (реактивно)
        this.selectedElement.properties = {
          ...this.selectedElement.properties,
          attributes: this.classAttributes.split('\n').filter(line => line.trim() !== ''),
          operations: this.classOperations.split('\n').filter(line => line.trim() !== '')
        };
      }
    }
  }
};
</script>

<style scoped>
.property-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  resize: vertical;
}
.delete-btn {
  background: #e74c3c !important;
  color: white !important;
  border-color: #c0392b !important;
}
.delete-btn:hover {
  background: #c0392b !important;
}
</style>