import { Request, Response, NextFunction } from 'express';
import { models, LooseDocument } from '../models/registry';

declare global {
  namespace Express {
    interface Request {
      currentAdmin?: LooseDocument | null;
    }
  }
}

/**
 * Middleware to check if an admin is authenticated via session.
 * If authenticated, attaches currentAdmin to req.currentAdmin.
 * If not authenticated, returns 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authorization = req.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Unauthorized: Bearer token required.' });
      return;
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ message: 'Unauthorized: Bearer token required.' });
      return;
    }

    const now = new Date();
    const session = await models.adminSessions
      .findOne({
        token,
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      .lean<LooseDocument | null>();

    if (!session || !session.adminId) {
      res.status(401).json({ message: 'Unauthorized: No active session.' });
      return;
    }

    const admin = await models.admins.findOne({ id: session.adminId }).lean<LooseDocument | null>();

    if (!admin) {
      res.status(401).json({ message: 'Unauthorized: Admin not found.' });
      return;
    }

    req.currentAdmin = admin;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(500).json({ message });
  }
}
