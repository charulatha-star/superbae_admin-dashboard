import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import * as firebaseAdmin from 'firebase-admin';
import { connectDB } from '../config/db';
import { registerRoutes } from '../routes';
import { DeviceTokenModel } from '../models/deviceToken';
import {
  DeviceTokenInputError,
  deactivateAllDeviceTokens,
  deactivateDeviceToken,
  listActiveDeviceTokens,
  registerDeviceToken,
} from '../services/deviceTokens';
import {
  FirebaseConfigError,
  FIREBASE_SERVICE_ACCOUNT_ENV_VAR,
  getFirebaseAdminApp,
  getFirebaseMessaging,
  getFirebaseProjectId,
  loadServiceAccountCredential,
  resetFirebaseAdminCacheForTests,
  resolveFirebaseCredentialPath,
} from '../services/firebaseAdmin';

/**
 * Step 3 verification: Firebase Admin bootstrap + device-token foundation.
 * Ephemeral express server + synthetic tokens only (never real FCM tokens,
 * never any send call). Verifies: single init / no duplicate apps, clear
 * config errors, model+service behavior (upsert, lastSeenAt, reactivation,
 * deactivation), that NO device-token HTTP endpoint is exposed without
 * mobile-user auth, and that no device-token data is left behind.
 */

function expect(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  console.log(`  PASS  ${label}`);
}

