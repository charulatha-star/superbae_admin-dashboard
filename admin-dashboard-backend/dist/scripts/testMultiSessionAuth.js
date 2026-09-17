"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
async function main() {
    await (0, db_1.connectDB)();
    const testEmail = 'multi.session@test.local';
    const testPassword = 'pass123';
    const existing = await registry_1.models.admins.findOne({ email: testEmail }).lean();
    if (!existing) {
        await registry_1.models.admins.create({
            id: 'admin_multi_session_test',
            name: 'Multi Session Test',
            email: testEmail,
            password: testPassword,
            roleId: 'role_super_admin',
            status: 'active',
            twoFactorEnabled: false,
            createdAt: new Date().toISOString(),
            lastLoginAt: null,
        });
    }
    const sessionOne = {
        adminId: 'admin_multi_session_test',
        token: 'multi_session_token_1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: null,
    };
    const sessionTwo = {
        adminId: 'admin_multi_session_test',
        token: 'multi_session_token_2',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: null,
    };
    await registry_1.models.adminSessions.deleteMany({ adminId: 'admin_multi_session_test' });
    await registry_1.models.adminSessions.create(sessionOne);
    await registry_1.models.adminSessions.create(sessionTwo);
    const activeSessions = await registry_1.models.adminSessions
        .find({ adminId: 'admin_multi_session_test', revokedAt: null, expiresAt: { $gt: new Date() } })
        .lean();
    console.log('activeSessions', activeSessions.length, activeSessions.map((s) => s.token));
    if (activeSessions.length !== 2) {
        throw new Error(`Expected 2 active sessions, found ${activeSessions.length}`);
    }
    console.log('Multi-session auth test passed: both tokens are active simultaneously.');
    process.exit(0);
}
main().catch((error) => {
    console.error('Multi-session auth test failed:', error);
    process.exit(1);
});
