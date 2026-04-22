import type { Request, Response } from 'express';
import { clearSessionCookie, setSessionCookie } from '../auth/session.js';
import { AuthService } from '../services/authService.js';

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

export class AuthController {
  private service: AuthService;

  constructor(service: AuthService) {
    this.service = service;
  }

  register = async (req: Request, res: Response) => {
    if (!isObject(req.body)) {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const result = await this.service.register({
      email: typeof req.body.email === 'string' ? req.body.email : '',
      password: typeof req.body.password === 'string' ? req.body.password : '',
      display_name: typeof req.body.display_name === 'string' ? req.body.display_name : null,
    });

    setSessionCookie(res, result.token, result.expiresAt);
    return res.status(201).json({ user: result.user });
  };

  login = async (req: Request, res: Response) => {
    if (!isObject(req.body)) {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const result = await this.service.login({
      email: typeof req.body.email === 'string' ? req.body.email : '',
      password: typeof req.body.password === 'string' ? req.body.password : '',
    });

    setSessionCookie(res, result.token, result.expiresAt);
    return res.json({ user: result.user });
  };

  me = async (req: Request, res: Response) => {
    return res.json({ user: req.user });
  };

  logout = async (req: Request, res: Response) => {
    await this.service.logout(req.sessionToken);
    clearSessionCookie(res);
    return res.json({ success: true });
  };
}
