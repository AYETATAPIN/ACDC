import { Request, Response } from 'express';
import { DiagramTypeShareService } from '../services/diagramTypeShareService.js';
import { HttpError } from '../middleware/errorHandler.js';

export class DiagramTypeShareController {
  private shares: DiagramTypeShareService;

  constructor(shares: DiagramTypeShareService) {
    this.shares = shares;
  }

  private origin(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }

  listOwnerShares = async (req: Request, res: Response) => {
    const result = await this.shares.listForOwner(req.auth.userId!, req.params.id);
    return res.json(result);
  };

  createOwnerShare = async (req: Request, res: Response) => {
    if (req.params.permission !== 'read') {
      return res.status(400).json({ error: 'permission must be read' });
    }
    const result = await this.shares.createForOwner(req.auth.userId!, req.params.id, this.origin(req));
    return res.status(result.token ? 201 : 200).json(result);
  };

  rotateOwnerShare = async (req: Request, res: Response) => {
    if (req.params.permission !== 'read') {
      return res.status(400).json({ error: 'permission must be read' });
    }
    const result = await this.shares.rotateForOwner(req.auth.userId!, req.params.id, this.origin(req));
    return res.status(201).json(result);
  };

  state = async (req: Request, res: Response) => {
    const result = await this.shares.getState(req.params.token);
    return res.json(result);
  };

  accept = async (req: Request, res: Response) => {
    if (!req.auth?.isAuthenticated || !req.auth.userId) {
      throw new HttpError(401, 'Authentication required', { code: 'rule_share_login_required' });
    }
    const result = await this.shares.accept(req.params.token, req.auth.userId);
    return res.json(result);
  };
}
