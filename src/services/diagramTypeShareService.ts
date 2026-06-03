import { createHash, randomBytes } from 'node:crypto';
import type { AccessPolicy, ConnectionRulesMatrix, DiagramTypeBundle, DiagramTypeEntity } from '../types.js';
import { DiagramTypeShareRepository, type DiagramTypeShareStatus } from '../repositories/diagramTypeShareRepository.js';
import { DiagramTypeService } from './diagramTypeService.js';
import { HttpError } from '../middleware/errorHandler.js';

const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const generateDiagramTypeShareToken = (): string => randomBytes(32).toString('base64url');

export const hashDiagramTypeShareToken = (token: string): string => createHash('sha256').update(token).digest('hex');

type OwnerRuleShareResponse = {
  permission: 'read';
  active: boolean;
  created_at: string | null;
  expires_at: string | null;
  url: string | null;
  token?: string;
};

type RuleShareState = DiagramTypeBundle & {
  access: AccessPolicy;
};

export class DiagramTypeShareService {
  private shares: DiagramTypeShareRepository;
  private diagramTypes: DiagramTypeService;

  constructor(shares: DiagramTypeShareRepository, diagramTypes: DiagramTypeService) {
    this.shares = shares;
    this.diagramTypes = diagramTypes;
  }

  private assertValidTokenShape(rawToken: string): void {
    if (!RAW_TOKEN_RE.test(rawToken)) {
      throw new HttpError(404, 'Rule share link is invalid');
    }
  }

  private buildShareUrl(origin: string, rawToken: string): string {
    return `${origin.replace(/\/$/, '')}/rules/share/${rawToken}`;
  }

  private access(): AccessPolicy {
    return {
      mode: 'rule_share',
      permission: 'read',
      canRead: true,
      canWrite: false,
      canShare: false,
      canDelete: false,
      canReplaceImport: false,
      requiresLogin: false,
    };
  }

  private ownerShareFromStatus(status: DiagramTypeShareStatus | null): OwnerRuleShareResponse {
    return {
      permission: 'read',
      active: Boolean(status),
      created_at: status?.created_at ?? null,
      expires_at: status?.expires_at ?? null,
      url: null,
    };
  }

  private async ensureOwnerShareable(ownerUserId: string, diagramTypeId: string): Promise<DiagramTypeEntity> {
    const type = await this.diagramTypes.get(ownerUserId, diagramTypeId);
    if (!type || type.is_builtin || type.owner_user_id !== ownerUserId) {
      throw new HttpError(404, 'Diagram type not found');
    }
    return type;
  }

  async listForOwner(ownerUserId: string, diagramTypeId: string): Promise<{ items: OwnerRuleShareResponse[] }> {
    await this.ensureOwnerShareable(ownerUserId, diagramTypeId);
    const activeShares = await this.shares.listActiveForType(diagramTypeId);
    const readShare = activeShares.find((item) => item.permission === 'read') ?? null;
    return { items: [this.ownerShareFromStatus(readShare)] };
  }

  async createForOwner(ownerUserId: string, diagramTypeId: string, origin: string): Promise<OwnerRuleShareResponse> {
    await this.ensureOwnerShareable(ownerUserId, diagramTypeId);

    const existing = await this.shares.findActiveByTypeAndPermission(diagramTypeId, 'read');
    if (existing) {
      return this.ownerShareFromStatus(existing);
    }

    const rawToken = generateDiagramTypeShareToken();
    const created = await this.shares.create({
      diagramTypeId,
      permission: 'read',
      tokenHash: hashDiagramTypeShareToken(rawToken),
      createdByUserId: ownerUserId,
    });

    return {
      permission: 'read',
      active: true,
      created_at: created.created_at,
      expires_at: created.expires_at ?? null,
      token: rawToken,
      url: this.buildShareUrl(origin, rawToken),
    };
  }

  async rotateForOwner(ownerUserId: string, diagramTypeId: string, origin: string): Promise<OwnerRuleShareResponse> {
    await this.ensureOwnerShareable(ownerUserId, diagramTypeId);

    await this.shares.revokeActiveForTypeAndPermission(diagramTypeId, 'read');
    const rawToken = generateDiagramTypeShareToken();
    const created = await this.shares.create({
      diagramTypeId,
      permission: 'read',
      tokenHash: hashDiagramTypeShareToken(rawToken),
      createdByUserId: ownerUserId,
    });

    return {
      permission: 'read',
      active: true,
      created_at: created.created_at,
      expires_at: created.expires_at ?? null,
      token: rawToken,
      url: this.buildShareUrl(origin, rawToken),
    };
  }

  private async resolve(rawToken: string) {
    this.assertValidTokenShape(rawToken);
    const resolved = await this.shares.findActiveByHash(hashDiagramTypeShareToken(rawToken));
    if (!resolved || resolved.diagramType.is_builtin || !resolved.diagramType.owner_user_id) {
      throw new HttpError(404, 'Rule share link is invalid');
    }
    return resolved;
  }

  async getState(rawToken: string): Promise<RuleShareState> {
    const resolved = await this.resolve(rawToken);
    const bundle = await this.getDiagramTypeBundle(resolved.diagramType.owner_user_id!, resolved.diagramType.id);
    return { ...bundle, access: this.access() };
  }

  async accept(rawToken: string, userId: string | null | undefined): Promise<RuleShareState> {
    if (!userId) {
      throw new HttpError(401, 'Authentication required', { code: 'rule_share_login_required' });
    }
    const resolved = await this.resolve(rawToken);
    await this.shares.grantAccess({
      diagramTypeId: resolved.diagramType.id,
      userId,
      tokenId: resolved.token.id,
    });
    const bundle = await this.getDiagramTypeBundle(resolved.diagramType.owner_user_id!, resolved.diagramType.id);
    return { ...bundle, access: this.access() };
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
