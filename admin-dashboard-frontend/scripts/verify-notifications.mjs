// scripts/verify-notifications.mjs
/**
 * Step 9 frontend verification — `npm run verify:notifications`.
 *
 * Verifies exactly what the Notifications UI depends on, using ONLY the
 * public API with clearly scoped `verify_ui_*` fixtures:
 *
 *  1. Unit checks of src/lib/notifications/helpers.ts (imported directly
 *     under Node's native type stripping): send-outcome messages for
 *     sent / partial / no_devices / failed, status rules, send-capability
 *     rules, and safe error mapping (403/500/400/409/network).
 *  2. HTTP flows the pages drive: list, options, create, edit (PATCH),
 *     delete, validation 400s, 401/403/404/409, and the honest
 *     `no_devices` send — deviceTokens is asserted 0 first, so the backend
 *     skips Firebase entirely (no FCM call, no fake delivery, no tokens).
 *  3. A sensitive-field scan over every captured response.
 *
 * Requirements: the backend running on API_BASE (default localhost:3001)
 * and MONGODB_URI (backend .env) reachable for scoped fixture cleanup.
 *
 * Cleanup is per-record deleteOne ONLY — never deleteMany(), never a reset.
 * Real outcomes 'sent'/'partial'/'failed' over HTTP would require mocking
 * Firebase inside the live server — instead they are unit-checked here and
 * covered end-to-end by the backend's test:notification-api (mocked FCM).
 */
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: fileURLToPath(new URL('../../admin-dashboard-backend/.env', import.meta.url)) });

const API_BASE = process.env.VERIFY_API_BASE || 'http://localhost:3001';
const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let passed = 0;
const failures = [];

function check(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
  }
}

async function counts(db) {
  return {
    notifications: await db.collection('notifications').countDocuments(),
    deviceTokens: await db.collection('deviceTokens').countDocuments(),
    users: await db.collection('users').countDocuments(),
    auditLogs: await db.collection('auditLogs').countDocuments(),
    roles: await db.collection('roles').countDocuments(),
    admins: await db.collection('admins').countDocuments(),
    adminSessions: await db.collection('adminSessions').countDocuments(),
  };
}

const captured = [];

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  captured.push(text);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
console.log('\n[1] Pure helper unit checks (src/lib/notifications/helpers.ts)');
// ---------------------------------------------------------------------------
const {
  describeSendOutcome,
  canSend,
  canSendNow,
  canRetry,
  canEdit,
  statusLine,
  statusSelectValues,
  friendlyError,
  channelLabel,
  segmentLabel,
  toDatetimeLocal,
  isFinalStatus,
} = await import('../src/lib/notifications/helpers.ts');

const sent = describeSendOutcome({ outcome: 'sent', targeted: 2, successful: 2, failed: 0, skipped: 0 });
check(sent.type === 'success', "outcome 'sent' → success toast");
check(sent.message.includes('Delivered to 2 of 2'), 'sent message shows delivery counts');

const partial = describeSendOutcome({ outcome: 'partial', targeted: 3, successful: 2, failed: 1, skipped: 0 });
check(partial.type === 'warning', "outcome 'partial' → warning toast");
check(partial.message.includes('2 of 3') && partial.message.includes('1 failed'), 'partial message shows success and failure counts');

const noDevices = describeSendOutcome({ outcome: 'no_devices', targeted: 0, successful: 0, failed: 0, skipped: 0 });
check(noDevices.type === 'warning', "outcome 'no_devices' → warning toast");
check(noDevices.message.includes('No active devices'), 'no_devices message states no active devices');
check(!/notification sent|delivered to/i.test(noDevices.message), 'no_devices message never claims a delivery');

const failed = describeSendOutcome({ outcome: 'failed', targeted: 3, successful: 0, failed: 3, skipped: 0 });
check(failed.type === 'error', "outcome 'failed' → error toast");
check(failed.message.startsWith('Delivery failed'), 'failed message says delivery failed');
check(describeSendOutcome(null).type === 'info', 'missing result → neutral info message');

