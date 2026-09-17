"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.resolveAdminPermissions = resolveAdminPermissions;
exports.adminHasPermission = adminHasPermission;
exports.hasPermission = hasPermission;
exports.requirePermission = requirePermission;
const registry_1 = require("../models/registry");
/**
 * Middleware to check if an admin is authenticated via session.
 * If authenticated, attaches currentAdmin to req.currentAdmin.
 * If not authenticated, returns 401 Unauthorized.
 */
async function requireAuth(req, res, next) {
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
        const session = await registry_1.models.adminSessions
            .findOne({
            token,
            revokedAt: null,
            expiresAt: { $gt: now },
        })
            .lean();
        if (!session || !session.adminId) {
            res.status(401).json({ message: 'Unauthorized: No active session.' });
            return;
        }
        const admin = await registry_1.models.admins.findOne({ id: session.adminId }).lean();
        if (!admin) {
            res.status(401).json({ message: 'Unauthorized: Admin not found.' });
            return;
        }
        req.currentAdmin = admin;
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        res.status(500).json({ message });
    }
}
/**
 * Resolves the effective permission list for the authenticated admin.
 * Role permissions win over the admin's own permissions when a role is set.
 */
async function resolveAdminPermissions(req) {
    const admin = req.currentAdmin;
    const roleId = typeof admin?.roleId === 'string' ? admin.roleId : '';
    const role = roleId
        ? await registry_1.models.roles.findOne({ id: roleId }).lean()
        : null;
    if (Array.isArray(role?.permissions))
        return role.permissions.map(String);
    if (Array.isArray(admin?.permissions))
        return admin.permissions.map(String);
    return [];
}
function adminHasPermission(permissions, permission) {
    return permissions.includes('*') || permissions.includes(permission);
}
/** Convenience check for route-level, request-specific permission decisions. */
async function hasPermission(req, permission) {
    return adminHasPermission(await resolveAdminPermissions(req), permission);
}
function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            const permissions = await resolveAdminPermissions(req);
            if (adminHasPermission(permissions, permission)) {
                next();
                return;
            }
            res.status(403).json({ message: `Forbidden: ${permission} permission required.` });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ message });
        }
    };
}
