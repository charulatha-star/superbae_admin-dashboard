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
 * Test script to verify authentication middleware on /users/:id/overview and /users/:id/security
 *
 * This script:
 * 1. Creates a test user and test data
 * 2. Creates a test admin session (for valid token test)
 * 3. Starts the server on PORT 3004
 * 4. Runs automated tests against the endpoints
 * 5. Reports actual HTTP status codes
 */
const TEST_USER_ID = 'auth_test_user';
const TEST_ADMIN_ID = 'test_admin_001';
const TEST_PORT = 3004;
let server = null;
async function createTestData() {
    await (0, db_1.connectDB)();
    // Create test admin for valid token
    const existingAdmin = await registry_1.models.admins.findOne({ id: TEST_ADMIN_ID }).lean();
    if (!existingAdmin) {
        await registry_1.models.admins.create({
            id: TEST_ADMIN_ID,
            name: 'Test Admin',
            email: 'testadmin@example.com',
            password: 'test123',
            roleId: 'role_admin',
            status: 'active',
            twoFactorEnabled: false,
        });
        console.log('✓ Created test admin:', TEST_ADMIN_ID);
    }
    // Create a valid session token for testing
    const testToken = 'test_token_' + Date.now();
    await registry_1.models.adminSessions.create({
        id: 'session_test_' + Date.now(),
        adminId: TEST_ADMIN_ID,
        token: testToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        revokedAt: null,
    });
    // Create test user
    const existingUser = await registry_1.models.users.findOne({ id: TEST_USER_ID }).lean();
    if (!existingUser) {
        await registry_1.models.users.create({
            id: TEST_USER_ID,
            name: 'Auth Test User',
            phone: '+1111111111',
            status: 'active',
            plan: 'free',
            joinedAt: new Date(),
            lastSeen: new Date(),
            posts: 5,
            groups: 3,
        });
        console.log('✓ Created test user:', TEST_USER_ID);
    }
    // Create test sessions
    const existingSessions = await registry_1.models.sessions.countDocuments({ userId: TEST_USER_ID });
    if (existingSessions === 0) {
        await registry_1.models.sessions.insertMany([
            { id: 'sess_001', userId: TEST_USER_ID, device: 'Web', ipAddress: '192.168.1.1', lastActiveAt: new Date() },
        ]);
        console.log('✓ Created test session');
    }
    // Create test login history
    const existingLogins = await registry_1.models.loginHistory.countDocuments({ userId: TEST_USER_ID });
    if (existingLogins === 0) {
        await registry_1.models.loginHistory.insertMany([
            { id: 'login_001', userId: TEST_USER_ID, loginAt: new Date(), device: 'Web', ipAddress: '192.168.1.1' },
        ]);
        console.log('✓ Created test login history');
    }
    // Create test user activity
    const existingActivity = await registry_1.models.userActivity.countDocuments({ userId: TEST_USER_ID });
    if (existingActivity === 0) {
        await registry_1.models.userActivity.insertMany([
            { id: 'act_001', userId: TEST_USER_ID, action: 'post_created', occurredAt: new Date() },
        ]);
        console.log('✓ Created test user activity');
    }
    return testToken;
}
async function runTests(testToken) {
    const baseUrl = 'http://localhost:' + TEST_PORT;
    console.log('\n' + '='.repeat(70));
    console.log('AUTHENTICATION MIDDLEWARE TEST RESULTS');
    console.log('='.repeat(70));
    // Test 1: /users/:id/overview without Authorization header
    console.log('\nTest 1: GET /users/:id/overview WITHOUT Authorization header');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/overview');
        console.log('  Status:', response.status);
        const body = await response.json();
        console.log('  Body:', JSON.stringify(body));
        if (response.status === 401) {
            console.log('  ✅ PASS: Returns 401 as expected');
        }
        else {
            console.log('  ❌ FAIL: Expected 401, got', response.status);
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    // Test 2: /users/:id/security without Authorization header
    console.log('\nTest 2: GET /users/:id/security WITHOUT Authorization header');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/security');
        console.log('  Status:', response.status);
        const body = await response.json();
        console.log('  Body:', JSON.stringify(body));
        if (response.status === 401) {
            console.log('  ✅ PASS: Returns 401 as expected');
        }
        else {
            console.log('  ❌ FAIL: Expected 401, got', response.status);
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    // Test 3: /users/:id/subscription without Authorization header
    console.log('\nTest 3: GET /users/:id/subscription WITHOUT Authorization header');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/subscription');
        console.log('  Status:', response.status);
        const body = await response.json();
        console.log('  Body:', JSON.stringify(body));
        if (response.status === 401) {
            console.log('  ✅ PASS: Returns 401 as expected');
        }
        else {
            console.log('  ❌ FAIL: Expected 401, got', response.status);
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    // Test 4: /users/:id/overview WITH valid Authorization header
    console.log('\nTest 4: GET /users/:id/overview WITH valid Authorization header');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/overview', {
            headers: { Authorization: 'Bearer ' + testToken },
        });
        console.log('  Status:', response.status);
        const body = await response.json();
        if (response.status === 200) {
            console.log('  ✅ PASS: Returns 200 with data');
            console.log('  Body preview:', JSON.stringify(body, null, 2).substring(0, 500) + '...');
        }
        else {
            console.log('  ❌ FAIL: Expected 200, got', response.status);
            console.log('  Body:', JSON.stringify(body));
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    // Test 5: /users/:id/security WITH valid Authorization header
    console.log('\nTest 5: GET /users/:id/security WITH valid Authorization header');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/security', {
            headers: { Authorization: 'Bearer ' + testToken },
        });
        console.log('  Status:', response.status);
        const body = await response.json();
        if (response.status === 200) {
            console.log('  ✅ PASS: Returns 200 with data');
            console.log('  Body preview:', JSON.stringify(body, null, 2).substring(0, 500) + '...');
        }
        else {
            console.log('  ❌ FAIL: Expected 200, got', response.status);
            console.log('  Body:', JSON.stringify(body));
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    // Test 6: /users/:id/overview WITH invalid Authorization header
    console.log('\nTest 6: GET /users/:id/overview WITH invalid token');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/overview', {
            headers: { Authorization: 'Bearer invalid_token_12345' },
        });
        console.log('  Status:', response.status);
        const body = await response.json();
        console.log('  Body:', JSON.stringify(body));
        if (response.status === 401) {
            console.log('  ✅ PASS: Returns 401 as expected');
        }
        else {
            console.log('  ❌ FAIL: Expected 401, got', response.status);
        }
    }
    catch (error) {
        console.log('  ❌ ERROR:', error);
    }
    console.log('\n' + '='.repeat(70));
    console.log('TESTS COMPLETE');
    console.log('='.repeat(70) + '\n');
}
async function main() {
    console.log('Setting up authentication test...\n');
    const testToken = await createTestData();
    console.log('\nStarting test server on port', TEST_PORT);
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '2mb' }));
    (0, routes_1.registerRoutes)(app);
    server = app.listen(TEST_PORT, async () => {
        console.log('Test server running on http://localhost:' + TEST_PORT);
        console.log('\nRunning authentication tests...\n');
        // Give the server a moment to start
        await new Promise(resolve => setTimeout(resolve, 500));
        await runTests(testToken);
        // Close server after tests
        setTimeout(() => {
            if (server) {
                server.close(() => {
                    console.log('Test server stopped');
                    process.exit(0);
                });
            }
        }, 1000);
    });
    // Graceful shutdown on Ctrl+C
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        if (server) {
            server.close(() => process.exit(0));
        }
    });
}
main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
