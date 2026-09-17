"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const routes_1 = require("../routes");
async function request(baseUrl, path, token, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
}
async function testAnonymousModeration() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
    const ids = {
        deniedRole: `test_role_denied_${suffix}`,
        allowedRole: `test_role_allowed_${suffix}`,
        deniedAdmin: `test_admin_denied_${suffix}`,
        allowedAdmin: `test_admin_allowed_${suffix}`,
        deniedSession: `test_session_denied_${suffix}`,
        allowedSession: `test_session_allowed_${suffix}`,
        user: `test_user_${suffix}`,
        post: `test_anonymous_post_${suffix}`,
    };
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    (0, routes_1.registerRoutes)(app);
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Test server did not expose a port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const now = new Date();
    try {
        await registry_1.models.roles.create([
            { id: ids.deniedRole, name: 'Test Denied', permissions: [] },
            { id: ids.allowedRole, name: 'Test Allowed', permissions: ['COMMUNITY_MODERATE'] },
        ]);
        await registry_1.models.admins.create([
            { id: ids.deniedAdmin, name: 'Test Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
            { id: ids.allowedAdmin, name: 'Test Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
        ]);
        await registry_1.models.adminSessions.create([
            { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
            { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        ]);
        await registry_1.models.users.create({ id: ids.user, name: 'Test Anonymous Author', status: 'active' });
        await registry_1.models.anonymousPosts.create({ id: ids.post, content: 'Moderation integration test post', status: 'pending', realAuthorId: ids.user, riskScore: 90 });
        const denied = await request(baseUrl, '/anonymousPosts', ids.deniedSession);
        if (denied.status !== 403)
            throw new Error(`Expected 403 without permission, received ${denied.status}.`);
        const allowed = await request(baseUrl, `/anonymousPosts?search=${encodeURIComponent('integration test')}`, ids.allowedSession);
        if (allowed.status !== 200)
            throw new Error(`Expected 200 with permission, received ${allowed.status}.`);
        const action = await request(baseUrl, `/anonymousPosts/${ids.post}/action`, ids.allowedSession, {
            method: 'POST',
            body: JSON.stringify({ action: 'suspend', reason: 'Integration test moderation action' }),
        });
        if (action.status !== 200)
            throw new Error(`Expected action 200, received ${action.status}.`);
        const auditLogs = await registry_1.models.auditLogs.find({ targetId: { $in: [ids.post, ids.user] } }).lean();
        if (auditLogs.length < 2)
            throw new Error(`Expected at least two audit logs, found ${auditLogs.length}.`);
        console.log('Anonymous moderation integration test passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.auditLogs.deleteMany({ targetId: { $in: [ids.post, ids.user] } }),
            registry_1.models.anonymousPosts.deleteMany({ id: ids.post }),
            registry_1.models.users.deleteMany({ id: ids.user }),
            registry_1.models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
            registry_1.models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
            registry_1.models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
        ]);
        await server.close();
    }
}
testAnonymousModeration().catch((error) => {
    console.error('Anonymous moderation integration test failed:', error);
    process.exitCode = 1;
});
