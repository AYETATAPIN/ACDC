import { createHash, randomBytes } from 'node:crypto';
import type {
  AccessPolicy,
  ConnectionRulesMatrix,
  Diagram,
  DiagramBlock,
  DiagramConnection,
  DiagramTypeBundle,
  SharePermission,
} from '../types.js';
import { DiagramRepository } from '../repositories/diagramRepository.js';
import { ShareTokenRepository, type OwnerShareStatus } from '../repositories/shareTokenRepository.js';
import { DiagramHistoryService } from './diagramHistoryService.js';
import { DiagramTypeService } from './diagramTypeService.js';
import { HttpError } from '../middleware/errorHandler.js';

const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const generateShareToken = (): string => randomBytes(32).toString('base64url');

export const hashShareToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const isSharePermission = (value: unknown): value is SharePermission => value === 'read' || value === 'edit';

type OwnerShareResponse = {
  permission: SharePermission;
  active: boolean;
  created_at: string | null;
  expires_at: string | null;
  url: string | null;
  token?: string;
};

type ShareState = {
  diagram: Diagram;
  blocks: DiagramBlock[];
  connections: DiagramConnection[];
  diagram_type_bundle: DiagramTypeBundle;
  history: {
    current_version: number;
    entries: Array<{ version: number; created_at: string }>;
  };
  access: AccessPolicy;
};

type ShareAccess = {
  tokenPermission: SharePermission;
  diagram: Diagram;
  ownerUserId: string;
  access: AccessPolicy;
};

export class ShareTokenService {
  private shareTokens: ShareTokenRepository;
  private diagrams: DiagramRepository;
  private history: DiagramHistoryService;
  private diagramTypes: DiagramTypeService;

  constructor(
    shareTokens: ShareTokenRepository,
    diagrams: DiagramRepository,
    history: DiagramHistoryService,
    diagramTypes: DiagramTypeService,
  ) {
    this.shareTokens = shareTokens;
    this.diagrams = diagrams;
    this.history = history;
    this.diagramTypes = diagramTypes;
  }

  private assertValidTokenShape(rawToken: string): void {
    if (!RAW_TOKEN_RE.test(rawToken)) {
      throw new HttpError(404, 'Share link is invalid');
    }
  }

  private async ensureOwnerAccess(ownerUserId: string, diagramId: string): Promise<void> {
    const ok = await this.diagrams.isOwnedByUser(diagramId, ownerUserId);
    if (!ok) {
      throw new HttpError(404, 'Diagram not found');
    }
  }

  private buildShareUrl(origin: string, rawToken: string): string {
    return `${origin.replace(/\/$/, '')}/share/${rawToken}`;
  }

  private accessFor(permission: SharePermission, isAuthenticated: boolean): AccessPolicy {
    return {
      mode: 'shared',
      permission,
      canRead: true,
      canWrite: permission === 'edit' && isAuthenticated,
      canShare: false,
      canDelete: false,
      canReplaceImport: false,
      requiresLogin: permission === 'edit' && !isAuthenticated,
    };
  }

  private ownerShareFromStatus(status: OwnerShareStatus | null, permission: SharePermission): OwnerShareResponse {
    return {
      permission,
      active: Boolean(status),
      created_at: status?.created_at ?? null,
      expires_at: status?.expires_at ?? null,
      url: null,
    };
  }

  async listForOwner(ownerUserId: string, diagramId: string): Promise<{ items: OwnerShareResponse[] }> {
    await this.ensureOwnerAccess(ownerUserId, diagramId);
    const activeShares = await this.shareTokens.listActiveForDiagram(diagramId);
    const byPermission = new Map(activeShares.map((item) => [item.permission, item]));

    return {
      items: [
        this.ownerShareFromStatus(byPermission.get('read') ?? null, 'read'),
        this.ownerShareFromStatus(byPermission.get('edit') ?? null, 'edit'),
      ],
    };
  }

  async createForOwner(ownerUserId: string, diagramId: string, permission: SharePermission, origin: string): Promise<OwnerShareResponse> {
    await this.ensureOwnerAccess(ownerUserId, diagramId);

    const existing = await this.shareTokens.findActiveByDiagramAndPermission(diagramId, permission);
    if (existing) {
      return this.ownerShareFromStatus(existing, permission);
    }

    const rawToken = generateShareToken();
    const created = await this.shareTokens.create({
      diagramId,
      permission,
      tokenHash: hashShareToken(rawToken),
      createdByUserId: ownerUserId,
    });

    return {
      permission,
      active: true,
      created_at: created.created_at,
      expires_at: created.expires_at ?? null,
      token: rawToken,
      url: this.buildShareUrl(origin, rawToken),
    };
  }