const options = {
  channels: ['push', 'sms'],
  sendableChannels: ['push'],
  statuses: ['draft', 'scheduled', 'sent', 'failed'],
  clientEditableStatuses: ['draft', 'scheduled'],
  segments: [
    { value: 'all_users', label: 'All Users' },
    { value: 'active_users', label: 'Active Users (last 7 days)' },
    { value: 'premium_users', label: 'Premium Subscribers' },
    { value: 'inactive_users', label: 'Inactive Users' },
  ],
};
check(canSend({ status: 'draft', channel: 'push' }, options) === true, 'draft push can send');
check(canSend({ status: 'sent', channel: 'push' }, options) === false, 'sent can never send again');
check(canSend({ status: 'failed', channel: 'push' }, options) === true, 'failed push can retry via Send');
check(canSend({ status: 'draft', channel: 'email' }, options) === false, 'email is never offered as sendable');
check(canSend({ status: 'draft', channel: 'sms' }, options) === false, 'sms is configurable but never sendable');
check(canSend({ status: 'draft', channel: 'push' }, null) === false, 'without options no Send is offered');

// --- Status-driven action matrix (scheduling is a backend concern) ---------
// draft → Edit / Send Now / Delete · scheduled → Edit / Delete ·
// sent → View / Delete · failed → View / Retry / Delete
check(canSendNow('draft') === true, 'draft offers Send Now');
check(canSendNow('scheduled') === false, 'scheduled NEVER offers Send Now');
check(canSendNow('sent') === false, 'sent NEVER offers Send Now');
check(canSendNow('failed') === false, 'failed does not offer Send Now (it offers Retry)');

check(canRetry('failed') === true, 'failed offers Retry');
check(canRetry('draft') === false, 'draft does not offer Retry');
check(canRetry('scheduled') === false, 'scheduled NEVER offers Retry');
check(canRetry('sent') === false, 'sent NEVER offers Retry');

check(canEdit('draft') === true, 'draft is editable');
check(canEdit('scheduled') === true, 'scheduled is editable');
check(canEdit('sent') === false, 'sent is not editable (terminal)');
check(canEdit('failed') === false, 'failed is not editable');

check(canSend({ status: 'scheduled', channel: 'push' }, options) === false, 'scheduled push is never manually sendable');

// Status lines the list page renders under each badge.
check(/it will be sent automatically/i.test(statusLine('scheduled', '01/01/2030, 10:00:00')), 'scheduled line states automatic delivery');
check(statusLine('scheduled', '01/01/2030, 10:00:00').includes('01/01/2030, 10:00:00'), 'scheduled line shows the scheduled date/time');
check(statusLine('scheduled', null).toLowerCase().includes('backend scheduler'), 'scheduled line without a date names the backend scheduler');
check(/Send Now or schedule it/i.test(statusLine('draft')), 'draft line explains Send Now or schedule');
check(/delivery result/i.test(statusLine('sent')), 'sent line points at the delivery result');
check(/Retry or inspect the failure/i.test(statusLine('failed')), 'failed line explains Retry or inspect');

check(statusSelectValues('sent', options).join(',') === 'sent', 'sent status is read-only (no select choices)');
const failedChoices = statusSelectValues('failed', options);
check(
  failedChoices.includes('failed') &&
    failedChoices.includes('draft') &&
    failedChoices.includes('scheduled') &&
    !failedChoices.includes('sent'),
  'failed offers draft/scheduled/failed but never sent'
);
check(statusSelectValues('draft', options).join(',') === 'draft,scheduled', 'draft offers only client-editable statuses');
check(statusSelectValues('draft', null).join(',') === 'draft', 'without options only the current status shows');
check(isFinalStatus('sent') && !isFinalStatus('failed'), 'isFinalStatus matches the backend rule');

