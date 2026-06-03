<template>
  <main class="rule-share-page">
    <section class="rule-share-header">
      <div>
        <p class="rule-share-eyebrow">ACDC</p>
        <h1>{{ diagramType?.name || 'Правила диаграммы' }}</h1>
        <p>{{ diagramType?.description || 'Тип диаграммы, элементы, связи и матрица правил доступны по ссылке.' }}</p>
      </div>
      <div class="rule-share-actions">
        <Button
          v-if="authUser"
          icon="pi pi-check"
          label="Добавить в мои типы"
          :loading="accepting"
          @click="$emit('accept')"
        />
        <Button v-else icon="pi pi-sign-in" label="Войти, чтобы добавить" @click="$emit('auth')" />
      </div>
    </section>

    <Message v-if="notice" severity="success" :closable="false">{{ notice }}</Message>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <section class="rule-share-grid">
      <div class="rule-share-panel">
        <h2>Элементы</h2>
        <ul>
          <li v-for="item in elementTypes" :key="item.id">{{ item.name }}</li>
        </ul>
      </div>
      <div class="rule-share-panel">
        <h2>Связи</h2>
        <ul>
          <li v-for="item in connectionTypes" :key="item.id">
            <span class="rule-line" :style="{ borderBottomColor: item.color || '#334155', borderBottomStyle: item.dash ? 'dashed' : 'solid' }"></span>
            {{ item.name }}
          </li>
        </ul>
      </div>
    </section>

    <section class="rule-share-panel rule-share-matrix">
      <h2>Матрица правил</h2>
      <div class="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>From \\ To</th>
              <th v-for="target in matrixElements" :key="target.id">{{ target.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in matrixRows" :key="row.fromElement.id">
              <th>{{ row.fromElement.name }}</th>
              <td v-for="target in matrixElements" :key="target.id">
                <span
                  v-for="rule in row[target.id]"
                  :key="rule.connection_type_id"
                  class="rule-chip"
                  :class="{ allowed: rule.allowed, blocked: !rule.allowed }"
                >
                  {{ connectionName(rule.connection_type_id) }}: {{ rule.allowed ? 'allowed' : 'blocked' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<script>
import Button from 'primevue/button';
import Message from 'primevue/message';
import { buildMatrixRows, normalizeRulesMatrix } from '../rules/connectionRules.js';

export default {
  name: 'RuleShareView',
  components: { Button, Message },
  props: {
    state: { type: Object, default: null },
    authUser: { type: Object, default: null },
    accepting: { type: Boolean, default: false },
    notice: { type: String, default: null },
    error: { type: String, default: null },
  },
  emits: ['accept', 'auth'],
  computed: {
    diagramType() {
      return this.state?.diagram_type || null;
    },
    elementTypes() {
      return Array.isArray(this.state?.element_types) ? this.state.element_types : [];
    },
    connectionTypes() {
      return Array.isArray(this.state?.connection_types) ? this.state.connection_types : [];
    },
    matrix() {
      return normalizeRulesMatrix(this.state?.rules_matrix);
    },
    matrixElements() {
      return this.matrix.elements || [];
    },
    matrixRows() {
      return buildMatrixRows(this.matrix);
    },
  },
  methods: {
    connectionName(id) {
      return this.connectionTypes.find((item) => item.id === id)?.name || id;
    },
  },
};
</script>
