"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
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
