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
const TEST_USER_ID = 'sub_test_user_no_data';
const TEST_ADMIN_ID = 'test_admin_nodata';
const TEST_PORT = 3006;
let server = null;
async function createTestData() {
    await (0, db_1.connectDB)();
    // Create test admin for valid token
    const existingAdmin = await registry_1.models.admins.findOne({ id: TEST_ADMIN_ID }).lean();
    if (!existingAdmin) {
        await registry_1.models.admins.create({
            id: TEST_ADMIN_ID,
            name: 'Test Admin NoData',
            email: 'testadminnodata@example.com',
            password: 'test123',
            roleId: 'role_admin',
            status: 'active',
            twoFactorEnabled: false,
        });
        console.log('✓ Created test admin:', TEST_ADMIN_ID);
    }
    // Create a valid session token for testing
    const testToken = 'test_token_nodata_' + Date.now();
    await registry_1.models.adminSessions.create({
        id: 'session_nodata_' + Date.now(),
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
            name: 'No Data Test User',
            phone: '+1111111113',
            status: 'active',
            plan: 'free',
            joinedAt: new Date(),
            lastSeen: new Date(),
            posts: 0,
            groups: 0,
        });
        console.log('✓ Created test user:', TEST_USER_ID);
    }
    // Create test subscription WITHOUT payments or plan changes
    const existingSubscription = await registry_1.models.subscriptions.findOne({ userId: TEST_USER_ID }).lean();
    if (!existingSubscription) {
        await registry_1.models.subscriptions.findOneAndUpdate({ id: 'sub_nodata_001' }, {
            $set: {
                userId: TEST_USER_ID,
                plan: 'free',
                status: 'active',
                startDate: new Date('2026-01-01T00:00:00Z'),
                nextBillingDate: null,
                amount: 0,
            }
        }, { upsert: true });
        console.log('✓ Created test subscription (no payments, no plan changes)');
    }
    return testToken;
}
async function runTest(testToken) {
    const baseUrl = 'http://localhost:' + TEST_PORT;
    console.log('\n' + '='.repeat(70));
    console.log('SUBSCRIPTION ENDPOINT TEST - NO PAYMENTS/PLAN CHANGES');
    console.log('='.repeat(70));
    // Test with valid Authorization header
    console.log('\nTest: GET /users/' + TEST_USER_ID + '/subscription WITH valid token');
    try {
        const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/subscription', {
            headers: { Authorization: 'Bearer ' + testToken },
        });
        console.log('  Status:', response.status);
        const body = await response.json();
        console.log('\n  Response:');
        console.log(JSON.stringify(body, null, 2));
        if (response.status === 200) {
            console.log('\n  ✅ PASS: Returns 200 with subscription data');
            // Validate response structure
            const hasSubscriptionFields = body.plan && body.status && body.startDate !== undefined;
            const hasPaymentHistory = body.paymentHistory !== undefined;
            const hasPlanChanges = body.planChanges !== undefined;
            console.log('\n  Validation:');
            console.log('    - Has subscription fields:', hasSubscriptionFields ? '✅' : '❌');
            console.log('    - Has paymentHistory:', hasPaymentHistory ? '✅' : '❌');
            console.log('    - paymentHistory is null:', body.paymentHistory === null ? '✅' : '❌');
            console.log('    - Has planChanges:', hasPlanChanges ? '✅' : '❌');
            console.log('    - planChanges is null:', body.planChanges === null ? '✅' : '❌');
        }
        else {
            console.log('\n  ❌ FAIL: Expected 200, got', response.status);
        }
    }
    catch (error) {
        console.log('\n  ❌ ERROR:', error);
    }
    console.log('\n' + '='.repeat(70));
    console.log('TEST COMPLETE');
    console.log('='.repeat(70) + '\n');
}
async function main() {
    console.log('Setting up subscription endpoint test (no data)...\n');
    const testToken = await createTestData();
    console.log('\nStarting test server on port', TEST_PORT);
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '2mb' }));
    (0, routes_1.registerRoutes)(app);
    server = app.listen(TEST_PORT, async () => {
        console.log('Test server running on http://localhost:' + TEST_PORT);
        console.log('\nRunning subscription endpoint test...\n');
        // Give the server a moment to start
        await new Promise(resolve => setTimeout(resolve, 500));
        await runTest(testToken);
        // Close server after tests
        setTimeout(() => {
            if (server) {
                server.close(() => {
                    console.log('Test server stopped');
                    process.exit(0);
                });
            }
        }, 2000);
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
