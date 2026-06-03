<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    header="Доступ к правилам"
    :style="{ width: '600px', maxWidth: '96vw' }"
    class="share-dialog"
    @show="loadShares"
  >
    <div class="share-dialog-body">
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <Message v-if="notice" severity="success" :closable="false">{{ notice }}</Message>

      <section class="share-section">
        <div class="share-section-head">
          <div>
            <h3>Просмотр и подключение</h3>
            <p>Любой пользователь с этой ссылкой сможет посмотреть правила. После входа он сможет добавить тип в свой список.</p>
          </div>
          <Tag :severity="share.active ? 'success' : 'secondary'" :value="share.active ? 'Активна' : 'Не создана'" />
        </div>

        <div v-if="share.active" class="share-link-row">
          <InputText class="share-input" readonly :modelValue="share.url || 'Ссылка активна, но текущий URL недоступен'" />
          <Button icon="pi pi-copy" label="Копировать" :disabled="!share.url" @click="copyLink" />
        </div>

        <p v-if="share.active && !share.url" class="share-hint">
          Backend хранит только hash токена, поэтому старую ссылку нельзя показать повторно. Создайте новую ссылку, чтобы скопировать свежий URL.
        </p>

        <div class="share-actions">
          <Button v-if="!share.active" icon="pi pi-link" label="Создать ссылку" :loading="busy" @click="createShare" />
          <Button
            v-else
            icon="pi pi-refresh"
            label="Отозвать и создать новую"
            severity="warning"
            outlined
            :loading="busy"
            @click="rotateShare"
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
import { ruleSharesService } from '../services/index.js';

const emptyShare = () => ({
  permission: 'read',
  active: false,
  created_at: null,
  expires_at: null,
  url: null,
});

export default {
  name: 'RuleShareDialog',
  components: { Dialog, InputText, Button, Message, Tag },
  props: {
    modelValue: { type: Boolean, required: true },
    diagramTypeId: { type: String, default: null },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      share: emptyShare(),
      busy: false,
      error: null,
      notice: null,
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
    mergeItems(items) {
      const readShare = (Array.isArray(items) ? items : []).find((item) => item?.permission === 'read');
      this.share = readShare ? { ...emptyShare(), ...readShare } : emptyShare();
    },
    async loadShares() {
      if (!this.diagramTypeId) return;
      this.error = null;
      this.notice = null;
      try {
        const response = await ruleSharesService.listOwnerShares(this.diagramTypeId);
        this.mergeItems(response.items || []);
      } catch (error) {
        this.error = error.message || 'Не удалось загрузить ссылку правил';
      }
    },
    async createShare() {
      if (!this.diagramTypeId) return;
      this.busy = true;
      this.error = null;
      this.notice = null;
      try {
        const response = await ruleSharesService.createOwnerShare(this.diagramTypeId);
        this.share = { ...emptyShare(), ...response, active: true };
        this.notice = response.url ? 'Ссылка создана. Ее можно скопировать.' : 'Ссылка уже активна. Создайте новую, чтобы получить свежий URL.';
      } catch (error) {
        this.error = error.message || 'Не удалось создать ссылку';
      } finally {
        this.busy = false;
      }
    },
    async rotateShare() {
      if (!this.diagramTypeId) return;
      this.busy = true;
      this.error = null;
      this.notice = null;
      try {
        const response = await ruleSharesService.rotateOwnerShare(this.diagramTypeId);
        this.share = { ...emptyShare(), ...response, active: true };
        this.notice = 'Старая ссылка отозвана, новая ссылка создана.';
      } catch (error) {
        this.error = error.message || 'Не удалось создать новую ссылку';
      } finally {
        this.busy = false;
      }
    },
    async copyLink() {
      if (!this.share.url) return;
      try {
        await navigator.clipboard.writeText(this.share.url);
        this.notice = 'Ссылка скопирована';
      } catch {
        this.error = 'Не удалось скопировать ссылку автоматически';
      }
    },
  },
};
</script>
