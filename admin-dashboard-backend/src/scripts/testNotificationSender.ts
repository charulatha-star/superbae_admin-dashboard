import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
import { createNotificationManagementRouter } from '../routes/notificationManagement';
import { DeviceTokenModel } from '../models/deviceToken';
import { registerDeviceToken, deactivateDeviceToken } from '../services/deviceTokens';
import type { SendMessaging } from '../services/notificationSender';

/**
 * Step 5 verification: notification sending.
 * Mocked Firebase messaging (scripted per-token responses) + synthetic device
 * destinations; no real FCM tokens, no real phone, no real delivery attempts.
 * Standalone app mounts ONLY the dedicated notifications router with the fake
 * messaging injected, so route-level auth matrix and send results are tested
 * hermetically. Cleanup is per-record (deleteOne); counts must be unchanged.
 */

function expect(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  console.log(`  PASS  ${label}`);
}

function assertOk(label: string, condition: unknown, detail = ''): void {
  if (!condition) throw new Error(`${label} failed.${detail ? ` ${detail}` : ''}`);
  console.log(`  PASS  ${label}`);
}

interface ScriptedResponse { success: boolean; code?: string; message?: string; }

function makeFakeMessaging() {
  const state = {
    calls: [] as MulticastMessage[],
    /** Response per destination token, keyed by the token string (deterministic regardless of device order). */
    responsesByToken: {} as Record<string, ScriptedResponse>,
  };
  const sendEachForMulticast = async (message: MulticastMessage): Promise<BatchResponse> => {
    state.calls.push(message);
    const responses = (message.tokens ?? []).map((token) => {
      const scripted = state.responsesByToken[token] ?? { success: false, code: 'test/no-script', message: 'No scripted response for token.' };
      return scripted.success
        ? { success: true, messageId: `projects/fake/messages/${state.calls.length}` }
        : {
            success: false,
            error: Object.assign(new Error(scripted.message ?? 'Requested entity was not found.'), { code: scripted.code }),
          };
    });
    return {
      responses,
      successCount: responses.filter((entry) => entry.success).length,
      failureCount: responses.filter((entry) => !entry.success).length,
    } as unknown as BatchResponse;
  };
  return { state, sendEachForMulticast };
}

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const now = new Date();
  const ids = {
    deniedRole: `tsnd_role_denied_${suffix}`,
    allowedRole: `tsnd_role_allowed_${suffix}`,
    deniedAdmin: `tsnd_admin_denied_${suffix}`,
    allowedAdmin: `tsnd_admin_allowed_${suffix}`,
    deniedSession: `tsnd_sess_denied_${suffix}`,
    allowedSession: `tsnd_sess_allowed_${suffix}`,
  };
  const userA = `tusr_a_${suffix}`;
  const userB = `tusr_b_${suffix}`;
  const createdNotificationIds: string[] = [];
  const createdTokens: string[] = [];
  const capturedBodies: string[] = [];

  const notificationsBefore = await models.notifications.countDocuments();
  const devicesBefore = await DeviceTokenModel.countDocuments();
  console.log(`--- notifications before: ${notificationsBefore} | deviceTokens before: ${devicesBefore} ---`);

  const activeDevices = await DeviceTokenModel.countDocuments({ isActive: true });
  if (activeDevices !== 0) {
    throw new Error(`Expected 0 active device tokens before the test run, found ${activeDevices}. The zero-device scenario requires a clean slate.`);
  }

  const fake = makeFakeMessaging();
  const app = express();
  app.use(express.json());
  app.use('/', createNotificationManagementRouter(models, { messaging: fake as unknown as SendMessaging }));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function call(path: string, token: string | undefined, options: RequestInit = {}): Promise<{ status: number; body: Record<string, any> }> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    capturedBodies.push(text);
    let body: Record<string, any> = {};
    try {
      body = JSON.parse(text) as Record<string, any>;
    } catch {
      body = { raw: text };
    }
    return { status: res.status, body };
  }

  async function createNotification(overrides: LooseDocument): Promise<LooseDocument> {
    const res = await call('/notifications', ids.allowedSession, {
      method: 'POST',
      body: JSON.stringify({ title: `Send T ${suffix}`, body: 'Hello devices', ...overrides }),
    });
    if (res.status !== 201) throw new Error(`fixture create failed: ${res.status} ${JSON.stringify(res.body)}`);
    createdNotificationIds.push(String(res.body.id));
    return res.body;
  }

  try {
    await models.roles.create([
      { id: ids.deniedRole, name: 'Sender Test Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Sender Test Allowed', permissions: ['NOTIFICATION_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Sender Denied', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Sender Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
    ]);

    console.log('--- send auth matrix ---');
    expect('unauthenticated send -> 401', (await call(`/notifications/unknown_${suffix}/send`, undefined, { method: 'POST' })).status, 401);
    expect('denied send -> 403', (await call(`/notifications/unknown_${suffix}/send`, ids.deniedSession, { method: 'POST' })).status, 403);
    expect('unknown notification -> 404', (await call(`/notifications/unknown_${suffix}/send`, ids.allowedSession, { method: 'POST' })).status, 404);

    console.log('--- send validation ---');
    const smsNotif = await createNotification({ channel: 'sms' });
    const smsSend = await call(`/notifications/${String(smsNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('sms channel send rejected -> 400 (not implemented)', smsSend.status, 400);
    assertOk(
      'sms send message says SMS delivery is not implemented yet',
      /SMS delivery is not implemented yet/.test(String(smsSend.body?.message ?? ''))
    );
    const segmented = await createNotification({ segmentId: 'seg_core_users' });
    expect('segmentId send rejected (no segment system yet) -> 400', (await call(`/notifications/${String(segmented.id)}/send`, ids.allowedSession, { method: 'POST' })).status, 400);

    console.log('--- zero devices: no fake success ---');
    const zeroNotif = await createNotification({});
    const zeroRes = await call(`/notifications/${String(zeroNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('zero-device send -> 200', zeroRes.status, 200);
    expect('targeted = 0', zeroRes.body.result?.targeted, 0);
    expect('successful = 0', zeroRes.body.result?.successful, 0);
    expect('failed = 0', zeroRes.body.result?.failed, 0);
    const zeroDoc = await models.notifications.findOne({ id: String(zeroNotif.id) }).lean<LooseDocument | null>();
    assertOk('status unchanged (still draft)', Boolean(zeroDoc) && String(zeroDoc?.status) === 'draft');
    assertOk('sentAt not set', zeroDoc?.sentAt === null || zeroDoc?.sentAt === undefined);
    assertOk('sendResult not set', zeroDoc?.sendResult === null || zeroDoc?.sendResult === undefined);
    expect('Firebase never called for zero devices', fake.state.calls.length, 0);
    expect('sendSkipped audit recorded', await models.auditLogs.countDocuments({ action: 'notifications.sendSkipped', targetId: String(zeroNotif.id) }), 1);

    console.log('--- successful send ---');
    const tokenA1 = `test:fcm:snd_a1_${suffix}_0123456789abcdef`;
    const tokenA2 = `test:fcm:snd_a2_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenA1, tokenA2);
    await registerDeviceToken(userA, tokenA1, 'android');
    await registerDeviceToken(userA, tokenA2, 'ios');
    const okNotif = await createNotification({});
    fake.state.responsesByToken = {
      [tokenA1]: { success: true },
      [tokenA2]: { success: true },
    };
    const okRes = await call(`/notifications/${String(okNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('success send -> 200', okRes.status, 200);
    expect('targeted = 2', okRes.body.result?.targeted, 2);
    expect('successful = 2', okRes.body.result?.successful, 2);
    expect('failed = 0', okRes.body.result?.failed, 0);
    expect('skipped = 0', okRes.body.result?.skipped, 0);
    const okDoc = await models.notifications.findOne({ id: String(okNotif.id) }).lean<LooseDocument | null>();
    assertOk('status = sent', Boolean(okDoc) && String(okDoc?.status) === 'sent');
    assertOk('sentAt recorded', okDoc?.sentAt !== null && okDoc?.sentAt !== undefined);
    assertOk('sendResult counts recorded', Boolean(okDoc?.sendResult) && (okDoc?.sendResult as LooseDocument)?.successful === 2);
    expect('notifications.sent audit', await models.auditLogs.countDocuments({ action: 'notifications.sent', targetId: String(okNotif.id) }), 1);
    expect('Firebase called exactly once', fake.state.calls.length, 1);
    const sentMessage = fake.state.calls[0];
    assertOk('payload carries title', sentMessage.notification?.title === `Send T ${suffix}`);
    assertOk('payload carries body', sentMessage.notification?.body === 'Hello devices');
    assertOk('payload targets only active tokens', JSON.stringify([...(sentMessage.tokens ?? [])].sort()) === JSON.stringify([tokenA1, tokenA2].sort()));
    assertOk('payload data carries notificationId', sentMessage.data?.notificationId === String(okNotif.id));
    expect('already-sent send rejected -> 409', (await call(`/notifications/${String(okNotif.id)}/send`, ids.allowedSession, { method: 'POST' })).status, 409);

    console.log('--- unregistered destination: deactivate, never delete ---');
    const tokenB1 = `test:fcm:snd_b1_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenB1);
    await registerDeviceToken(userB, tokenB1, 'android');
    const failNotif = await createNotification({});
    fake.state.responsesByToken = {
      [tokenA1]: { success: true },
      [tokenA2]: { success: true },
      [tokenB1]: { success: false, code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' },
    };
    const failRes = await call(`/notifications/${String(failNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('failure send -> 200 with structured result', failRes.status, 200);
    expect('healthy destinations still succeed (successful = 2)', failRes.body.result?.successful, 2);
    expect('unregistered destination failed = 1', failRes.body.result?.failed, 1);
    expect('targeted = 3 (all active devices)', failRes.body.result?.targeted, 3);
    const failedDevice = await DeviceTokenModel.findOne({ token: tokenB1 }).lean<LooseDocument | null>();
    assertOk('device record still exists (not deleted)', Boolean(failedDevice));
    assertOk('device deactivated', Boolean(failedDevice) && failedDevice?.isActive === false);
    const failedDoc = await models.notifications.findOne({ id: String(failNotif.id) }).lean<LooseDocument | null>();
    assertOk('partial delivery -> status = sent', Boolean(failedDoc) && String(failedDoc?.status) === 'sent');
    const sentAudit = await models.auditLogs.findOne({ action: 'notifications.sent', targetId: String(failNotif.id) }).lean<LooseDocument | null>();
    assertOk('notifications.sent audit mentions deactivated device', Boolean(sentAudit) && String(sentAudit?.description).includes('Deactivated 1 invalid device(s)'));
    const failureEntry = (failRes.body.result?.failures as LooseDocument[] | undefined)?.[0];
    assertOk('failure records masked token only', Boolean(failureEntry) && String(failureEntry?.tokenMask).endsWith(tokenB1.slice(-6)) && !String(failureEntry?.tokenMask).includes(tokenB1));

    console.log('--- temporary Firebase error: device stays active ---');
    const tokenB2 = `test:fcm:snd_b2_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenB2);
    await registerDeviceToken(userB, tokenB2, 'android');
    const tempNotif = await createNotification({});
    fake.state.responsesByToken = {
      [tokenA1]: { success: true },
      [tokenA2]: { success: true },
      [tokenB2]: { success: false, code: 'messaging/unavailable', message: 'Backend is temporarily unavailable.' },
    };
    expect('temporary-error send -> 200', (await call(`/notifications/${String(tempNotif.id)}/send`, ids.allowedSession, { method: 'POST' })).status, 200);
    const tempDevice = await DeviceTokenModel.findOne({ token: tokenB2 }).lean<LooseDocument | null>();
    assertOk('temporary error does NOT deactivate device', Boolean(tempDevice) && tempDevice?.isActive === true);
    const tempDoc = await models.notifications.findOne({ id: String(tempNotif.id) }).lean<LooseDocument | null>();
    assertOk('partial success recorded (status = sent, count = 2)', Boolean(tempDoc) && String(tempDoc?.status) === 'sent' && (tempDoc?.sendResult as LooseDocument | undefined)?.successful === 2);

    console.log('--- mixed batch: partial success ---');
    const tokenA3 = `test:fcm:snd_a3_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenA3);
    await registerDeviceToken(userA, tokenA3, 'android');
    const mixedNotif = await createNotification({});
    fake.state.responsesByToken = {
      [tokenA1]: { success: true },
      [tokenA2]: { success: true },
      [tokenA3]: { success: false, code: 'messaging/registration-token-not-registered' },
      [tokenB2]: { success: true },
    };
    const mixedRes = await call(`/notifications/${String(mixedNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('targeted = 4 (all active devices)', mixedRes.body.result?.targeted, 4);
    expect('successful = 3', mixedRes.body.result?.successful, 3);
    expect('failed = 1', mixedRes.body.result?.failed, 1);
    expect('skipped = 0', mixedRes.body.result?.skipped, 0);
    const mixedDoc = await models.notifications.findOne({ id: String(mixedNotif.id) }).lean<LooseDocument | null>();
    assertOk('partial success still marks status = sent', Boolean(mixedDoc) && String(mixedDoc?.status) === 'sent');
    const deactivatedThird = await DeviceTokenModel.findOne({ token: tokenA3 }).lean<LooseDocument | null>();
    assertOk('unregistered third device deactivated', Boolean(deactivatedThird) && deactivatedThird?.isActive === false);
    expect('healthy devices of user A remain active', await DeviceTokenModel.countDocuments({ userId: userA, isActive: true }), 2);
    expect('Firebase called 4 times total (one per send)', fake.state.calls.length, 4);

    console.log('--- all devices failed: notification marked failed for retry ---');
    // Deactivate every currently active device (per-record service calls),
    // register one fresh failing destination, and send.
    await deactivateDeviceToken(userA, tokenA1);
    await deactivateDeviceToken(userA, tokenA2);
    await deactivateDeviceToken(userB, tokenB2);
    const tokenC1 = `test:fcm:snd_c1_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenC1);
    await registerDeviceToken(userB, tokenC1, 'ios');
    const allFailNotif = await createNotification({});
    fake.state.responsesByToken = {
      [tokenC1]: { success: false, code: 'messaging/internal-error', message: 'An internal error has occurred.' },
    };
    const allFailRes = await call(`/notifications/${String(allFailNotif.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('all-failed send -> 200', allFailRes.status, 200);
    expect('successful = 0', allFailRes.body.result?.successful, 0);
    expect('failed = 1', allFailRes.body.result?.failed, 1);
    const allFailDoc = await models.notifications.findOne({ id: String(allFailNotif.id) }).lean<LooseDocument | null>();
    assertOk('status = failed (retryable)', Boolean(allFailDoc) && String(allFailDoc?.status) === 'failed');
    assertOk('sentAt not set on failed send', allFailDoc?.sentAt === null || allFailDoc?.sentAt === undefined);
    expect('notifications.sendFailed audit', await models.auditLogs.countDocuments({ action: 'notifications.sendFailed', targetId: String(allFailNotif.id) }), 1);
    const internalDevice = await DeviceTokenModel.findOne({ token: tokenC1 }).lean<LooseDocument | null>();
    assertOk('internal error does NOT deactivate device', Boolean(internalDevice) && internalDevice?.isActive === true);
    expect('Firebase called 5 times total', fake.state.calls.length, 5);

    console.log('--- credential & token leak scan ---');
    for (const body of capturedBodies) {
      assertOk('no Firebase private key material in response', !body.includes('BEGIN PRIVATE KEY') && !body.includes('private_key'));
    }
    for (const token of createdTokens) {
      const leaked = capturedBodies.some((body) => body.includes(token));
      assertOk('full device token never returned in any API response', !leaked);
    }

    console.log('ALL NOTIFICATION SENDER TESTS PASSED');
  } finally {
    for (const id of createdNotificationIds) {
      try {
        await models.notifications.deleteOne({ id });
      } catch {
        // keep cleaning the remaining fixtures
      }
    }
    for (const token of createdTokens) {
      try {
        await DeviceTokenModel.deleteOne({ token });
      } catch {
        // keep cleaning the remaining fixtures
      }
    }
    const testAudits = await models.auditLogs
      .find({ adminId: { $in: [ids.deniedAdmin, ids.allowedAdmin] } })
      .lean<LooseDocument[]>();
    for (const row of testAudits) {
      await models.auditLogs.deleteOne({ id: row.id });
    }
    console.log(`  cleanup  removed ${testAudits.length} test audit row(s)`);
    await models.adminSessions.deleteOne({ id: ids.deniedSession });
    await models.adminSessions.deleteOne({ id: ids.allowedSession });
    await models.admins.deleteOne({ id: ids.deniedAdmin });
    await models.admins.deleteOne({ id: ids.allowedAdmin });
    await models.roles.deleteOne({ id: ids.deniedRole });
    await models.roles.deleteOne({ id: ids.allowedRole });
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  const notificationsAfter = await models.notifications.countDocuments();
  const devicesAfter = await DeviceTokenModel.countDocuments();
  expect('notification count unchanged', notificationsAfter, notificationsBefore);
  expect('deviceTokens count unchanged', devicesAfter, devicesBefore);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Notification sender test failed:', error);
    process.exit(1);
  });

