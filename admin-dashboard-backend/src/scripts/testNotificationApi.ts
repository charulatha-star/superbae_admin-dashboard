import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
import { createNotificationManagementRouter } from '../routes/notificationManagement';
import { DeviceTokenModel } from '../models/deviceToken';
import { registerDeviceToken } from '../services/deviceTokens';
import {
  CLIENT_EDITABLE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  SENDABLE_CHANNELS,
} from '../services/notificationManagement';
import { SEGMENT_LABELS, SUPPORTED_SEGMENTS } from '../services/notificationSegments';
import type { SendMessaging } from '../services/notificationSender';

/**
 * Step 8 verification: notification API contract & consistency.
 *
 * Mounts ONLY the dedicated notifications router, with mocked Firebase
 * messaging, so the documented contract (canonical fields, legacy aliases,
 * validation, status transitions, send outcomes, exposure rules) is asserted
 * hermetically against synthetic users/devices. No real FCM token, no real
 * delivery, no credential material. Cleanup is per-record (deleteOne) and the
 * MongoDB counts must be unchanged when the run finishes.
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

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const now = new Date();
  const ids = {
    allowedRole: `api_role_allowed_${suffix}`,
    allowedAdmin: `api_admin_allowed_${suffix}`,
    allowedSession: `api_sess_allowed_${suffix}`,
    deniedRole: `api_role_denied_${suffix}`,
    deniedAdmin: `api_admin_denied_${suffix}`,
    deniedSession: `api_sess_denied_${suffix}`,
  };
  const userA = `user_api_a_${suffix}`;
  const userB = `user_api_b_${suffix}`;
  const tokenA1 = `test:fcm:api_a1_${suffix}_0123456789abcdef`;
  const tokenA2 = `test:fcm:api_a2_${suffix}_0123456789abcdef`;
  const tokenB1 = `test:fcm:api_b1_${suffix}_0123456789abcdef`;
  const createdUserIds = [userA, userB];
  const createdNotificationIds: string[] = [];
  const createdTokens = [tokenA1, tokenA2, tokenB1];
  const capturedBodies: string[] = [];
  const fake = makeFakeMessaging();

  const notificationsBefore = await models.notifications.countDocuments();
  const devicesBefore = await DeviceTokenModel.countDocuments();
  const usersBefore = await models.users.countDocuments();
  const auditsBefore = await models.auditLogs.countDocuments();
  console.log(`--- before: notifications=${notificationsBefore} deviceTokens=${devicesBefore} users=${usersBefore} auditLogs=${auditsBefore} ---`);

  const app = express();
  app.use(express.json());
  app.use('/', createNotificationManagementRouter(models, { messaging: fake as unknown as SendMessaging }));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function call(
    path: string,
    token: string | null = ids.allowedSession,
    options: RequestInit = {}
  ): Promise<{ status: number; body: Record<string, any> }> {
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

  async function create(overrides: LooseDocument): Promise<Record<string, any>> {
    const res = await call('/notifications', ids.allowedSession, {
      method: 'POST',
      body: JSON.stringify({ title: `Api T ${suffix}`, body: 'Hello contract', ...overrides }),
    });
    if (res.status !== 201) throw new Error(`fixture create failed: ${res.status} ${JSON.stringify(res.body)}`);
    createdNotificationIds.push(String(res.body.id));
    return res.body;
  }

  async function stored(id: string): Promise<LooseDocument | null> {
    return models.notifications.findOne({ id }).lean<LooseDocument | null>();
  }

  async function storedSendResult(id: string): Promise<LooseDocument | null> {
    const doc = await stored(id);
    return (doc?.sendResult as LooseDocument | null | undefined) ?? null;
  }

  try {
    await models.roles.create([
      { id: ids.allowedRole, name: 'Api Test Allowed', permissions: ['NOTIFICATION_MANAGE'] },
      { id: ids.deniedRole, name: 'Api Test Denied', permissions: [] },
    ]);
    await models.admins.create([
      { id: ids.allowedAdmin, name: 'Api Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
      { id: ids.deniedAdmin, name: 'Api Denied', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
    ]);
    await models.users.create([
      { id: userA, name: 'Api A', status: 'active', plan: 'premium', lastSeen: now },
      { id: userB, name: 'Api B', status: 'active', plan: 'free', lastSeen: now },
    ]);

    console.log('\n[1] Auth + permission matrix');
    expect('unauthenticated list -> 401', (await call('/notifications', null)).status, 401);
    expect('unauthenticated create -> 401', (await call('/notifications', null, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b' }) })).status, 401);
    expect('unauthenticated send -> 401', (await call('/notifications/api_any/send', null, { method: 'POST' })).status, 401);
    expect('unauthenticated options -> 401', (await call('/notifications/options', null)).status, 401);
    expect('read without NOTIFICATION_MANAGE allowed -> 200', (await call('/notifications', ids.deniedSession)).status, 200);
    expect('create without NOTIFICATION_MANAGE -> 403', (await call('/notifications', ids.deniedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b' }) })).status, 403);
    expect('patch without NOTIFICATION_MANAGE -> 403', (await call('/notifications/api_any', ids.deniedSession, { method: 'PATCH', body: JSON.stringify({ title: 'x' }) })).status, 403);
    expect('send without NOTIFICATION_MANAGE -> 403', (await call('/notifications/api_any/send', ids.deniedSession, { method: 'POST' })).status, 403);
    expect('delete without NOTIFICATION_MANAGE -> 403', (await call('/notifications/api_any', ids.deniedSession, { method: 'DELETE' })).status, 403);

    console.log('\n[2] GET /notifications/options contract');
    const opts = await call('/notifications/options', ids.allowedSession);
    expect('options -> 200', opts.status, 200);
    expect('options channels', (opts.body.channels as string[]).join(','), NOTIFICATION_CHANNELS.join(','));
    expect('options channels are push,sms only (email removed)', (opts.body.channels as string[]).join(','), 'push,sms');
    expect('options sendableChannels', (opts.body.sendableChannels as string[]).join(','), SENDABLE_CHANNELS.join(','));
    expect('options statuses', (opts.body.statuses as string[]).join(','), NOTIFICATION_STATUSES.join(','));
    expect('options clientEditableStatuses', (opts.body.clientEditableStatuses as string[]).join(','), CLIENT_EDITABLE_STATUSES.join(','));
    expect(
      'options segments expose only the supported values',
      (opts.body.segments as Array<{ value: string }>).map((entry) => entry.value).join(','),
      SUPPORTED_SEGMENTS.join(',')
    );
    assertOk(
      'options segment labels match the contract constants',
      (opts.body.segments as Array<{ value: string; label: string }>).every(
        (entry) => entry.label === SEGMENT_LABELS[entry.value as keyof typeof SEGMENT_LABELS]
      )
    );
    expect('options uiFieldAliases.type', opts.body.uiFieldAliases?.type, 'channel');
    expect('options uiFieldAliases.targetSegment', opts.body.uiFieldAliases?.targetSegment, 'segmentId');
    expect('options uiFieldAliases.scheduledFor', opts.body.uiFieldAliases?.scheduledFor, 'scheduleAt');

    console.log('\n[3] Create contract + validation matrix');
    const minimal = await create({});
    assertOk('create -> server-generated notification id', String(minimal.id).startsWith('notification_'));
    expect('create defaults channel to push', minimal.channel, 'push');
    expect('create defaults status to draft', minimal.status, 'draft');
    expect('create defaults segmentId to null', minimal.segmentId, null);
    expect('create defaults scheduleAt to null', minimal.scheduleAt, null);
    expect('create defaults templateId to null', minimal.templateId, null);
    expect('create defaults sentAt to null', minimal.sentAt, null);
    expect('create defaults sendResult to null', minimal.sendResult, null);
    assertOk('create returns createdAt', typeof minimal.createdAt === 'string' && minimal.createdAt.length > 0);
    assertOk('create returns updatedAt', typeof minimal.updatedAt === 'string' && minimal.updatedAt.length > 0);
    expect('response aliases type', minimal.type, 'push');
    expect('response aliases targetSegment', minimal.targetSegment, null);
    expect('response aliases scheduledFor', minimal.scheduledFor, null);
    assertOk('internal dispatcher field is never returned', minimal.scheduledClaimedAt === undefined);

    const uiStyle = await create({ type: 'push', targetSegment: 'premium_users', scheduledFor: new Date(now.getTime() + 3_600_000).toISOString() });
    expect('UI vocabulary stored as canonical channel', (await stored(String(uiStyle.id)))?.channel, 'push');
    expect('UI vocabulary stored as canonical segmentId', (await stored(String(uiStyle.id)))?.segmentId, 'premium_users');
    assertOk('UI vocabulary stored as canonical scheduleAt date', (await stored(String(uiStyle.id)))?.scheduleAt instanceof Date);

    const labelStyle = await create({ targetSegment: 'Premium Subscribers' });
    expect('recognized UI segment label is canonicalized on write', (await stored(String(labelStyle.id)))?.segmentId, 'premium_users');
    expect('canonicalized segment is echoed back', labelStyle.segmentId, 'premium_users');

    expect('create without title -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ body: 'b' }) })).status, 400);
    expect('create with blank title -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: '   ', body: 'b' }) })).status, 400);
    expect('create without body -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't' }) })).status, 400);
    expect('create with unsupported channel -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', channel: 'pigeon' }) })).status, 400);
    expect(
      'create with email channel -> 400 (removed from the vocabulary)',
      (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', channel: 'email' }) })).status,
      400
    );
    const emailReject = await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', channel: 'email' }) });
    assertOk('email rejection lists the supported channels', /push, sms/.test(String(emailReject.body?.message ?? '')));
    const smsConfig = await create({ channel: 'sms' });
    expect('sms accepted as a notification configuration', smsConfig.channel, 'sms');
    const smsCallsBefore = fake.state.calls.length;
    const smsSendRes = await call(`/notifications/${String(smsConfig.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('sms send -> 400 (SMS delivery not implemented)', smsSendRes.status, 400);
    assertOk('sms send message is explicit', /SMS delivery is not implemented yet/.test(String(smsSendRes.body?.message ?? '')));
    expect('sms send never calls Firebase', fake.state.calls.length - smsCallsBefore, 0);
    expect('sms send leaves status draft (no delivery claim)', (await stored(String(smsConfig.id)))?.status, 'draft');
    expect('sms send writes no sentAt', (await stored(String(smsConfig.id)))?.sentAt, null);
    expect('create with unsupported status -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', status: 'queued' }) })).status, 400);
    expect('create with status sent -> 400 (pipeline-owned)', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', status: 'sent' }) })).status, 400);
    expect('create with status failed -> 400 (pipeline-owned)', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', status: 'failed' }) })).status, 400);
    expect('create scheduled without scheduleAt -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', status: 'scheduled' }) })).status, 400);
    expect('create with invalid scheduleAt -> 400', (await call('/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', scheduleAt: 'not-a-date' }) })).status, 400);
    const scheduledDoc = await create({ status: 'scheduled', scheduleAt: new Date(now.getTime() + 7_200_000).toISOString() });
    expect('create scheduled with scheduleAt -> 201', scheduledDoc.status, 'scheduled');
    assertOk('scheduled doc carries a real date', (await stored(String(scheduledDoc.id)))?.scheduleAt instanceof Date);
    const emptySchedule = await create({ scheduleAt: '' });
    expect('empty scheduleAt is treated as no schedule', emptySchedule.scheduleAt, null);

    console.log('\n[4] Client-supplied destinations can never be persisted');
    const injected = await create({
      userId: userA,
      token: tokenA1,
      tokens: [tokenA1, tokenA2],
      userIds: [userA, userB],
      fcmToken: tokenB1,
      deviceTokens: [tokenB1],
      sentAt: new Date().toISOString(),
      sendResult: { targeted: 99, successful: 99 },
    });
    const injectedStored = await stored(String(injected.id));
    for (const forbiddenKey of ['userId', 'token', 'tokens', 'userIds', 'fcmToken', 'deviceTokens']) {
      assertOk(`create ignores client-supplied '${forbiddenKey}'`, injectedStored?.[forbiddenKey] === undefined);
    }
    assertOk('create cannot pre-set sentAt', injectedStored?.sentAt === null);
    assertOk('create cannot pre-set sendResult', injectedStored?.sendResult === null);
    expect('create response does not echo the injected token', JSON.stringify(injected).includes(tokenA1), false);

    console.log('\n[5] List / detail contract');
    const list = await call('/notifications?_limit=50&_sort=createdAt&_order=desc');
    expect('list -> 200', list.status, 200);
    assertOk('list is an array', Array.isArray(list.body));
    const listed = (list.body as LooseDocument[]).find((entry) => String(entry.id) === String(minimal.id));
    assertOk('list contains the created notification', Boolean(listed));
    assertOk(
      'list rows carry both vocabularies',
      listed?.channel === 'push' && listed?.type === 'push' && listed?.segmentId === null && listed?.targetSegment === null
    );
    assertOk('list rows never include internal dispatcher fields', listed?.scheduledClaimedAt === undefined);
    assertOk('list rows never include Mongo internals', listed?._id === undefined && listed?.__v === undefined);
    const sentFilter = await call('/notifications?status=sent&_limit=50');
    assertOk('list status filter returns only sent rows', (sentFilter.body as LooseDocument[]).every((entry) => entry.status === 'sent'));
    const limited = await call('/notifications?_limit=2');
    assertOk('list honours _limit', (limited.body as LooseDocument[]).length <= 2);

    const detail = await call(`/notifications/${String(minimal.id)}`);
    expect('detail -> 200', detail.status, 200);
    expect('detail returns the canonical channel', detail.body.channel, 'push');
    expect('detail returns the legacy alias', detail.body.type, 'push');
    const missing = await call(`/notifications/api_missing_${suffix}`);
    expect('unknown detail -> 404', missing.status, 404);
    expect('404 uses the documented message', missing.body.message, 'notifications not found');

    console.log('\n[6] Update contract + status transitions');
    expect('patch title -> 200', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ title: `Patched ${suffix}` }) })).status, 200);
    expect('patch persisted the title', (await stored(String(minimal.id)))?.title, `Patched ${suffix}`);
    expect('patch with empty body -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({}) })).status, 400);
    expect('patch unknown -> 404', (await call(`/notifications/api_missing_${suffix}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ title: 'x' }) })).status, 404);
    expect('put unknown -> 404', (await call(`/notifications/api_missing_${suffix}`, ids.allowedSession, { method: 'PUT', body: JSON.stringify({ title: 'x', body: 'y' }) })).status, 404);

    expect('patch status sent by hand -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) })).status, 400);
    expect('patch status failed by hand -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) })).status, 400);
    expect('rejected status change left the stored status untouched', (await stored(String(minimal.id)))?.status, 'draft');
    expect('patch status scheduled without a date -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'scheduled' }) })).status, 400);
    expect('patch invalid scheduleAt -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ scheduleAt: 'nope' }) })).status, 400);
    const scheduledPatch = await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'scheduled', scheduleAt: new Date(now.getTime() + 3_600_000).toISOString() }),
    });
    expect('patch status scheduled with a date -> 200', scheduledPatch.status, 200);
    expect('patched status is scheduled', scheduledPatch.body.status, 'scheduled');
    expect('patch cannot strand a scheduled notification -> 400', (await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ scheduleAt: null }) })).status, 400);
    assertOk('stranding attempt left scheduleAt intact', (await stored(String(minimal.id)))?.scheduleAt instanceof Date);

    const putReplace = await call(`/notifications/${String(minimal.id)}`, ids.allowedSession, {
      method: 'PUT',
      body: JSON.stringify({ title: `Replaced ${suffix}`, body: 'Replaced body', channel: 'sms' }),
    });
    expect('put full replace -> 200', putReplace.status, 200);
    expect('put replaces channel', putReplace.body.channel, 'sms');
    expect('put without status resets to draft (documented full-replace semantics)', putReplace.body.status, 'draft');
    assertOk('put drops the untouched schedule (full replace)', (await stored(String(minimal.id)))?.scheduleAt === null);

    console.log('\n[7] Send contract: explicit outcome discriminator');
    await registerDeviceToken(userA, tokenA1, 'android');
    await registerDeviceToken(userA, tokenA2, 'ios');
    await registerDeviceToken(userB, tokenB1, 'android');
    for (const token of createdTokens) fake.state.responsesByToken[token] = { success: true };

    const okDoc = await create({ segmentId: 'premium_users' });
    const okSend = await call(`/notifications/${String(okDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('send -> 200', okSend.status, 200);
    expect('result.targeted', okSend.body.result.targeted, 2);
    expect('result.successful', okSend.body.result.successful, 2);
    expect('result.failed', okSend.body.result.failed, 0);
    expect('result.skipped is 0 today (reserved)', okSend.body.result.skipped, 0);
    expect('result.outcome = sent', okSend.body.result.outcome, 'sent');
    expect('notification status after send', okSend.body.notification.status, 'sent');
    assertOk('sentAt recorded on the response', typeof okSend.body.notification.sentAt === 'string');
    expect('persisted sendResult.outcome', (await storedSendResult(String(okDoc.id)))?.outcome, 'sent');
    expect('persisted sendResult counts', (await storedSendResult(String(okDoc.id)))?.successful, 2);
    const conflict = await call(`/notifications/${String(okDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('already-sent send -> 409', conflict.status, 409);
    assertOk('409 body explains the conflict', /already been sent/.test(String(conflict.body.message)));

    console.log('\n[8] Delivery state is not client-writable (sent is final)');
    const sentPut = await call(`/notifications/${String(okDoc.id)}`, ids.allowedSession, {
      method: 'PUT',
      body: JSON.stringify({ title: `Retitled ${suffix}`, body: 'kept delivery state' }),
    });
    expect('put without status on a sent notification -> 200', sentPut.status, 200);
    expect('put preserved status sent', sentPut.body.status, 'sent');
    assertOk('put preserved sentAt', typeof sentPut.body.sentAt === 'string');
    assertOk('put preserved sendResult', Boolean(sentPut.body.sendResult));
    expect('put reverting sent -> draft is rejected', (await call(`/notifications/${String(okDoc.id)}`, ids.allowedSession, { method: 'PUT', body: JSON.stringify({ title: 'x', body: 'y', status: 'draft' }) })).status, 400);
    expect('patch reverting sent -> draft is rejected', (await call(`/notifications/${String(okDoc.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) })).status, 400);
    expect('patch echoing the stored sent status is a no-op -> 200', (await call(`/notifications/${String(okDoc.id)}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) })).status, 200);
    expect('stored status is still sent', (await stored(String(okDoc.id)))?.status, 'sent');

    console.log('\n[9] Partial failure and complete failure');
    fake.state.responsesByToken[tokenA1] = { success: true };
    fake.state.responsesByToken[tokenA2] = { success: false, code: 'messaging/unavailable', message: 'Temporary backend error.' };
    fake.state.responsesByToken[tokenB1] = { success: true };
    const partialDoc = await create({ segmentId: 'all_users' });
    const partial = await call(`/notifications/${String(partialDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('partial send -> 200', partial.status, 200);
    expect('partial targeted', partial.body.result.targeted, 3);
    expect('partial successful', partial.body.result.successful, 2);
    expect('partial failed', partial.body.result.failed, 1);
    expect('partial outcome', partial.body.result.outcome, 'partial');
    expect('partial marks the notification sent', partial.body.notification.status, 'sent');
    assertOk('partial failure entry never leaks the full token', !JSON.stringify(partial.body.result.failures).includes(tokenA2));

    for (const token of createdTokens) fake.state.responsesByToken[token] = { success: false, code: 'messaging/internal-error', message: 'Temporary backend error.' };
    const failDoc = await create({ segmentId: 'all_users' });
    const failed = await call(`/notifications/${String(failDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('total failure send -> 200 (honest report)', failed.status, 200);
    expect('total failure outcome', failed.body.result.outcome, 'failed');
    expect('total failure successful = 0', failed.body.result.successful, 0);
    expect('total failure failed = targeted', failed.body.result.failed, 3);
    expect('total failure status = failed (retryable)', failed.body.notification.status, 'failed');
    assertOk('total failure writes no sentAt', (await stored(String(failDoc.id)))?.sentAt === null);
    expect('total failure persists outcome failed', (await storedSendResult(String(failDoc.id)))?.outcome, 'failed');
    expect('temporary failures never deactivate devices', await DeviceTokenModel.countDocuments({ token: tokenA2, isActive: true }), 1);
    expect('failed notification is retryable (no 409)', (await call(`/notifications/${String(failDoc.id)}/send`, ids.allowedSession, { method: 'POST' })).status, 200);

    console.log('\n[10] Zero devices: honest no_devices, never a fake delivery');
    const callsBefore = fake.state.calls.length;
    const zeroDoc = await create({ segmentId: 'inactive_users' });
    const zero = await call(`/notifications/${String(zeroDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('zero-device send -> 200', zero.status, 200);
    expect('zero-device outcome', zero.body.result.outcome, 'no_devices');
    expect('zero-device targeted', zero.body.result.targeted, 0);
    expect('zero-device successful', zero.body.result.successful, 0);
    expect('zero-device status unchanged', zero.body.notification.status, 'draft');
    assertOk('zero-device writes no sendResult', (await stored(String(zeroDoc.id)))?.sendResult === null);
    assertOk('zero-device writes no sentAt', (await stored(String(zeroDoc.id)))?.sentAt === null);
    expect('zero-device makes no Firebase call', fake.state.calls.length - callsBefore, 0);
    expect('zero-device audits a skip', await models.auditLogs.countDocuments({ action: 'notifications.sendSkipped', targetId: String(zeroDoc.id) }), 1);

    console.log('\n[11] Send ignores body-supplied destinations');
    const injDoc = await create({ segmentId: 'premium_users' });
    for (const token of createdTokens) fake.state.responsesByToken[token] = { success: true };
    const injCallsBefore = fake.state.calls.length;
    const inj = await call(`/notifications/${String(injDoc.id)}/send`, ids.allowedSession, {
      method: 'POST',
      body: JSON.stringify({ userId: userB, token: tokenB1, tokens: [tokenB1], segmentId: 'all_users', targeted: 99 }),
    });
    expect('send with injected body -> 200', inj.status, 200);
    expect('injected body cannot widen targeting', inj.body.result.targeted, 2);
    expect('injected body cannot override the counters', inj.body.result.targeted === 99, false);
    const injCall = fake.state.calls[fake.state.calls.length - 1];
    assertOk('injected token was never used', !(injCall.tokens ?? []).includes(tokenB1));

    console.log('\n[12] Legacy records stay readable and predictable');
    const legacyId = `api_legacy_${suffix}`;
    createdNotificationIds.push(legacyId);
    await models.notifications.collection.insertOne({
      id: legacyId,
      title: 'Legacy record',
      body: 'legacy body',
      type: 'push',
      targetSegment: 'Premium Subscribers',
      scheduledFor: new Date(now.getTime() + 60_000),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    const legacyGet = await call(`/notifications/${legacyId}`);
    expect('legacy detail -> 200', legacyGet.status, 200);
    expect('legacy stored UI field returned verbatim', legacyGet.body.targetSegment, 'Premium Subscribers');
    expect('legacy stored type returned verbatim', legacyGet.body.type, 'push');
    expect('legacy record gains the canonical channel projection', legacyGet.body.channel, 'push');
    expect('legacy record gains the canonical segmentId projection', legacyGet.body.segmentId, 'premium_users');
    assertOk('legacy record gains the canonical scheduleAt projection', legacyGet.body.scheduleAt !== null && legacyGet.body.scheduleAt !== undefined);
    expect(
      'legacy status change works from the stored legacy schedule date',
      (await call(`/notifications/${legacyId}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'scheduled' }) })).status,
      200
    );
    const seededGet = await call('/notifications/notif_1');
    if (seededGet.status === 200) {
      expect('seeded legacy record keeps its stored type verbatim', seededGet.body.type, 'campaign');
      expect('unmappable legacy type reports channel null (never invented)', seededGet.body.channel, null);
      expect('seeded legacy label maps to the canonical segment', seededGet.body.segmentId, 'all_users');
      expect('seeded legacy label is also returned verbatim', seededGet.body.targetSegment, 'All Users');
    }

    console.log('\n[13] Invalid / unregistered destination is deactivated, never deleted');
    fake.state.responsesByToken[tokenA1] = { success: true };
    fake.state.responsesByToken[tokenA2] = { success: false, code: 'messaging/registration-token-not-registered', message: 'Requested entity was not found.' };
    const invalidDoc = await create({ segmentId: 'premium_users' });
    const invalidSend = await call(`/notifications/${String(invalidDoc.id)}/send`, ids.allowedSession, { method: 'POST' });
    expect('invalid-destination send -> 200', invalidSend.status, 200);
    expect('invalid destination counted as failed', invalidSend.body.result.failed, 1);
    expect('invalid destination deactivated', await DeviceTokenModel.countDocuments({ token: tokenA2, isActive: false }), 1);
    expect('invalid destination never deleted', await DeviceTokenModel.countDocuments({ token: tokenA2 }), 1);
    const invalidAudit = await models.auditLogs
      .findOne({ action: 'notifications.sent', targetId: String(invalidDoc.id) })
      .lean<LooseDocument | null>();
    assertOk('audit notes the deactivation', /Deactivated 1 invalid device/.test(String(invalidAudit?.description)));

    console.log('\n[14] Exposure scan: no credentials, no full tokens, no internal fields');
    const forbidden = [
      'private_key',
      'BEGIN PRIVATE KEY',
      'client_email',
      'FIREBASE_SERVICE_ACCOUNT_PATH',
      'firebase-service-account',
      'Super Bae Mobile',
      'scheduledClaimedAt',
      '"__v"',
      'MongoServerError',
    ];
    for (const pattern of forbidden) {
      assertOk(`no '${pattern}' in any response`, capturedBodies.every((text) => !text.includes(pattern)));
    }
    for (const token of createdTokens) {
      assertOk(`full token ending ${token.slice(-6)} never appears in a response`, capturedBodies.every((text) => !text.includes(token)));
    }
    assertOk('synthetic destinations only (never real FCM tokens)', createdTokens.every((token) => token.startsWith('test:fcm:')));

    console.log('\n[15] Data safety');
    const notificationsAfter = await models.notifications.countDocuments();
    const devicesAfter = await DeviceTokenModel.countDocuments();
    const usersAfter = await models.users.countDocuments();
    expect('notifications delta equals the fixtures created', notificationsAfter, notificationsBefore + createdNotificationIds.length);
    expect('deviceTokens delta equals the synthetic registrations', devicesAfter, devicesBefore + createdTokens.length);
    expect('users delta equals the synthetic users', usersAfter, usersBefore + createdUserIds.length);
    const seededUntouched = await stored('notif_1');
    if (seededUntouched) {
      assertOk(
        'seeded notif_1 untouched (still sent, no send bookkeeping)',
        String(seededUntouched.status) === 'sent' && seededUntouched.sendResult == null
      );
    }
  } catch (error) {
    console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    // Per-record cleanup only: exactly the fixtures this run created.
    // Never deleteMany(), never a collection reset.
    for (const token of createdTokens) {
      await DeviceTokenModel.deleteOne({ token });
    }
    for (const id of createdNotificationIds) {
      await models.notifications.deleteOne({ id });
    }
    const testAudits = await models.auditLogs.find({ targetId: { $in: createdNotificationIds } }).lean<LooseDocument[]>();
    for (const audit of testAudits) {
      await models.auditLogs.deleteOne({ id: audit.id });
    }
    for (const userId of createdUserIds) {
      await models.users.deleteOne({ id: userId });
    }
    await models.adminSessions.deleteOne({ id: ids.allowedSession });
    await models.adminSessions.deleteOne({ id: ids.deniedSession });
    await models.admins.deleteOne({ id: ids.allowedAdmin });
    await models.admins.deleteOne({ id: ids.deniedAdmin });
    await models.roles.deleteOne({ id: ids.allowedRole });
    await models.roles.deleteOne({ id: ids.deniedRole });

    const notificationsEnd = await models.notifications.countDocuments();
    const devicesEnd = await DeviceTokenModel.countDocuments();
    const usersEnd = await models.users.countDocuments();
    const auditsEnd = await models.auditLogs.countDocuments();
    console.log(`--- after: notifications=${notificationsEnd} deviceTokens=${devicesEnd} users=${usersEnd} auditLogs=${auditsEnd} ---`);
    if (!process.exitCode) {
      expect('cleanup restored the notifications count', notificationsEnd, notificationsBefore);
      expect('cleanup restored the deviceTokens count', devicesEnd, devicesBefore);
      expect('cleanup restored the users count', usersEnd, usersBefore);
      console.log('\nALL NOTIFICATION API ASSERTIONS PASSED');
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});