function assertOk(label: string, condition: unknown, detail = ''): void {
  if (!condition) throw new Error(`${label} failed.${detail ? ` ${detail}` : ''}`);
  console.log(`  PASS  ${label}`);
}

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const testUserIdA = `tusr_a_${suffix}`;
  const testUserIdB = `tusr_b_${suffix}`;
  const fakeToken1 = `test:fcm:synthetic_a_${suffix}_0123456789abcdef`;
  const fakeToken2 = `test:fcm:synthetic_b_${suffix}_0123456789abcdef`;
  const createdTokens: string[] = [fakeToken1, fakeToken2];

  const beforeCount = await DeviceTokenModel.countDocuments();
  console.log(`--- deviceTokens before: ${beforeCount} doc(s) ---`);

  console.log('--- firebase admin init ---');
  const app = getFirebaseAdminApp();
  expect('init succeeds (app name superbae-admin)', app.name, 'superbae-admin');
  const again = getFirebaseAdminApp();
  assertOk('second call returns same cached app instance', again === app);
  const registered = firebaseAdmin.getApps().filter((a) => a.name === 'superbae-admin');
  expect('no duplicate firebase apps registered', registered.length, 1);
  const projectId = getFirebaseProjectId();
  assertOk('project id is a non-empty non-secret identifier', typeof projectId === 'string' && projectId.length > 0);
  const messaging = getFirebaseMessaging();
  expect('messaging accessor bound to the same app', messaging.app.name, 'superbae-admin');

  const third = (() => {
    resetFirebaseAdminCacheForTests();
    return getFirebaseAdminApp();
  })();
  assertOk('after cache reset, app-list guard reuses the same app', third === app);
  expect(
    'still exactly one firebase app after reset+reinit',
    firebaseAdmin.getApps().filter((a) => a.name === 'superbae-admin').length,
    1
  );

  console.log('--- firebase config errors ---');
  const savedEnv = process.env[FIREBASE_SERVICE_ACCOUNT_ENV_VAR];
  try {
    delete process.env[FIREBASE_SERVICE_ACCOUNT_ENV_VAR];
    try {
      resolveFirebaseCredentialPath();
      throw new Error('resolver unexpectedly succeeded without env var.');
    } catch (error) {
      assertOk(
        'missing env var -> FirebaseConfigError naming the variable',
        error instanceof FirebaseConfigError && error.message.includes(FIREBASE_SERVICE_ACCOUNT_ENV_VAR),
        error instanceof Error ? error.message : 'wrong error type'
      );
    }
    const bogusPath = `./secrets/does-not-exist-${suffix}.json`;
    try {
      loadServiceAccountCredential(require('path').resolve(require('path').resolve(__dirname, '..', '..'), bogusPath));
      throw new Error('loader unexpectedly succeeded for a missing file.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      assertOk(
        'missing file -> clear error without leaking contents',
        error instanceof FirebaseConfigError && message.includes('missing or unreadable') && !message.includes('{') && !message.includes('BEGIN PRIVATE KEY'),
        message.split('\n')[0]
      );
    }
  } finally {
    if (savedEnv !== undefined) process.env[FIREBASE_SERVICE_ACCOUNT_ENV_VAR] = savedEnv;
  }

  // Everything below runs inside try/finally so synthetic tokens created by
  // this run are removed per-record (deleteOne) even when a test fails.
  try {
  console.log('--- device token validation ---');
  try {
    await registerDeviceToken('', fakeToken1, 'android');
    throw new Error('empty userId unexpectedly accepted.');
  } catch (error) {
    assertOk('empty userId rejected', error instanceof DeviceTokenInputError, error instanceof Error ? error.message : '');
  }
  try {
    await registerDeviceToken(testUserIdA, 'short', 'android');
    throw new Error('short token unexpectedly accepted.');
  } catch (error) {
    assertOk('short/invalid token rejected', error instanceof DeviceTokenInputError, error instanceof Error ? error.message : '');
  }
  try {
    await registerDeviceToken(testUserIdA, fakeToken1, 'web');
    throw new Error('invalid platform unexpectedly accepted.');
  } catch (error) {
    assertOk('invalid platform rejected', error instanceof DeviceTokenInputError, error instanceof Error ? error.message : '');
  }

  console.log('--- device token register / duplicate / lastSeenAt ---');
  const first = await registerDeviceToken(testUserIdA, fakeToken1, 'android');
  assertOk('create returns id with deviceToken_ prefix', String(first.id).startsWith('deviceToken_'));
  assertOk('userId comes from the server-side parameter', String(first.userId) === testUserIdA);
  expect('platform stored', String(first.platform), 'android');
  expect('isActive defaults to true', first.isActive === true, true);
  assertOk('lastSeenAt set on create', first.lastSeenAt instanceof Date || Boolean(first.lastSeenAt));
  const firstSeen = new Date(String(first.lastSeenAt)).getTime();
  expect('token count after first registration', await DeviceTokenModel.countDocuments({ token: fakeToken1 }), 1);

  await new Promise((resolve) => setTimeout(resolve, 60));
  const second = await registerDeviceToken(testUserIdA, fakeToken1, 'android');
  expect('re-registration reuses the same record', String(second.id), String(first.id));
  expect('still exactly one record for the token', await DeviceTokenModel.countDocuments({ token: fakeToken1 }), 1);
  const secondSeen = new Date(String(second.lastSeenAt)).getTime();
  assertOk('lastSeenAt bumped on re-registration', secondSeen > firstSeen, `${secondSeen} vs ${firstSeen}`);
  expect('re-registration keeps isActive true', second.isActive === true, true);

  console.log('--- token migration / deactivation / reactivation ---');
  const migrated = await registerDeviceToken(testUserIdB, fakeToken1, 'ios');
  expect('same token re-registered by another user updates userId', String(migrated.userId), testUserIdB);
  expect('platform updated', String(migrated.platform), 'ios');
  expect('still one record, no duplicate', await DeviceTokenModel.countDocuments({ token: fakeToken1 }), 1);

  await registerDeviceToken(testUserIdA, fakeToken2, 'ios');
  expect('second token record created', await DeviceTokenModel.countDocuments({ token: fakeToken2 }), 1);
  const deactivated = await deactivateDeviceToken(testUserIdA, fakeToken2);
  assertOk('deactivate found the pair', deactivated !== null && deactivated.isActive === false);
  expect('active list for user A excludes deactivated token', (await listActiveDeviceTokens(testUserIdA)).length, 0);
  expect('active list for user B still has the migrated token', (await listActiveDeviceTokens(testUserIdB)).length, 1);
  const reactivated = await registerDeviceToken(testUserIdA, fakeToken2, 'android');
  expect('re-registration reactivates the token', reactivated.isActive === true, true);
  expect('active list for user A sees the reactivated token', (await listActiveDeviceTokens(testUserIdA)).length, 1);

  const deactivateAllResult = await deactivateAllDeviceTokens(testUserIdA);
  assertOk("deactivateAll matched the user's active token", deactivateAllResult.modifiedCount >= 1);
  expect('user A has no active tokens after deactivateAll', (await listActiveDeviceTokens(testUserIdA)).length, 0);
  expect('unknown-user deactivateAll is a no-op', (await deactivateAllDeviceTokens(`tusr_unknown_${suffix}`)).modifiedCount, 0);

  console.log('--- no unauthenticated device-token endpoint is exposed ---');
  const probe = express();
  probe.use(express.json());
  registerRoutes(probe);
  const server = await new Promise<ReturnType<typeof probe.listen>>((resolve) => {
    const instance = probe.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Probe server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const registerRes = await fetch(`${baseUrl}/device-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fakeToken2, platform: 'android' }),
    });
    expect('POST /device-tokens without mobile-user auth -> not exposed (404)', registerRes.status, 404);
    const listRes = await fetch(`${baseUrl}/device-tokens`);
    expect('GET /device-tokens -> not exposed (404)', listRes.status, 404);
    const deactivateRes = await fetch(`${baseUrl}/device-tokens/deactivate`, { method: 'POST', body: '{}' });
    expect('POST /device-tokens/deactivate -> not exposed (404)', deactivateRes.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  } finally {
    // Per-record cleanup of every synthetic token this run may have created.
    for (const token of createdTokens) {
      try {
        await DeviceTokenModel.deleteOne({ token });
      } catch {
        // keep cleaning up the remaining tokens even if one delete fails
      }
    }
    const strays = await DeviceTokenModel.find({ token: { $regex: '^test:fcm:synthetic_' } }).lean();
    for (const doc of strays) {
      await DeviceTokenModel.deleteOne({ id: String((doc as { id: unknown }).id) });
    }
  }

  const afterCount = await DeviceTokenModel.countDocuments();
  expect('deviceTokens count unchanged by the test run', afterCount, beforeCount);
  console.log('\nALL FIREBASE + DEVICE TOKEN TESTS PASSED');
}

main()
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    console.error('Firebase/device-token test failed:', error);
    try {
      const strays = await DeviceTokenModel.find({ token: { $regex: '^test:fcm:synthetic_' } }).lean();
      for (const doc of strays) {
        await DeviceTokenModel.deleteOne({ id: String((doc as { id: unknown }).id) });
      }
      console.error(`cleanup removed ${strays.length} synthetic token(s).`);
      await mongoose.disconnect();
    } catch {
      // ignore cleanup failures during error reporting
    }
    process.exit(1);
  });