const err403 = Object.assign(new Error('Forbidden: NOTIFICATION_MANAGE permission required.'), { status: 403 });
check(friendlyError(err403, 'fallback').includes('permission to manage notifications'), '403 → clear permission message');
const err500 = Object.assign(new Error('MongoServerError: dump of internals'), { status: 500 });
const msg500 = friendlyError(err500, 'fallback');
check(!msg500.includes('MongoServerError') && msg500.includes('server'), '500 → generic message, internals hidden');
const err400 = Object.assign(new Error('title is required.'), { status: 400 });
check(friendlyError(err400, 'fallback') === 'title is required.', '400 backend validation message passes through');
const err409 = Object.assign(new Error('Notification has already been sent and cannot be sent again.'), { status: 409 });
check(/already been sent/.test(friendlyError(err409, 'fallback')), '409 backend message passes through');
check(friendlyError(new TypeError('fetch failed'), 'fallback').includes('reach the server'), 'network error → connection hint');
check(
  friendlyError(new Error('Schedule time must be in the future.'), 'fallback') === 'Schedule time must be in the future.',
  'local validation message passes through'
);
check(friendlyError('weird non-error', 'fallback message') === 'fallback message', 'unknown throw → caller fallback');

check(channelLabel('push') === 'Push', 'channel label renders');
check(channelLabel('sms') === 'SMS', 'sms label renders as SMS');
check(segmentLabel(options, null) === 'All Users', 'null segment → all_users label from options');
check(segmentLabel(options, 'premium_users') === 'Premium Subscribers', 'slug resolved via options labels');
check(segmentLabel(options, 'Legacy Custom') === 'Legacy Custom', 'unknown legacy segment shown verbatim');
check(
  typeof toDatetimeLocal('2026-03-01T10:00:00.000Z') === 'string' &&
    toDatetimeLocal('2026-03-01T10:00:00.000Z').length === 16,
  'datetime-local conversion produces YYYY-MM-DDThh:mm'
);
check(toDatetimeLocal('garbage') === '', 'invalid schedule renders an empty value');