  async rotateForOwner(ownerUserId: string, diagramId: string, permission: SharePermission, origin: string): Promise<OwnerShareResponse> {
    await this.ensureOwnerAccess(ownerUserId, diagramId);

    await this.shareTokens.revokeActiveForDiagramAndPermission(diagramId, permission);
    const rawToken = generateShareToken();
    const created = await this.shareTokens.create({
      diagramId,
      permission,
      tokenHash: hashShareToken(rawToken),
      createdByUserId: ownerUserId,
    });

    return {
      permission,
      active: true,
      created_at: created.created_at,
      expires_at: created.expires_at ?? null,
      token: rawToken,
      url: this.buildShareUrl(origin, rawToken),
    };
  }

  async resolveReadAccess(rawToken: string, authenticatedUserId: string | null): Promise<ShareAccess> {
    this.assertValidTokenShape(rawToken);

    const resolved = await this.shareTokens.findActiveByHash(hashShareToken(rawToken));
    if (!resolved) {
      throw new HttpError(404, 'Share link is invalid');
    }

    const ownerUserId = resolved.diagram.owner_user_id;
    if (!ownerUserId) {
      throw new HttpError(404, 'Share link is invalid');
    }

    const isAuthenticated = Boolean(authenticatedUserId);
    if (resolved.token.permission === 'edit' && !isAuthenticated) {
      throw new HttpError(401, 'Authentication required', {
        code: 'share_login_required',
        access: this.accessFor('edit', false),
      });
    }

    return {
      tokenPermission: resolved.token.permission,
      diagram: resolved.diagram,
      ownerUserId,
      access: this.accessFor(resolved.token.permission, isAuthenticated),
    };
  }

  async resolveWriteAccess(rawToken: string, authenticatedUserId: string | null): Promise<ShareAccess> {
    const access = await this.resolveReadAccess(rawToken, authenticatedUserId);
    if (access.tokenPermission === 'read') {
      throw new HttpError(403, 'Share link is read-only');
    }
    if (!access.access.canWrite) {
      throw new HttpError(401, 'Authentication required', {
        code: 'share_login_required',
        access: this.accessFor('edit', false),
      });
    }
    return access;
  }

  async getState(rawToken: string, authenticatedUserId: string | null): Promise<ShareState> {
    const access = await this.resolveReadAccess(rawToken, authenticatedUserId);

    const current = await this.history.getCurrentState(access.ownerUserId, access.diagram.id);
    if (current.status === 'not_found') {
      throw new HttpError(404, 'Diagram not found');
    }
    if (current.status === 'no_history') {
      throw new HttpError(404, 'Diagram has no history yet');
    }

    const history = await this.history.getHistory(access.ownerUserId, access.diagram.id);
    if (history.status === 'not_found') {
      throw new HttpError(404, 'Diagram not found');
    }

    const bundle = await this.getDiagramTypeBundle(access.ownerUserId, current.state.diagram.diagram_type_id);

    return {
      diagram: current.state.diagram,
      blocks: current.state.blocks,
      connections: current.state.connections,
      diagram_type_bundle: bundle,
      history: {
        current_version: history.currentVersion,
        entries: history.entries,
      },
      access: access.access,
    };
  }

  async getDiagramTypeBundle(ownerUserId: string, diagramTypeId: string): Promise<DiagramTypeBundle> {
    const diagramType = await this.diagramTypes.get(ownerUserId, diagramTypeId);
    if (!diagramType) {
      throw new HttpError(404, 'Diagram type not found');
    }

    const [elementTypes, connectionTypes, rulesMatrix] = await Promise.all([
      this.diagramTypes.listElements(ownerUserId, diagramTypeId),
      this.diagramTypes.listConnectionTypes(ownerUserId, diagramTypeId),
      this.diagramTypes.getRulesMatrix(ownerUserId, diagramTypeId) as Promise<ConnectionRulesMatrix>,
    ]);

    return {
      diagram_type: diagramType,
      element_types: elementTypes,
      connection_types: connectionTypes,
      rules_matrix: rulesMatrix,
    };
  }
}
