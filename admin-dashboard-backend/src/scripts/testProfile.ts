import 'dotenv/config';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../routes';
import http from 'http';

/**
 * Test script for GET /users/:id/profile endpoint
 * 
 * Creates:
 * - A test user with partial profile data
 * Starts server on PORT 3005
 * Test: GET http://localhost:3005/users/test_user_789/profile
 */

const TEST_USER_ID = 'test_user_789';
const TEST_ADMIN_ID = 'test_admin_002';
const TEST_PORT = 3005;

let server: http.Server | null = null;

async function createTestData(): Promise<string> {
  await connectDB();

  // Create test admin for valid token
  const existingAdmin = await models.admins.findOne({ id: TEST_ADMIN_ID }).lean();
  if (!existingAdmin) {
    await models.admins.create({
      id: TEST_ADMIN_ID,
      name: 'Test Admin 2',
      email: 'testadmin2@example.com',
      password: 'test123',
      roleId: 'role_admin',
      status: 'active',
      twoFactorEnabled: false,
    });
    console.log('✓ Created test admin:', TEST_ADMIN_ID);
  }

  // Create a valid session token for testing
  const testToken = 'test_token_profile_' + Date.now();
  await models.adminSessions.create({
    id: 'session_profile_' + Date.now(),
    adminId: TEST_ADMIN_ID,
    token: testToken,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
  });

  // Create test user with partial profile data
  const existingUser = await models.users.findOne({ id: TEST_USER_ID }).lean();
  if (!existingUser) {
    await models.users.create({
      id: TEST_USER_ID,
      name: 'Profile Test User',
      phone: '+1555123456',
      status: 'active',
      plan: 'free',
      joinedAt: new Date('2026-08-01T10:00:00Z'),
      lastSeen: new Date('2026-08-31T14:00:00Z'),
      posts: 10,
      groups: 5,
      // Profile fields
      bio: 'I love traveling and meeting new people!',
      interests: ['travel', 'photography'],
      thingsILove: [],  // Empty array
      zodiac: 'Leo',
    });
    console.log('✓ Created test user with profile data:', TEST_USER_ID);
    console.log('  bio: "I love traveling..."');
    console.log('  interests: ["travel", "photography"]');
    console.log('  thingsILove: [] (empty)');
    console.log('  zodiac: "Leo"');
    console.log('  Expected profileCompletion: 75% (3 out of 4 fields filled)');
  } else {
    console.log('✓ Test user already exists:', TEST_USER_ID);
  }

  return testToken;
}

async function runTests(testToken: string): Promise<void> {
  const baseUrl = 'http://localhost:' + TEST_PORT;
  
  console.log('\n' + '='.repeat(70));
  console.log('PROFILE TAB TEST RESULTS');
  console.log('='.repeat(70));

  // Test 1: WITHOUT Authorization header (should be blocked)
  console.log('\nTest 1: GET /users/:id/profile WITHOUT Authorization header');
  try {
    const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/profile');
    console.log('  Status:', response.status);
    const body = await response.json();
    console.log('  Body:', JSON.stringify(body));
    if (response.status === 401) {
      console.log('  ✅ PASS: Returns 401 (authentication required)');
    } else {
      console.log('  ❌ FAIL: Expected 401, got', response.status);
    }
  } catch (error) {
    console.log('  ❌ ERROR:', error);
  }

  // Test 2: WITH valid Authorization header
  console.log('\nTest 2: GET /users/:id/profile WITH valid Authorization header');
  try {
    const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/profile', {
      headers: { Authorization: 'Bearer ' + testToken },
    });
    console.log('  Status:', response.status);
    const body = await response.json();
    if (response.status === 200) {
      console.log('  ✅ PASS: Returns 200 with data');
      console.log('\n  Full response:');
      console.log(JSON.stringify(body, null, 2));
      
      // Verify profile completion
      if (body.profileCompletion === 75) {
        console.log('\n  ✅ Profile completion calculated correctly: 75%');
      } else {
        console.log('\n  ❌ Profile completion incorrect. Expected 75%, got:', body.profileCompletion);
      }
    } else {
      console.log('  ❌ FAIL: Expected 200, got', response.status);
      console.log('  Body:', JSON.stringify(body));
    }
  } catch (error) {
    console.log('  ❌ ERROR:', error);
  }

  // Test 3: WITH invalid token
  console.log('\nTest 3: GET /users/:id/profile WITH invalid token');
  try {
    const response = await fetch(baseUrl + '/users/' + TEST_USER_ID + '/profile', {
      headers: { Authorization: 'Bearer invalid_token_xyz' },
    });
    console.log('  Status:', response.status);
    const body = await response.json();
    console.log('  Body:', JSON.stringify(body));
    if (response.status === 401) {
      console.log('  ✅ PASS: Returns 401 as expected');
    } else {
      console.log('  ❌ FAIL: Expected 401, got', response.status);
    }
  } catch (error) {
    console.log('  ❌ ERROR:', error);
  }

  console.log('\n' + '='.repeat(70));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(70) + '\n');
}

async function main(): Promise<void> {
  console.log('Setting up profile test data...\n');

  const testToken = await createTestData();

  console.log('\nStarting test server on port', TEST_PORT);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  registerRoutes(app);

  server = app.listen(TEST_PORT, async () => {
    console.log('Test server running on http://localhost:' + TEST_PORT);
    console.log('\nRunning profile tests...\n');

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
