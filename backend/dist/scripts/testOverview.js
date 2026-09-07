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
 * Test script for GET /users/:id/overview endpoint
 *
 * This script:
 * 1. Creates a test user (if doesn't exist)
 * 2. Creates some test user activity
 * 3. Starts the server on PORT 3002
 * 4. You can then test: GET http://localhost:3002/users/test_user_123/overview
 */
const TEST_USER_ID = 'test_user_123';
const TEST_PORT = 3002;
async function createTestData() {
    await (0, db_1.connectDB)();
    // Create test user
    const existingUser = await registry_1.models.users.findOne({ id: TEST_USER_ID }).lean();
    if (!existingUser) {
        await registry_1.models.users.create({
            id: TEST_USER_ID,
            name: 'Test User',
            phone: '+1234567890',
            status: 'active',
            plan: 'free',
            joinedAt: new Date('2026-08-01T10:00:00Z'),
            lastSeen: new Date('2026-08-31T12:00:00Z'),
            posts: 15,
            groups: 8,
        });
        console.log('✓ Created test user:', TEST_USER_ID);
    }
    else {
        console.log('✓ Test user already exists:', TEST_USER_ID);
    }
    // Create test user activity
    const existingActivity = await registry_1.models.userActivity.countDocuments({ userId: TEST_USER_ID });
    if (existingActivity === 0) {
        const activities = [
            { id: 'act_001', userId: TEST_USER_ID, action: 'post_created', occurredAt: new Date('2026-08-31T10:30:00Z') },
            { id: 'act_002', userId: TEST_USER_ID, action: 'comment_added', occurredAt: new Date('2026-08-31T09:15:00Z') },
            { id: 'act_003', userId: TEST_USER_ID, action: 'profile_viewed', occurredAt: new Date('2026-08-30T14:22:00Z') },
            { id: 'act_004', userId: TEST_USER_ID, action: 'settings_updated', occurredAt: new Date('2026-08-30T08:05:00Z') },
            { id: 'act_005', userId: TEST_USER_ID, action: 'subscription_renewed', occurredAt: new Date('2026-08-29T16:40:00Z') },
            { id: 'act_006', userId: TEST_USER_ID, action: 'post_created', occurredAt: new Date('2026-08-29T11:10:00Z') },
        ];
        await registry_1.models.userActivity.insertMany(activities);
        console.log('✓ Created test user activity (6 entries)');
    }
    else {
        console.log('✓ Test user activity already exists:', existingActivity, 'entries');
    }
}
async function main() {
    console.log('Setting up test data for GET /users/:id/overview...\n');
    await createTestData();
    console.log('\nStarting test server on port', TEST_PORT);
    console.log('Test endpoint: GET http://localhost:' + TEST_PORT + '/users/' + TEST_USER_ID + '/overview\n');
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '2mb' }));
    (0, routes_1.registerRoutes)(app);
    const server = app.listen(TEST_PORT, () => {
        console.log('Test server running on http://localhost:' + TEST_PORT);
        console.log('\nTry:');
        console.log('  curl http://localhost:' + TEST_PORT + '/users/' + TEST_USER_ID + '/overview');
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