// ---------------------------------------------------------------------------
console.log('\n[2] Backend reachability + scoped fixtures');
// ---------------------------------------------------------------------------
try {
  const probe = await fetch(`${API_BASE}/notifications/options`);
  if (!probe.ok && probe.status !== 401) throw new Error(`unexpected status ${probe.status}`);
} catch (error) {
  console.error(`\nCannot reach the backend at ${API_BASE}. Start it first (admin-dashboard-backend: node dist/index.js).`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('\nMONGODB_URI is missing (backend .env) — needed for scoped fixture cleanup.');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const before = await counts(db);
console.log('--- before:', JSON.stringify(before));

const ids = {
  allowedRole: `verify_ui_role_ok_${suffix}`,
  deniedRole: `verify_ui_role_no_${suffix}`,
  allowedAdmin: `verify_ui_admin_ok_${suffix}`,
  deniedAdmin: `verify_ui_admin_no_${suffix}`,
  allowedSession: `verify_ui_sess_ok_${suffix}`,
  deniedSession: `verify_ui_sess_no_${suffix}`,
};
await db.collection('roles').insertMany([
  { id: ids.allowedRole, name: 'Verify UI Allowed', permissions: ['NOTIFICATION_MANAGE'] },
  { id: ids.deniedRole, name: 'Verify UI Denied', permissions: [] },
]);
await db.collection('admins').insertMany([
  { id: ids.allowedAdmin, name: 'Verify UI Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
  { id: ids.deniedAdmin, name: 'Verify UI Denied', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
]);
await db.collection('adminSessions').insertMany([
  { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: new Date(), expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
  { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: new Date(), expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
]);

const fixtureNotificationIds = [];

try {
  // -------------------------------------------------------------------------
  console.log('\n[3] Auth + options contract');
  // -------------------------------------------------------------------------
  const unauth = await call('/notifications');
  check(unauth.status === 401, 'unauthenticated list → 401');
  const unauthSend = await call('/notifications/notif_1/send', { method: 'POST' });
  check(unauthSend.status === 401, 'unauthenticated send → 401');

  const opts = await call('/notifications/options', { token: ids.allowedSession });
  check(opts.status === 200, 'options → 200');
  check(opts.json?.channels?.join(',') === 'push,sms', 'options.channels = push, sms only (email removed)');
  check(
    Array.isArray(opts.json?.sendableChannels) && opts.json.sendableChannels.length === 1 && opts.json.sendableChannels[0] === 'push',
    'sendableChannels = push only (sms configurable, not sendable)'
  );
  check(opts.json?.clientEditableStatuses?.join(',') === 'draft,scheduled', 'clientEditableStatuses contract');
  check(opts.json?.statuses?.join(',') === 'draft,scheduled,sent,failed', 'statuses contract');
  check(
    Array.isArray(opts.json?.segments) &&
      opts.json.segments.map((segment) => segment.value).join(',') === 'all_users,active_users,premium_users,inactive_users',
    'exactly the four supported segment values'
  );
  check(
    Array.isArray(opts.json?.segments) && opts.json.segments.every((segment) => typeof segment.label === 'string' && segment.label),
    'every segment carries a display label'
  );
  check(opts.json?.uiFieldAliases?.type === 'channel' && opts.json?.uiFieldAliases?.targetSegment === 'segmentId', 'uiFieldAliases documented');

  // -------------------------------------------------------------------------
  console.log('\n[4] List rows carry both vocabularies, no internals');
  // -------------------------------------------------------------------------
  const list = await call('/notifications', { token: ids.allowedSession });
  check(list.status === 200, 'list → 200');
  check(Array.isArray(list.json), 'list is an array (page contract)');
  const row = Array.isArray(list.json) ? list.json[0] : undefined;
  check(
    row === undefined ||
      ('channel' in row &&
        'type' in row &&
        'segmentId' in row &&
        'targetSegment' in row &&
        'scheduleAt' in row &&
        'scheduledFor' in row &&
        'sentAt' in row &&
        'sendResult' in row),
    'rows expose canonical + legacy fields with explicit null bookkeeping'
  );
  check(!list.text.includes('scheduledClaimedAt'), 'list never exposes the scheduler claim field');

  // -------------------------------------------------------------------------
  console.log('\n[5] Create / edit / validation flows (same payloads the forms send)');
  // -------------------------------------------------------------------------
  const created = await call('/notifications', {
    token: ids.allowedSession,
    method: 'POST',
    body: {
      title: 'Verify UI fixture',
      body: 'created by verify-notifications',
      channel: 'push',
      segmentId: 'all_users',
      scheduleAt: null,
      status: 'draft',
    },
  });
  check(created.status === 201, 'create (canonical payload) → 201');
  const draftId = typeof created.json?.id === 'string' ? created.json.id : '';
  check(Boolean(draftId), 'server-generated notification id');
  if (draftId) fixtureNotificationIds.push(draftId);
  check(created.json?.sentAt === null && created.json?.sendResult === null, 'created record exposes explicit null bookkeeping');
  check(created.json?.type === 'push' && 'targetSegment' in created.json && 'scheduledFor' in created.json, 'legacy aliases echoed for the existing UI');

  const scheduled = await call('/notifications', {
    token: ids.allowedSession,
    method: 'POST',
    body: {
      title: 'Verify UI scheduled',
      body: 'future schedule fixture',
      channel: 'push',
      segmentId: 'all_users',
      scheduleAt: new Date(Date.now() + 3_600_000).toISOString(),
      status: 'scheduled',
    },
  });
  check(scheduled.status === 201 && scheduled.json?.status === 'scheduled', 'create scheduled with a future date → 201');
  if (typeof scheduled.json?.id === 'string') fixtureNotificationIds.push(scheduled.json.id);

  const noTitle = await call('/notifications', { token: ids.allowedSession, method: 'POST', body: { body: 'x' } });
  check(noTitle.status === 400, 'create without title → 400');
  const pipelineStatus = await call('/notifications', {
    token: ids.allowedSession,
    method: 'POST',
    body: { title: 't', body: 'b', status: 'sent' },
  });
  check(pipelineStatus.status === 400, 'create with pipeline-owned status → 400');
  const badDate = await call('/notifications', {
    token: ids.allowedSession,
    method: 'POST',
    body: { title: 't', body: 'b', scheduleAt: 'not-a-date' },
  });
  check(badDate.status === 400, 'create with invalid scheduleAt → 400');

  const patched = await call(`/notifications/${draftId}`, {
    token: ids.allowedSession,
    method: 'PATCH',
    body: { title: 'Verify UI fixture (edited)' },
  });
  check(patched.status === 200, 'edit (PATCH) → 200');
  const patchedGet = await call(`/notifications/${draftId}`, { token: ids.allowedSession });
  check(patchedGet.json?.title === 'Verify UI fixture (edited)', 'edit persisted the new title');
  const handSent = await call(`/notifications/${draftId}`, { token: ids.allowedSession, method: 'PATCH', body: { status: 'sent' } });
  check(handSent.status === 400, 'hand-set status sent on edit → 400');
  const afterHandSent = await call(`/notifications/${draftId}`, { token: ids.allowedSession });
  check(afterHandSent.json?.status === 'draft', 'status untouched after the rejected transition');
  const badPatchDate = await call(`/notifications/${draftId}`, { token: ids.allowedSession, method: 'PATCH', body: { scheduleAt: 'nope' } });
  check(badPatchDate.status === 400, 'invalid scheduleAt on edit → 400');

  const missing = await call(`/notifications/verify_ui_missing_${suffix}`, { token: ids.allowedSession });
  check(missing.status === 404 && missing.json?.message === 'notifications not found', 'unknown id → 404 with the documented message');
  const forbidden = await call('/notifications', {
    token: ids.deniedSession,
    method: 'POST',
    body: { title: 't', body: 'b' },
  });
  check(forbidden.status === 403, 'create without NOTIFICATION_MANAGE → 403');
  check(String(forbidden.json?.message ?? '').includes('NOTIFICATION_MANAGE'), '403 message names the required permission');
  const forbiddenSend = await call(`/notifications/${draftId}/send`, { token: ids.deniedSession, method: 'POST' });
  check(forbiddenSend.status === 403, 'send without NOTIFICATION_MANAGE → 403');
  const readOnlyList = await call('/notifications', { token: ids.deniedSession });
  check(readOnlyList.status === 200, 'reads only need authentication → 200');

  // -------------------------------------------------------------------------
  console.log('\n[6] Send flows (FCM-free while deviceTokens is 0)');
  // -------------------------------------------------------------------------
  if (before.deviceTokens !== 0) {
    console.log('  SKIP  deviceTokens is not 0 — refusing to exercise sends against real devices');
  } else {
    const zero = await call(`/notifications/${draftId}/send`, { token: ids.allowedSession, method: 'POST' });
    check(zero.status === 200, 'send with zero devices → 200 (honest no-op)');
    check(zero.json?.result?.outcome === 'no_devices', 'outcome = no_devices');
    check(zero.json?.result?.targeted === 0 && zero.json?.result?.successful === 0, 'targeted=0 successful=0 — no fake delivery claimed');
    check(zero.json?.notification?.status === 'draft', 'status unchanged by a zero-device send');
    check(zero.json?.notification?.sentAt === null && zero.json?.notification?.sendResult === null, 'no send bookkeeping written');
    check((await db.collection('deviceTokens').countDocuments()) === 0, 'deviceTokens still 0 (no FCM activity)');
    const skipAudit = await db.collection('auditLogs').findOne({ action: 'notifications.sendSkipped', targetId: draftId });
    check(Boolean(skipAudit), 'sendSkipped audit recorded');

    const conflict = await call('/notifications/notif_1/send', { token: ids.allowedSession, method: 'POST' });
    check(conflict.status === 409, 'already-sent notification → 409');
    check(/already been sent/.test(String(conflict.json?.message ?? '')), '409 carries the documented message');
    check((await db.collection('deviceTokens').countDocuments()) === 0, '409 short-circuits before any device work');

    const emailRejected = await call('/notifications', {
      token: ids.allowedSession,
      method: 'POST',
      body: { title: 'Verify UI email', body: 'must be rejected', channel: 'email', segmentId: 'all_users', scheduleAt: null, status: 'draft' },
    });
    check(emailRejected.status === 400, 'create with channel email → 400 (removed from the vocabulary)');
    check(/push, sms/.test(String(emailRejected.json?.message ?? '')), 'email rejection lists the supported channels');

    const smsFixture = await call('/notifications', {
      token: ids.allowedSession,
      method: 'POST',
      body: { title: 'Verify UI sms', body: 'sms configuration', channel: 'sms', segmentId: 'all_users', scheduleAt: null, status: 'draft' },
    });
    check(smsFixture.status === 201 && smsFixture.json?.channel === 'sms', 'sms accepted as a notification configuration → 201');
    if (typeof smsFixture.json?.id === 'string') fixtureNotificationIds.push(smsFixture.json.id);
    const smsSend = await call(`/notifications/${smsFixture.json?.id}/send`, { token: ids.allowedSession, method: 'POST' });
    check(smsSend.status === 400, 'send on the sms channel → 400 (not implemented)');
    check(/SMS delivery is not implemented yet/.test(String(smsSend.json?.message ?? '')), 'sms send explains SMS delivery is not implemented yet');
    check(smsSend.json?.notification === undefined, 'sms send returns no delivery result (nothing claimed)');
    check((await db.collection('deviceTokens').countDocuments()) === 0, 'sms send never touched devices / Firebase');
    const smsDoc = await call(`/notifications/${smsFixture.json?.id}`, { token: ids.allowedSession });
    check(
      smsDoc.json?.status === 'draft' && smsDoc.json?.sentAt === null && smsDoc.json?.sendResult === null,
      'sms send leaves status and bookkeeping untouched (no delivery claim)'
    );

    const weirdFixture = await call('/notifications', {
      token: ids.allowedSession,
      method: 'POST',
      body: { title: 'Verify UI weird segment', body: 'unsupported', channel: 'push', segmentId: 'verify_ui_weird_seg', scheduleAt: null, status: 'draft' },
    });
    if (typeof weirdFixture.json?.id === 'string') fixtureNotificationIds.push(weirdFixture.json.id);
    const weirdSend = await call(`/notifications/${weirdFixture.json?.id}/send`, { token: ids.allowedSession, method: 'POST' });
    check(weirdSend.status === 400, 'send with unsupported segment → 400 (never reaches Firebase)');
    check(/Supported segments/.test(String(weirdSend.json?.message ?? '')), '400 lists the supported segments');
  }

  // -------------------------------------------------------------------------
  console.log('\n[7] Delete flow + sensitive-field scan');
  // -------------------------------------------------------------------------
  const deleted = await call(`/notifications/${draftId}`, { token: ids.allowedSession, method: 'DELETE' });
  check(deleted.status === 200, 'delete → 200 with the removed record');
  check((await call(`/notifications/${draftId}`, { token: ids.allowedSession })).status === 404, 'deleted record → 404');

  const forbiddenPatterns = [
    'private_key',
    'BEGIN PRIVATE KEY',
    'client_email',
    'FIREBASE_SERVICE_ACCOUNT',
    'firebase-service-account',
    'Super Bae Mobile',
    'scheduledClaimedAt',
    '"__v"',
  ];
  for (const pattern of forbiddenPatterns) {
    check(captured.every((text) => !text.includes(pattern)), `no '${pattern}' in any captured response`);
  }
} catch (error) {
  failures.push(`unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
} finally {
  // -------------------------------------------------------------------------
  // Per-record cleanup ONLY: exactly the fixtures this run created.
  // Never deleteMany(), never a collection reset.
  // -------------------------------------------------------------------------
  for (const id of fixtureNotificationIds) {
    const auditRows = await db.collection('auditLogs').find({ targetId: id }).toArray();
    for (const audit of auditRows) {
      await db.collection('auditLogs').deleteOne({ id: audit.id });
    }
    await db.collection('notifications').deleteOne({ id });
  }
  for (const sessionId of [ids.allowedSession, ids.deniedSession]) {
    await db.collection('adminSessions').deleteOne({ id: sessionId });
  }
  for (const adminId of [ids.allowedAdmin, ids.deniedAdmin]) {
    await db.collection('admins').deleteOne({ id: adminId });
  }
  for (const roleId of [ids.allowedRole, ids.deniedRole]) {
    await db.collection('roles').deleteOne({ id: roleId });
  }

  const after = await counts(db);
  console.log('--- after: ', JSON.stringify(after));
  for (const [collection, value] of Object.entries(before)) {
    check(after[collection] === value, `count restored for ${collection} (${value})`);
  }
  const leakedNotifications = await db.collection('notifications').countDocuments({ id: /verify_ui_/ });
  const leakedRoles = await db.collection('roles').countDocuments({ id: /verify_ui_/ });
  const leakedAdmins = await db.collection('admins').countDocuments({ id: /verify_ui_/ });
  const leakedSessions = await db.collection('adminSessions').countDocuments({ id: /verify_ui_/ });
  check(
    leakedNotifications === 0 && leakedRoles === 0 && leakedAdmins === 0 && leakedSessions === 0,
    'no verify_ui_* fixtures left behind'
  );
  const seeded = await db.collection('notifications').findOne({ id: 'notif_1' }, { projection: { status: 1 } });
  check(seeded?.status === 'sent', 'pre-existing notification notif_1 untouched');

  await mongoose.disconnect();

  // -------------------------------------------------------------------------
  // [3] No frontend scheduler: scheduled delivery is a backend concern only.
  // -------------------------------------------------------------------------
  console.log('\n[3] No frontend scheduler / polling implementation');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const moduleDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const sources = {
    helpers: join(moduleDir, 'src/lib/notifications/helpers.ts'),
    list: join(moduleDir, 'src/app/admin/notifications/page.tsx'),
    create: join(moduleDir, 'src/app/admin/notifications/create/page.tsx'),
    detail: join(moduleDir, 'src/app/admin/notifications/[id]/page.tsx'),
  };
  const sourceText = Object.fromEntries(
    Object.entries(sources).map(([key, file]) => [key, readFileSync(file, 'utf8')])
  );
  for (const [key, text] of Object.entries(sourceText)) {
    check(!/setInterval\s*\(/.test(text), `${key}: no setInterval polling`);
    check(!/requestAnimationFrame\s*\(/.test(text), `${key}: no requestAnimationFrame loop`);
    // A `setTimeout` may only be the "redirect after save" timer, never a retry
    // or delivery loop — so no timer may call the send endpoint.
    check(!/setTimeout[\s\S]{0,200}(\/send|handleSend|fetchApi)/.test(text), `${key}: no setTimeout-based send`);
  }
  // Strip comments so documentation that *mentions* the internal field does
  // not count as code referencing it.
  const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check(
    !/scheduledClaimedAt/.test(Object.values(sourceText).map(codeOnly).join('\n')),
    'internal dispatcher field scheduledClaimedAt is never referenced in code'
  );
  check(
    /statusLine\(/.test(sourceText.list),
    'list page renders the per-status explanation (scheduled = automatic)'
  );

  console.log('');
  if (failures.length === 0) {
    console.log(`ALL NOTIFICATIONS UI VERIFICATIONS PASSED (${passed} assertions)`);
  } else {
    console.error(`${failures.length} FAILED / ${passed + failures.length} total:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  }
}






