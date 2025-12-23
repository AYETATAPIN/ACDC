<template>
  <aside class="properties-panel" v-if="selectedElement || selectedConnection">
    <div class="properties-header">
      <h3>{{ selectedElement ? 'Свойства элемента' : 'Свойства связи' }}</h3>
      <button @click="deselectAll" class="close-btn">×</button>
    </div>
    <div class="properties-content">
      <template v-if="selectedElement">
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
    addBendPointAtMidpoint: { type: Function, required: true },
    hasBendPoints: { type: Function, required: true },
    clearBendPoints: { type: Function, required: true },
    removeSelectedBendPoint: { type: Function, required: true },
    removeLastBendPoint: { type: Function, required: true }
  }
};
</script>
