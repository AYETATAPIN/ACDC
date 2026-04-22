import type { NextFunction, Request, Response } from 'express';
import { buildAnonymousContext } from '../auth/accessPolicy.js';
import { parseCookies } from '../auth/session.js';
import { config } from '../config.js';
import { HttpError } from './errorHandler.js';
import { AuthService } from '../services/authService.js';

export const attachAuthContext =
  (authService: AuthService) => async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies[config.auth.sessionCookieName] ?? null;
      const user = await authService.getUserBySessionToken(sessionToken);

      req.sessionToken = sessionToken;
      req.user = user;
      req.auth = user
        ? {
            userId: user.id,
            isAuthenticated: true,
          }
        : buildAnonymousContext();

      next();
    } catch (error) {
      next(error);
    }
  };

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.auth?.isAuthenticated || !req.auth.userId) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  next();
};
