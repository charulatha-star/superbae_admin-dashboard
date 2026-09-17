"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("../routes");
/**
 * Test script for GET /users/:id/security endpoint
 *
 * Creates:
 * - A test user
 * - Test sessions (devices)
 * - Test login history
 *
 * Starts server on PORT 3003
 * Test: GET http://localhost:3003/users/test_user_456/security
 */
const TEST_USER_ID = 'test_user_456';
const TEST_PORT = 3003;
async function createTestData() {
    await (0, db_1.connectDB)();
    // Create test user
    const existingUser = await registry_1.models.users.findOne({ id: TEST_USER_ID }).lean();
    if (!existingUser) {
        await registry_1.models.users.create({
            id: TEST_USER_ID,
            name: 'Security Test User',
            phone: '+1987654321',
            status: 'active',
            plan: 'premium',
            joinedAt: new Date('2026-07-15T08:00:00Z'),
            lastSeen: new Date('2026-08-31T14:00:00Z'),
            posts: 25,
            groups: 12,
        });
        console.log('✓ Created test user:', TEST_USER_ID);
    }
    else {
        console.log('✓ Test user already exists:', TEST_USER_ID);
    }
    // Create test sessions (devices)
    const existingSessions = await registry_1.models.sessions.countDocuments({ userId: TEST_USER_ID });
    if (existingSessions === 0) {
        const sessions = [
            { id: 'session_001', userId: TEST_USER_ID, device: 'iOS App', ipAddress: '192.168.1.10', lastActiveAt: new Date('2026-08-31T14:30:00Z') },
            { id: 'session_002', userId: TEST_USER_ID, device: 'Android App', ipAddress: '192.168.1.15', lastActiveAt: new Date('2026-08-31T10:15:00Z') },
            { id: 'session_003', userId: TEST_USER_ID, device: 'Web', ipAddress: '192.168.1.20', lastActiveAt: new Date('2026-08-30T18:45:00Z') },
        ];
        await registry_1.models.sessions.insertMany(sessions);
        console.log('✓ Created test sessions (3 entries)');
    }
    else {
        console.log('✓ Test sessions already exist:', existingSessions, 'entries');
    }
    // Create test login history
    const existingLogins = await registry_1.models.loginHistory.countDocuments({ userId: TEST_USER_ID });
    if (existingLogins === 0) {
        const logins = [
            { id: 'login_001', userId: TEST_USER_ID, loginAt: new Date('2026-08-31T14:30:00Z'), device: 'iOS App', ipAddress: '192.168.1.10' },
            { id: 'login_002', userId: TEST_USER_ID, loginAt: new Date('2026-08-31T10:15:00Z'), device: 'Android App', ipAddress: '192.168.1.15' },
            { id: 'login_003', userId: TEST_USER_ID, loginAt: new Date('2026-08-31T08:00:00Z'), device: 'Web', ipAddress: '192.168.1.20' },
            { id: 'login_004', userId: TEST_USER_ID, loginAt: new Date('2026-08-30T22:30:00Z'), device: 'iOS App', ipAddress: '192.168.1.10' },
            { id: 'login_005', userId: TEST_USER_ID, loginAt: new Date('2026-08-30T18:45:00Z'), device: 'Web', ipAddress: '192.168.1.25' },
            { id: 'login_006', userId: TEST_USER_ID, loginAt: new Date('2026-08-30T10:00:00Z'), device: 'Android App', ipAddress: '192.168.1.30' },
            { id: 'login_007', userId: TEST_USER_ID, loginAt: new Date('2026-08-29T14:00:00Z'), device: 'iOS App', ipAddress: '192.168.1.10' },
            { id: 'login_008', userId: TEST_USER_ID, loginAt: new Date('2026-08-29T09:30:00Z'), device: 'Web', ipAddress: '192.168.1.20' },
            { id: 'login_009', userId: TEST_USER_ID, loginAt: new Date('2026-08-28T16:00:00Z'), device: 'Android App', ipAddress: '192.168.1.15' },
            { id: 'login_010', userId: TEST_USER_ID, loginAt: new Date('2026-08-28T11:00:00Z'), device: 'iOS App', ipAddress: '192.168.1.10' },
            { id: 'login_011', userId: TEST_USER_ID, loginAt: new Date('2026-08-27T15:00:00Z'), device: 'Web', ipAddress: '192.168.1.20' },
        ];
        await registry_1.models.loginHistory.insertMany(logins);
        console.log('✓ Created test login history (11 entries, will return last 10)');
    }
    else {
        console.log('✓ Test login history already exists:', existingLogins, 'entries');
    }
}
async function main() {
    console.log('Setting up test data for GET /users/:id/security...\n');
    await createTestData();
    console.log('\nStarting test server on port', TEST_PORT);
    console.log('Test endpoint: GET http://localhost:' + TEST_PORT + '/users/' + TEST_USER_ID + '/security\n');
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '2mb' }));
    (0, routes_1.registerRoutes)(app);
    const server = app.listen(TEST_PORT, () => {
        console.log('Test server running on http://localhost:' + TEST_PORT);
        console.log('\nTry:');
        console.log('  curl http://localhost:' + TEST_PORT + '/users/' + TEST_USER_ID + '/security');
        console.log('\nPress Ctrl+C to stop the server\n');
    });
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down test server...');
        server.close(() => {
            console.log('Server stopped');
            process.exit(0);
        });
    });
}
main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
