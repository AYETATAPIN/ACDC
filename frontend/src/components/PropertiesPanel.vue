<template>
  <div class="properties-panel">
    <h3>Properties</h3>

    <div class="property-group">
      <label>Text:</label>
      <input
          type="text"
          v-model="localElement.text"
          @input="updateElement"
          class="property-input"
      >
    </div>

    <div class="property-group">
      <label>Width:</label>
      <input
          type="number"
          v-model.number="localElement.width"
          @input="updateElement"
          class="property-input"
      >
    </div>

    <div class="property-group">
      <label>Height:</label>
      <input
          type="number"
          v-model.number="localElement.height"
          @input="updateElement"
          class="property-input"
      >
    </div>

    <div class="property-group">
      <label>X Position:</label>
      <input
          type="number"
          v-model.number="localElement.x"
          @input="updateElement"
          class="property-input"
      >
    </div>

    <div class="property-group">
      <label>Y Position:</label>
      <input
          type="number"
          v-model.number="localElement.y"
          @input="updateElement"
          class="property-input"
      >
    </div>
  </div>
</template>

<script>
import {ref, watch} from 'vue'

export default {
  name: 'PropertiesPanel',
  props: {
    element: Object
  },
  emits: ['update-element'],
  setup(props, {emit}) {
    const localElement = ref({...props.element})

    watch(() => props.element, (newElement) => {
      localElement.value = {...newElement}
    }, {deep: true})

    const updateElement = () => {
      emit('update-element', props.element.id, {...localElement.value})
    }

    return {
      localElement,
      updateElement
    }
  }
}
</script>

<style scoped>
.properties-panel {
  padding: 1rem;
  background: white;
  margin: 1rem;
  border-radius: 6px;
  border: 1px solid #bdc3c7;
}

.properties-panel h3 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.property-group {
  margin-bottom: 1rem;
}

.property-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
  color: #2c3e50;
}

.property-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
}
</style>