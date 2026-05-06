<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    header="Доступ по ссылке"
    :style="{ width: '640px', maxWidth: '96vw' }"
    class="share-dialog"
    @show="loadShares"
  >
    <div class="share-dialog-body">
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <Message v-if="notice" severity="success" :closable="false">{{ notice }}</Message>

      <section v-for="item in sections" :key="item.permission" class="share-section">
        <div class="share-section-head">
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <Tag :severity="shareFor(item.permission).active ? 'success' : 'secondary'" :value="shareFor(item.permission).active ? 'Активна' : 'Не создана'" />
        </div>

        <div v-if="shareFor(item.permission).active" class="share-link-row">
          <InputText
            class="share-input"
            readonly
            :modelValue="shareFor(item.permission).url || 'Ссылка активна, но текущий URL недоступен'"
          />
          <Button
            icon="pi pi-copy"
            label="Копировать"
            :disabled="!shareFor(item.permission).url"
            @click="copyLink(item.permission)"
          />
        </div>

        <p v-if="shareFor(item.permission).active && !shareFor(item.permission).url" class="share-hint">
          Backend хранит только hash токена, поэтому старую ссылку нельзя показать повторно. Создайте новую ссылку, чтобы скопировать свежий URL.
        </p>

        <div class="share-actions">
          <Button
            v-if="!shareFor(item.permission).active"
            icon="pi pi-link"
            label="Создать ссылку"
            :loading="isBusy(item.permission)"
            @click="createShare(item.permission)"
          />
          <Button
            v-else
            icon="pi pi-refresh"
            label="Отозвать и создать новую"
            severity="warning"
            outlined
            :loading="isBusy(item.permission)"
            @click="rotateShare(item.permission)"
          />
        </div>
      </section>
    </div>
  </Dialog>
</template>

<script>
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import { sharesService } from '../services/index.js';

const emptyShare = (permission) => ({
  permission,
  active: false,
  created_at: null,
  expires_at: null,
  url: null,
});

export default {
  name: 'ShareDialog',
  components: { Dialog, InputText, Button, Message, Tag },
  props: {
    modelValue: { type: Boolean, required: true },
    diagramId: { type: String, default: null },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      shares: {
        read: emptyShare('read'),
        edit: emptyShare('edit'),
      },
      busyPermission: null,
      error: null,
      notice: null,
      sections: [
        {
          permission: 'read',
          title: 'Просмотр',
          description: 'Любой пользователь с этой ссылкой сможет открыть актуальную диаграмму без входа.',
        },
        {
          permission: 'edit',
          title: 'Редактирование',
          description: 'Пользователь с этой ссылкой сможет редактировать диаграмму после входа в аккаунт.',
        },
      ],
    };
  },
  computed: {
    visible: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      },
    },
  },
  methods: {
    shareFor(permission) {
      return this.shares[permission] || emptyShare(permission);
    },
    isBusy(permission) {
      return this.busyPermission === permission;
    },
    mergeItems(items) {
      const next = {
        read: emptyShare('read'),
        edit: emptyShare('edit'),
      };
      for (const item of Array.isArray(items) ? items : []) {
        if (item?.permission === 'read' || item?.permission === 'edit') {
          next[item.permission] = { ...next[item.permission], ...item };
        }
      }
      this.shares = next;
    },
    async loadShares() {
      if (!this.diagramId) return;
      this.error = null;
      this.notice = null;
      try {
        const response = await sharesService.listOwnerShares(this.diagramId);
        this.mergeItems(response.items || []);
      } catch (error) {
        this.error = error.message || 'Не удалось загрузить ссылки доступа';
      }
    },
    async createShare(permission) {
      if (!this.diagramId) return;
      this.busyPermission = permission;
      this.error = null;
      this.notice = null;
      try {
        const response = await sharesService.createOwnerShare(this.diagramId, permission);
        this.shares = {
          ...this.shares,
          [permission]: { ...emptyShare(permission), ...response, active: true },
        };
        this.notice = response.url ? 'Ссылка создана. Ее можно скопировать.' : 'Ссылка уже активна. Создайте новую, чтобы получить свежий URL.';
      } catch (error) {
        this.error = error.message || 'Не удалось создать ссылку';
      } finally {
        this.busyPermission = null;
      }
    },
    async rotateShare(permission) {
      if (!this.diagramId) return;
      this.busyPermission = permission;
      this.error = null;
      this.notice = null;
      try {
        const response = await sharesService.rotateOwnerShare(this.diagramId, permission);
        this.shares = {
          ...this.shares,
          [permission]: { ...emptyShare(permission), ...response, active: true },
        };
        this.notice = 'Старая ссылка отозвана, новая ссылка создана.';
      } catch (error) {
        this.error = error.message || 'Не удалось создать новую ссылку';
      } finally {
        this.busyPermission = null;
      }
    },
    async copyLink(permission) {
      const url = this.shareFor(permission).url;
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        this.notice = 'Ссылка скопирована';
      } catch {
        this.error = 'Не удалось скопировать ссылку автоматически';
      }
    },
  },
};
</script>

<style scoped>
.share-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.share-section {
  border: 1px solid var(--app-border, #dbe7ef);
  border-radius: 10px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--app-panel, #ffffff);
}

.share-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.share-section h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  color: var(--app-text, #0f172a);
}

.share-section p {
  margin: 0;
  color: var(--app-muted, #475569);
  line-height: 1.45;
}

.share-link-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.share-input {
  flex: 1;
}

.share-hint {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412 !important;
  border: 1px solid #fed7aa;
}

.share-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
