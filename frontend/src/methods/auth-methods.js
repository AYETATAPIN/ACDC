import { authService, ApiError, clearShareContext } from '../services/index.js';

const ownerAccessPolicy = () => ({
  mode: 'owner',
  permission: 'owner',
  canRead: true,
  canWrite: true,
  canShare: true,
  canDelete: true,
  canReplaceImport: true,
  requiresLogin: false,
});

export const authMethods = {
  resetWorkspaceForSignedOutUser() {
    if (!this.shareToken && !this.ruleShareToken) {
      this.accessPolicy = ownerAccessPolicy();
      clearShareContext();
    }
    this.diagramName = '';
    this.diagramType = 'class';
    this.currentDiagramTypeId = null;
    this.currentDiagramTypeEntity = null;
    this.diagramTypesCatalog = [];
    this.customElementTypes = [];
    this.customConnectionTypes = [];
    this.rulesMatrix = { elements: [], connection_types: [], cells: [] };
    this.currentTool = 'select';
    this.selectedConnection = null;
    this.editingConnectionLabel = null;
    this.elements = [];
    this.connections = [];
    this.selectedElement = null;
    this.currentDiagramId = null;
    this.diagrams = [];
    this.historyEntries = [];
    this.currentVersion = 0;
    this.selectedDiagramId = null;
    this.selectedElements = [];
    this.selectedBendPoint = { connId: null, pointIndex: null };
    this.localHistory = [];
    this.localHistoryIndex = -1;
    this.lastSavedState = null;
    this.hasUnsavedChanges = false;
  },

  async initializeAuth() {
    this.authReady = false;
    this.authError = null;

    try {
      const response = await authService.me();
      this.authUser = response.user || null;

      if (this.ruleShareToken) {
        await this.loadRuleShareState();
      } else if (this.shareToken) {
        await this.loadSharedDiagramState();
      } else if (this.authUser) {
        this.accessPolicy = ownerAccessPolicy();
        clearShareContext();
        await Promise.all([this.loadDiagramTypesCatalog(), this.loadDiagramsList()]);
      } else {
        this.resetWorkspaceForSignedOutUser();
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        this.showError(error.message || 'Failed to restore session');
      }

      this.authUser = null;
      if (this.ruleShareToken) {
        await this.loadRuleShareState();
      } else if (this.shareToken) {
        await this.loadSharedDiagramState();
      } else {
        this.resetWorkspaceForSignedOutUser();
      }
    } finally {
      this.authReady = true;
    }
  },

  setAuthMode(mode) {
    this.authMode = mode === 'register' ? 'register' : 'login';
    this.authError = null;
  },

  updateAuthField(field, value) {
    this.authForm = {
      ...this.authForm,
      [field]: value,
    };
  },

  async submitAuthForm() {
    this.authLoading = true;
    this.authError = null;

    try {
      const payload = {
        email: this.authForm.email,
        password: this.authForm.password,
      };

      const response =
        this.authMode === 'register'
          ? await authService.register({
              ...payload,
              display_name: this.authForm.display_name,
            })
          : await authService.login(payload);

      this.authUser = response.user || null;
      this.authForm = {
        email: this.authForm.email,
        password: '',
        display_name: this.authForm.display_name,
      };

      if (this.ruleShareToken) {
        await this.loadRuleShareState();
        this.ruleShareLoginRequired = false;
      } else if (this.shareToken) {
        await this.loadSharedDiagramState();
      } else {
        this.accessPolicy = ownerAccessPolicy();
        clearShareContext();
        await Promise.all([this.loadDiagramTypesCatalog(), this.loadDiagramsList()]);
      }
    } catch (error) {
      this.authError = error.message || 'Authentication failed';
    } finally {
      this.authLoading = false;
    }
  },

  async logout() {
    try {
      await authService.logout();
    } catch {
      // Ignore stale-session logout failures on the client.
    } finally {
      this.authUser = null;
      this.authError = null;
      this.authMode = 'login';
      this.authForm = {
        email: '',
        password: '',
        display_name: '',
      };
      this.resetWorkspaceForSignedOutUser();
      if (this.ruleShareToken) {
        await this.loadRuleShareState();
      } else if (this.shareToken) {
        await this.loadSharedDiagramState();
      }
    }
  },
};
