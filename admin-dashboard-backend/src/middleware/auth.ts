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

/**
 * Resolves the effective permission list for the authenticated admin.
 * Role permissions win over the admin's own permissions when a role is set.
 */
export async function resolveAdminPermissions(req: Request): Promise<string[]> {
  const admin = req.currentAdmin;
  const roleId = typeof admin?.roleId === 'string' ? admin.roleId : '';
  const role = roleId
    ? await models.roles.findOne({ id: roleId }).lean<LooseDocument | null>()
    : null;

  if (Array.isArray(role?.permissions)) return role.permissions.map(String);
  if (Array.isArray(admin?.permissions)) return admin.permissions.map(String);
  return [];
}

export function adminHasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes('*') || permissions.includes(permission);
}

/** Convenience check for route-level, request-specific permission decisions. */
export async function hasPermission(req: Request, permission: string): Promise<boolean> {
  return adminHasPermission(await resolveAdminPermissions(req), permission);
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = await resolveAdminPermissions(req);

      if (adminHasPermission(permissions, permission)) {
        next();
        return;
      }

      res.status(403).json({ message: `Forbidden: ${permission} permission required.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ message });
    }
  };
}
