import type { AccessPolicy, AuthContext } from '../types.js';

export const buildAnonymousContext = (): AuthContext => ({
  userId: null,
  isAuthenticated: false,
});

export class AccessPolicyService {
  resolveForDiagram(_auth: AuthContext, _ownerUserId: string | null): AccessPolicy {
    // Stage 2 scaffold: anonymous allow policy.
    return {
      canRead: true,
      canWrite: true,
      canShare: true,
    };
  }
}
