import type { AuthContext, AuthenticatedUser } from './types.js';

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
      user: AuthenticatedUser | null;
      sessionToken: string | null;
    }
  }
}

export {};
