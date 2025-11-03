import { NextFunction, Request, Response } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateUUIDParam = (paramName: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid UUID' });
    }
    return next();
  };

