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
import { normalizeSegmentId, resolveTargetDevices, SUPPORTED_SEGMENTS } from '../services/notificationTargeting';
import { processScheduledNotifications } from '../services/notificationScheduler';
import type { SendMessaging } from '../services/notificationSender';

/**
 * Step 7 verification: notification targeting / segments.
 * Resolves destinations from synthetic users/devices only (existing user
 * fields: plan, lastSeen); mocked Firebase messaging; no real tokens and no
 * real delivery. Verifies the exact UI segment contract (all_users,
 * active_users, premium_users, inactive_users), the unsupported-segment 400,
 * the targetSegment/type/scheduledFor alias shim, that no body-supplied
 * token/userId can be injected, and that no tokens/credentials leak.
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
    responsesByToken: {} as Record<string, ScriptedResponse>,
  };
  const sendEachForMulticast = async (message: MulticastMessage): Promise<BatchResponse> => {
    state.calls.push(message);
    const responses = (message.tokens ?? []).map((token) => {
      const scripted = state.responsesByToken[token] ?? { success: false, code: 'test/no-script', message: 'No scripted response.' };
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

function tokenSet(devices: LooseDocument[]): string[] {
  return devices.map((device) => String(device.token)).sort();
}

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const now = new Date();
  const ids = {
    allowedRole: `ttg_role_allowed_${suffix}`,
    allowedAdmin: `ttg_admin_allowed_${suffix}`,
    allowedSession: `ttg_sess_allowed_${suffix}`,
  };
  const userA = `user_tg_a_${suffix}`;
  const userB = `user_tg_b_${suffix}`;
  const userC = `user_tg_c_${suffix}`;
  const userD = `user_tg_d_${suffix}`;
  const createdUserIds = [userA, userB, userC, userD];
  const createdNotificationIds: string[] = [];
  const createdTokens: string[] = [];
  const capturedBodies: string[] = [];
  const fake = makeFakeMessaging();

  const notificationsBefore = await models.notifications.countDocuments();
  const devicesBefore = await DeviceTokenModel.countDocuments();
  const usersBefore = await models.users.countDocuments();
  console.log(`--- before: notifications=${notificationsBefore} deviceTokens=${devicesBefore} users=${usersBefore} ---`);

  const activeDevices = await DeviceTokenModel.countDocuments({ isActive: true });
  if (activeDevices !== 0) {
    throw new Error(`Expected 0 active device tokens before the run, found ${activeDevices}.`);
  }

  const app = express();
  app.use(express.json());
  app.use('/', createNotificationManagementRouter(models, { messaging: fake as unknown as SendMessaging }));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function call(path: string, options: RequestInit = {}): Promise<{ status: number; body: Record<string, any> }> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ids.allowedSession}`,
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

  try {
    await models.roles.create([{ id: ids.allowedRole, name: 'Targeting Test Allowed', permissions: ['NOTIFICATION_MANAGE'] }]);
    await models.admins.create([
      { id: ids.allowedAdmin, name: 'Targeting Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(now.getTime() + 300_000), revokedAt: null },
    ]);

    // Synthetic users built strictly from EXISTING user fields.
    await models.users.create([
      { id: userA, name: 'Targeting A', status: 'active', plan: 'premium', lastSeen: now },
      { id: userB, name: 'Targeting B', status: 'active', plan: 'free', lastSeen: now },
      { id: userC, name: 'Targeting C', status: 'active', plan: 'premium', lastSeen: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      { id: userD, name: 'Targeting D', status: 'suspended', plan: 'free', lastSeen: now },
    ]);

    const tokenA1 = `test:fcm:tg_a1_${suffix}_0123456789abcdef`;
    const tokenA2 = `test:fcm:tg_a2_${suffix}_0123456789abcdef`;
    const tokenA3 = `test:fcm:tg_a3_${suffix}_0123456789abcdef`;
    const tokenB1 = `test:fcm:tg_b1_${suffix}_0123456789abcdef`;
    const tokenC1 = `test:fcm:tg_c1_${suffix}_0123456789abcdef`;
    const tokenD1 = `test:fcm:tg_d1_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenA1, tokenA2, tokenA3, tokenB1, tokenC1, tokenD1);
    await registerDeviceToken(userA, tokenA1, 'android');
    await registerDeviceToken(userA, tokenA2, 'ios');
    await registerDeviceToken(userA, tokenA3, 'android');
    await registerDeviceToken(userB, tokenB1, 'ios');
    await registerDeviceToken(userC, tokenC1, 'android');
    await registerDeviceToken(userD, tokenD1, 'ios');
    await deactivateDeviceToken(userA, tokenA3);

    // Extra synthetic user with NO device registration (also in the premium segment).
    const userE = `user_tg_e_${suffix}`;
    createdUserIds.push(userE);
    await models.users.create([
      { id: userE, name: 'Targeting E', status: 'active', plan: 'premium', lastSeen: now },
    ]);

    // Every synthetic destination succeeds unless a test scripts otherwise.
    for (const token of createdTokens) fake.state.responsesByToken[token] = { success: true };

    console.log('\n[1] Service-level segment resolution (existing user fields only)');
    const allTargets = await resolveTargetDevices(models, null);
    expect('implicit default segment = all_users', allTargets.description, 'all_users');
    expect('all_users -> 5 active devices (A3 is deactivated)', allTargets.devices.length, 5);
    expect(
      'all_users active device set',
      tokenSet(allTargets.devices).join('|'),
      [tokenA1, tokenA2, tokenB1, tokenC1, tokenD1].sort().join('|')
    );
    expect(
      'user A has 2 active devices (multiple devices per user)',
      allTargets.devices.filter((device) => device.userId === userA).length,
      2
    );
    assertOk('deactivated device A3 is never targeted', !tokenSet(allTargets.devices).includes(tokenA3));

    const premiumTargets = await resolveTargetDevices(models, 'premium_users');
    expect('premium_users -> 3 devices', premiumTargets.devices.length, 3);
    expect(
      'premium_users device set (A1, A2, C1; user E has no device)',
      tokenSet(premiumTargets.devices).join('|'),
      [tokenA1, tokenA2, tokenC1].sort().join('|')
    );
    expect(
      'a user with no registered device contributes 0 destinations',
      await DeviceTokenModel.countDocuments({ userId: userE }),
      0
    );

    const activeTargets = await resolveTargetDevices(models, 'active_users');
    expect('active_users (last 7 days) -> 4 devices', activeTargets.devices.length, 4);
    const inactiveTargets = await resolveTargetDevices(models, 'inactive_users');
    expect('inactive_users -> 1 device (user C only)', inactiveTargets.devices.length, 1);
    expect('inactive_users device set', tokenSet(inactiveTargets.devices).join('|'), tokenC1);

    expect(
      'legacy UI label "Premium Subscribers" resolves',
      (await resolveTargetDevices(models, 'Premium Subscribers')).description,
      'premium_users'
    );
    expect('legacy UI label "All Users" resolves', (await resolveTargetDevices(models, 'All Users')).description, 'all_users');
    expect('spaced/dashed slug resolves', (await resolveTargetDevices(models, 'Premium-Users')).description, 'premium_users');
    expect('normalizeSegmentId("") -> null (implicit default)', normalizeSegmentId(''), null);
    expect(
      'SUPPORTED_SEGMENTS equals the exact UI option set',
      SUPPORTED_SEGMENTS.join(','),
      'all_users,active_users,premium_users,inactive_users'
    );

    let unsupportedError: Error | null = null;
    try {
      normalizeSegmentId('seg_core_users');
    } catch (error) {
      unsupportedError = error as Error;
    }
    assertOk('unsupported segment throws instead of guessing', unsupportedError !== null);
    assertOk('unsupported segment error lists the supported set', /Supported segments/.test(String(unsupportedError?.message)));
    console.log('\n[2] Send API: targeting resolved from the stored segment');
    const premiumDoc = await call('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Premium push',
        body: 'Premium only',
        type: 'push',
        targetSegment: 'premium_users',
        scheduledFor: null,
        status: 'draft',
      }),
    });
    createdNotificationIds.push(String(premiumDoc.body.id));
    expect('create with the UI vocabulary -> 201', premiumDoc.status, 201);
    expect('canonical channel stored from the UI type', premiumDoc.body.channel, 'push');
    expect('canonical segmentId stored from the UI targetSegment', premiumDoc.body.segmentId, 'premium_users');
    expect('response aliases targetSegment for the existing UI list', premiumDoc.body.targetSegment, 'premium_users');
    assertOk('alias keeps the UI select vocabulary (edit form round-trips)', premiumDoc.body.targetSegment === premiumDoc.body.segmentId);
    expect('response aliases type for the existing UI list', premiumDoc.body.type, 'push');
    expect('response aliases scheduledFor (null = immediate)', premiumDoc.body.scheduledFor, null);
    const storedPremium = await models.notifications.findOne({ id: premiumDoc.body.id }).lean<LooseDocument | null>();
    assertOk('read-side alias is never persisted (no targetSegment in DB)', storedPremium?.targetSegment === undefined);
    assertOk('read-side alias is never persisted (no scheduledFor in DB)', storedPremium?.scheduledFor === undefined);

    const beforePremium = fake.state.calls.length;
    const premiumSend = await call(`/notifications/${String(premiumDoc.body.id)}/send`, { method: 'POST' });
    expect('premium send -> 200', premiumSend.status, 200);
    expect('premium targeted = 3', premiumSend.body.result.targeted, 3);
    expect('premium successful = 3', premiumSend.body.result.successful, 3);
    expect('premium failed = 0', premiumSend.body.result.failed, 0);
    expect('premium status = sent', premiumSend.body.notification.status, 'sent');
    expect('exactly one FCM batch call', fake.state.calls.length - beforePremium, 1);
    const premiumCall = fake.state.calls[fake.state.calls.length - 1];
    expect(
      'FCM destinations = premium segment devices only',
      (premiumCall.tokens ?? []).slice().sort().join('|'),
      [tokenA1, tokenA2, tokenC1].sort().join('|')
    );
    expect('FCM payload title from the notification', premiumCall.notification?.title, 'Premium push');
    expect('FCM payload body from the notification', premiumCall.notification?.body, 'Premium only');
    expect('send response contains no device token', JSON.stringify(premiumSend.body).includes('test:fcm:'), false);
    expect(
      're-send of an already sent notification -> 409',
      (await call(`/notifications/${String(premiumDoc.body.id)}/send`, { method: 'POST' })).status,
      409
    );

    const sentAudit = await models.auditLogs
      .findOne({ targetId: String(premiumDoc.body.id), action: 'notifications.sent' })
      .lean<LooseDocument | null>();
    assertOk('audit event notifications.sent created', sentAudit !== null);
    assertOk(
      'audit records the segment and the counts',
      /segment: premium_users/.test(String(sentAudit?.description)) && /targeted 3/.test(String(sentAudit?.description))
    );

    console.log('\n[3] Client-supplied destinations are ignored');
    const injectionDoc = await call('/notifications', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Injection attempt',
        body: 'ignored destinations',
        type: 'push',
        targetSegment: 'all_users',
        segmentId: 'premium_users',
        status: 'draft',
        userId: userB,
        token: tokenB1,
        tokens: [tokenB1],
        userIds: [userB, userA],
      }),
    });
    createdNotificationIds.push(String(injectionDoc.body.id));
    expect('create with client-supplied destinations -> 201', injectionDoc.status, 201);
    const storedInjection = await models.notifications.findOne({ id: injectionDoc.body.id }).lean<LooseDocument | null>();
    assertOk('client-supplied userId is never persisted', storedInjection?.userId === undefined);
    assertOk('client-supplied token is never persisted', storedInjection?.token === undefined);
    assertOk('client-supplied tokens array is never persisted', storedInjection?.tokens === undefined);
    assertOk('client-supplied userIds array is never persisted', storedInjection?.userIds === undefined);
    expect('the explicit canonical segmentId wins over targetSegment', storedInjection?.segmentId, 'premium_users');

    const beforeInjection = fake.state.calls.length;
    const injectionSend = await call(`/notifications/${String(injectionDoc.body.id)}/send`, {
      method: 'POST',
      body: JSON.stringify({ userId: userA, token: tokenB1, tokens: [tokenB1], segmentId: 'all_users' }),
    });
    expect('send ignores body-supplied destinations -> 200', injectionSend.status, 200);
    expect('targeted = stored segment devices, not the body token', injectionSend.body.result.targeted, 3);
    expect('exactly one FCM batch call for the injection attempt', fake.state.calls.length - beforeInjection, 1);
    const injectionCall = fake.state.calls[fake.state.calls.length - 1];
    assertOk('body-supplied token was not used as a destination', !(injectionCall.tokens ?? []).includes(tokenB1));
    expect(
      'body-supplied segment did not override the stored segment',
      (injectionCall.tokens ?? []).slice().sort().join('|'),
      [tokenA1, tokenA2, tokenC1].sort().join('|')
    );

    console.log('\n[4] Legacy records: targetSegment label instead of segmentId');
    const legacyId = `tg_legacy_${suffix}`;
    const legacyBadId = `tg_legacy_bad_${suffix}`;
    const legacyNoSegmentId = `tg_legacy_noseg_${suffix}`;
    createdNotificationIds.push(legacyId, legacyBadId, legacyNoSegmentId);
    await models.notifications.collection.insertOne({
      id: legacyId,
      title: 'Legacy premium',
      body: 'legacy body',
      type: 'push',
      targetSegment: 'Premium Subscribers',
      scheduledFor: new Date(now.getTime() - 60_000),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    await models.notifications.collection.insertOne({
      id: legacyBadId,
      title: 'Legacy unsupported',
      body: 'legacy body',
      type: 'push',
      targetSegment: 'Core Power Users',
      scheduledFor: null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    await models.notifications.collection.insertOne({
      id: legacyNoSegmentId,
      title: 'Legacy no segment',
      body: 'legacy body',
      type: 'push',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    const legacyGet = await call(`/notifications/${legacyId}`);
    expect('legacy doc readable -> 200', legacyGet.status, 200);
    expect('stored UI label is returned verbatim', legacyGet.body.targetSegment, 'Premium Subscribers');

    const beforeLegacy = fake.state.calls.length;
    const legacySend = await call(`/notifications/${legacyId}/send`, { method: 'POST' });
    expect('legacy label resolves and sends -> 200', legacySend.status, 200);
    expect('legacy label "Premium Subscribers" -> premium devices only', legacySend.body.result.targeted, 3);
    expect('legacy send targeted the premium set', (fake.state.calls[fake.state.calls.length - 1].tokens ?? []).slice().sort().join('|'), [tokenA1, tokenA2, tokenC1].sort().join('|'));
    expect('legacy doc marked sent', legacySend.body.notification.status, 'sent');
    expect('exactly one FCM call for the legacy send', fake.state.calls.length - beforeLegacy, 1);

    const beforeLegacyBad = fake.state.calls.length;
    const legacyBadSend = await call(`/notifications/${legacyBadId}/send`, { method: 'POST' });
    expect('unsupported legacy label -> 400', legacyBadSend.status, 400);
    assertOk('400 explains the supported segments', /Supported segments/.test(String(legacyBadSend.body.message)));
    const legacyBadStored = await models.notifications.findOne({ id: legacyBadId }).lean<LooseDocument | null>();
    expect('unsupported legacy label leaves status untouched', legacyBadStored?.status, 'draft');
    expect('unsupported legacy label writes no send bookkeeping', legacyBadStored?.sentAt ?? null, null);
    expect('unsupported legacy label calls Firebase 0 times', fake.state.calls.length - beforeLegacyBad, 0);

    const legacyDefaultSend = await call(`/notifications/${legacyNoSegmentId}/send`, { method: 'POST' });
    expect('record without any segment -> implicit all_users', legacyDefaultSend.body.result.targeted, 5);

    console.log('\n[5] Sender behavior preserved: invalid destination deactivated, temporary error not deactivated');
    const mixedDoc = await call('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Mixed batch', body: 'mixed', type: 'push', targetSegment: 'all_users', status: 'draft' }),
    });
    createdNotificationIds.push(String(mixedDoc.body.id));
    fake.state.responsesByToken[tokenB1] = { success: false, code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' };
    fake.state.responsesByToken[tokenD1] = { success: false, code: 'messaging/internal-error', message: 'Internal error.' };
    const mixedSend = await call(`/notifications/${String(mixedDoc.body.id)}/send`, { method: 'POST' });
    expect('mixed batch send -> 200', mixedSend.status, 200);
    expect('mixed targeted = 5', mixedSend.body.result.targeted, 5);
    expect('mixed successful = 3', mixedSend.body.result.successful, 3);
    expect('mixed failed = 2', mixedSend.body.result.failed, 2);
    expect('mixed status = sent (some deliveries succeeded)', mixedSend.body.notification.status, 'sent');

    const storedB1 = await DeviceTokenModel.findOne({ token: tokenB1 }).lean<LooseDocument | null>();
    const storedD1 = await DeviceTokenModel.findOne({ token: tokenD1 }).lean<LooseDocument | null>();
    assertOk('unregistered destination deactivated (not deleted)', storedB1 !== null && storedB1?.isActive === false);
    assertOk('temporary error destination stays active', storedD1 !== null && storedD1?.isActive === true);
    const mixedFailures = (mixedSend.body.notification.sendResult?.failures ?? []) as LooseDocument[];
    expect('both failures recorded', mixedFailures.length, 2);
    assertOk('failure entries carry a masked token only', mixedFailures.every((entry) => typeof entry.tokenMask === 'string' && entry.token === undefined));
    assertOk('failure mask is a truncated mask, never the token', mixedFailures.every((entry) => /^\u2026[A-Za-z0-9]{1,6}$/.test(String(entry.tokenMask)) && entry.tokenMask !== tokenB1));
    assertOk('no full device token in any captured response', capturedBodies.every((text) => !text.includes(tokenB1)));

    const mixedAudit = await models.auditLogs
      .findOne({ targetId: String(mixedDoc.body.id), action: 'notifications.sent' })
      .lean<LooseDocument | null>();
    assertOk('sent audit notes the invalid-device deactivation', /Deactivated 1 invalid device/.test(String(mixedAudit?.description)));
    await registerDeviceToken(userB, tokenB1, 'ios');

    console.log('\n[6] Zero-device segment: honest no-op, never a fake delivery');
    await deactivateDeviceToken(userC, tokenC1);
    const zeroDoc = await call('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Zero device', body: 'nobody', type: 'push', targetSegment: 'inactive_users', status: 'draft' }),
    });
    createdNotificationIds.push(String(zeroDoc.body.id));
    const beforeZero = fake.state.calls.length;
    const zeroSend = await call(`/notifications/${String(zeroDoc.body.id)}/send`, { method: 'POST' });
    expect('zero-device send -> 200', zeroSend.status, 200);
    expect('zero-device targeted = 0', zeroSend.body.result.targeted, 0);
    expect('zero-device successful = 0', zeroSend.body.result.successful, 0);
    expect('zero-device failed = 0', zeroSend.body.result.failed, 0);
    expect('zero-device skipped = 0', zeroSend.body.result.skipped, 0);
    assertOk('zero-device send makes no Firebase call', fake.state.calls.length - beforeZero === 0);
    const zeroStored = await models.notifications.findOne({ id: zeroDoc.body.id }).lean<LooseDocument | null>();
    expect('zero-device send never marks the notification sent', zeroStored?.status, 'draft');
    expect('zero-device send writes no sentAt', zeroStored?.sentAt ?? null, null);
    expect('zero-device send writes no sendResult', zeroStored?.sendResult ?? null, null);
    const zeroAudit = await models.auditLogs
      .findOne({ targetId: String(zeroDoc.body.id), action: 'notifications.sendSkipped' })
      .lean<LooseDocument | null>();
    assertOk('zero-device send audits a skip', zeroAudit !== null);
    assertOk(
      'skip audit states 0 registered devices for the segment',
      /resolved 0 registered devices/.test(String(zeroAudit?.description)) && /inactive_users/.test(String(zeroAudit?.description))
    );
    await registerDeviceToken(userC, tokenC1, 'android');
    expect(
      'reactivated device is targeted again (inactive_users -> 1)',
      (await resolveTargetDevices(models, 'inactive_users')).devices.length,
      1
    );

    console.log('\n[7] Scheduler integration: due notifications are targeted through the same service');
    const schedFutureId = `tg_sched_future_${suffix}`;
    const schedDueId = `tg_sched_due_${suffix}`;
    const schedBadSegId = `tg_sched_badseg_${suffix}`;
    createdNotificationIds.push(schedFutureId, schedDueId, schedBadSegId);
    const preexistingDue = await models.notifications.countDocuments({
      status: 'scheduled',
      scheduleAt: { $type: 'date', $lte: new Date() },
    });
    if (preexistingDue !== 0) {
      throw new Error(`Expected 0 pre-existing due scheduled notifications, found ${preexistingDue}; the dispatcher assertions need a clean schedule.`);
    }
    await models.notifications.create([
      { id: schedFutureId, title: 'Future', body: 'future', channel: 'push', segmentId: 'premium_users', scheduleAt: new Date(now.getTime() + 3_600_000), status: 'scheduled' },
      { id: schedDueId, title: 'Due', body: 'due', channel: 'push', segmentId: 'premium_users', scheduleAt: new Date(now.getTime() - 60_000), status: 'scheduled' },
      { id: schedBadSegId, title: 'Bad segment', body: 'bad', channel: 'push', segmentId: 'seg_legacy_unknown', scheduleAt: new Date(now.getTime() - 60_000), status: 'scheduled' },
    ]);

    const callsBeforeRun = fake.state.calls.length;
    const runOne = await processScheduledNotifications(models, new Date(), () => undefined, {
      messaging: fake as unknown as SendMessaging,
    });
    expect('scheduler considered the 2 due notifications', runOne.considered, 2);
    expect('scheduler sent the due notification', runOne.sent, 1);
    expect('scheduler reported no false failures', runOne.failed, 0);
    expect('scheduler reported no zero-device skip here', runOne.noDevices, 0);
    expect('exactly one FCM call in the run', fake.state.calls.length - callsBeforeRun, 1);
    expect(
      'scheduler used the premium segment destinations',
      (fake.state.calls[fake.state.calls.length - 1].tokens ?? []).slice().sort().join('|'),
      [tokenA1, tokenA2, tokenC1].sort().join('|')
    );

    const schedDueStored = await models.notifications.findOne({ id: schedDueId }).lean<LooseDocument | null>();
    expect('due notification marked sent', schedDueStored?.status, 'sent');
    assertOk('due notification records sentAt', schedDueStored?.sentAt instanceof Date);
    const schedFutureStored = await models.notifications.findOne({ id: schedFutureId }).lean<LooseDocument | null>();
    expect('future notification untouched by status', schedFutureStored?.status, 'scheduled');
    expect('future notification never claimed', schedFutureStored?.scheduledClaimedAt ?? null, null);
    const schedBadSegStored = await models.notifications.findOne({ id: schedBadSegId }).lean<LooseDocument | null>();
    expect('unsupported segment keeps the notification scheduled (not lost)', schedBadSegStored?.status, 'scheduled');
    expect('unsupported segment never claims delivery', schedBadSegStored?.sentAt ?? null, null);
    const schedAudit = await models.auditLogs
      .findOne({ targetId: schedDueId, action: 'notifications.sent' })
      .lean<LooseDocument | null>();
    assertOk('scheduler send is audited as the system actor', schedAudit?.adminId === 'system_scheduler');
    assertOk('scheduler audit records the segment', /segment: premium_users/.test(String(schedAudit?.description)));

    const runTwo = await processScheduledNotifications(models, new Date(), () => undefined, {
      messaging: fake as unknown as SendMessaging,
    });
    expect('second run finds nothing due/again-claimable', runTwo.considered, 0);
    expect('second run sends nothing (no duplicate delivery)', runTwo.sent, 0);
    expect('second run makes no further FCM call', fake.state.calls.length - callsBeforeRun, 1);

    console.log('\n[8] Exposure check and data safety');
    const forbidden = ['private_key', 'BEGIN PRIVATE KEY', 'client_email', 'FIREBASE_SERVICE_ACCOUNT_PATH', 'firebase-service-account', 'Super Bae Mobile'];
    for (const pattern of forbidden) {
      assertOk(`no '${pattern}' in any API response`, capturedBodies.every((text) => !text.includes(pattern)));
    }
    for (const token of createdTokens) {
      assertOk(`full token ending ${token.slice(-6)} never appears in an API response`, capturedBodies.every((text) => !text.includes(token)));
    }
    assertOk('synthetic destinations are clearly synthetic (never real FCM tokens)', createdTokens.every((token) => token.startsWith('test:fcm:')));

    const notificationsAfter = await models.notifications.countDocuments();
    const devicesAfter = await DeviceTokenModel.countDocuments();
    const usersAfter = await models.users.countDocuments();
    expect('notifications delta equals the test fixtures created', notificationsAfter, notificationsBefore + createdNotificationIds.length);
    expect('deviceTokens delta equals the synthetic registrations created', devicesAfter, devicesBefore + createdTokens.length);
    expect('users delta equals the synthetic users created', usersAfter, usersBefore + createdUserIds.length);
    const seededDoc = await models.notifications.findOne({ id: 'notif_1' }).lean<LooseDocument | null>();
    assertOk('pre-existing seeded notification still present', seededDoc !== null);
    assertOk('pre-existing seeded notification untouched by this run', String(seededDoc?.status) === 'sent' && seededDoc?.sendResult == null);
  } catch (error) {
    console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    // Per-record cleanup only: this run deletes exactly the fixtures it
    // created (never deleteMany, never a collection reset).
    for (const token of createdTokens) {
      await DeviceTokenModel.deleteOne({ token });
    }
    for (const id of createdNotificationIds) {
      await models.notifications.deleteOne({ id });
    }
    const testAudits = await models.auditLogs
      .find({ targetId: { $in: createdNotificationIds } })
      .lean<LooseDocument[]>();
    for (const audit of testAudits) {
      await models.auditLogs.deleteOne({ id: audit.id });
    }
    for (const userId of createdUserIds) {
      await models.users.deleteOne({ id: userId });
    }
    await models.adminSessions.deleteOne({ id: ids.allowedSession });
    await models.admins.deleteOne({ id: ids.allowedAdmin });
    await models.roles.deleteOne({ id: ids.allowedRole });

    const notificationsEnd = await models.notifications.countDocuments();
    const devicesEnd = await DeviceTokenModel.countDocuments();
    const usersEnd = await models.users.countDocuments();
    console.log(`--- after: notifications=${notificationsEnd} deviceTokens=${devicesEnd} users=${usersEnd} ---`);
    if (!process.exitCode) {
      expect('cleanup restored the notifications count', notificationsEnd, notificationsBefore);
      expect('cleanup restored the deviceTokens count', devicesEnd, devicesBefore);
      expect('cleanup restored the users count', usersEnd, usersBefore);
      console.log('\nALL TARGETING ASSERTIONS PASSED');
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



