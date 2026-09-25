import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
import { registerRoutes } from '../routes';

/**
 * Notifications management verification: dedicated permission-gated router.
 * Ephemeral express server + UUID-scoped fixtures; cleanup uses deleteOne
 * per record (no broad deletes). Verifies 401/403 matrix, generic-CRUD
 * bypass elimination, CRUD compatibility, audit entries, permission seed
 * uniqueness, and that existing notification data is untouched.
 */

async function authed(baseUrl: string, path: string, token: string | undefined, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

function expect(label: string, actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  console.log(`  PASS  ${label} -> ${actual}`);
}

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const now = new Date();
  const ids = {
    deniedRole: `tntf_role_denied_${suffix}`,
    allowedRole: `tntf_role_allowed_${suffix}`,
    deniedAdmin: `tntf_admin_denied_${suffix}`,
    allowedAdmin: `tntf_admin_allowed_${suffix}`,
    deniedSession: `tntf_sess_denied_${suffix}`,
    allowedSession: `tntf_sess_allowed_${suffix}`,
  };
  const createdNotificationIds: string[] = [];

  const beforeCount = await models.notifications.countDocuments();
  console.log(`--- notifications before: ${beforeCount} doc(s) ---`);

  const app = express();
  app.use(express.json());
  registerRoutes(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await models.roles.create([
      { id: ids.deniedRole, name: 'Notification Test Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Notification Test Allowed', permissions: ['NOTIFICATION_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Notification Denied', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Notification Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
    ]);

    console.log('--- auth matrix ---');
    expect('unauthenticated GET /notifications', (await authed(baseUrl, '/notifications', undefined)).status, 401);
    expect('unauthenticated POST /notifications', (await authed(baseUrl, '/notifications', undefined, { method: 'POST', body: JSON.stringify({ title: 'x', body: 'y' }) })).status, 401);
    expect('denied GET /notifications (read allowed)', (await authed(baseUrl, '/notifications', ids.deniedSession)).status, 200);
    expect('denied POST /notifications', (await authed(baseUrl, '/notifications', ids.deniedSession, { method: 'POST', body: JSON.stringify({ title: 'x', body: 'y' }) })).status, 403);
    expect('denied PATCH /notifications/x', (await authed(baseUrl, '/notifications/some_id', ids.deniedSession, { method: 'PATCH', body: JSON.stringify({ title: 'x' }) })).status, 403);
    expect('denied DELETE /notifications/x', (await authed(baseUrl, '/notifications/some_id', ids.deniedSession, { method: 'DELETE' })).status, 403);

    console.log('--- validation ---');
    expect('create without title', (await authed(baseUrl, '/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ body: 'y' }) })).status, 400);
    expect('create invalid channel', (await authed(baseUrl, '/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', channel: 'pigeon' }) })).status, 400);
    expect('create invalid status', (await authed(baseUrl, '/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', status: 'queued' }) })).status, 400);
    expect('create invalid scheduleAt', (await authed(baseUrl, '/notifications', ids.allowedSession, { method: 'POST', body: JSON.stringify({ title: 't', body: 'b', scheduleAt: 'not-a-date' }) })).status, 400);

    console.log('--- CRUD ---');
    const createRes = await authed(baseUrl, '/notifications', ids.allowedSession, {
      method: 'POST',
      body: JSON.stringify({ title: `Notif A ${suffix}`, body: 'Hello', channel: 'push', scheduleAt: new Date(Date.now() + 86_400_000).toISOString(), status: 'draft' }),
    });
    expect('create notification', createRes.status, 201);
    const notifBody = (await createRes.json()) as { id: string; title: string; channel: string; status: string };
    createdNotificationIds.push(notifBody.id);
    const auditCount = await models.auditLogs.countDocuments({ action: 'notifications.created', targetId: notifBody.id });
    if (auditCount !== 1) throw new Error(`notifications.created audit missing (found ${auditCount}).`);
    console.log('  PASS  notifications.created audit -> 1');

    expect('patch existing with empty body -> 400', (await authed(baseUrl, `/notifications/${notifBody.id}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({}) })).status, 400);
    expect('patch nonexistent -> 404', (await authed(baseUrl, '/notifications/does_not_exist_x', ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ title: 'x' }) })).status, 404);
    expect('patch notification', (await authed(baseUrl, `/notifications/${notifBody.id}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ status: 'scheduled', title: `Notif A2 ${suffix}` }) })).status, 200);
    const patched = await models.notifications.findOne({ id: notifBody.id }).lean<LooseDocument | null>();
    if (!patched || String(patched.status) !== 'scheduled' || String(patched.title) !== `Notif A2 ${suffix}`) {
      throw new Error('PATCH did not persist the expected fields.');
    }
    console.log('  PASS  patch persisted status + title');

    expect('put notification', (await authed(baseUrl, `/notifications/${notifBody.id}`, ids.allowedSession, { method: 'PUT', body: JSON.stringify({ title: `Notif A3 ${suffix}`, body: 'Replaced', channel: 'sms' }) })).status, 200);
    const replaced = await models.notifications.findOne({ id: notifBody.id }).lean<LooseDocument | null>();
    if (!replaced || String(replaced.channel) !== 'sms' || String(replaced.status) !== 'draft') {
      throw new Error('PUT replace did not behave as expected.');
    }
    console.log('  PASS  put replaced fields');

    const getRes = await authed(baseUrl, `/notifications/${notifBody.id}`, ids.deniedSession);
    expect('get notification by id (read allowed)', getRes.status, 200);
    const listRes = await authed(baseUrl, `/notifications?_limit=5&_sort=createdAt&_order=desc`, ids.allowedSession);
    expect('list notifications (pagination params)', listRes.status, 200);
    const listBody = (await listRes.json()) as LooseDocument[];
    if (!Array.isArray(listBody)) throw new Error('List response is not an array.');
    console.log('  PASS  list returns array');

    expect('delete notification', (await authed(baseUrl, `/notifications/${notifBody.id}`, ids.allowedSession, { method: 'DELETE' })).status, 200);
    const stillThere = await models.notifications.findOne({ id: notifBody.id }).lean<LooseDocument | null>();
    if (stillThere) throw new Error('Deleted notification still present.');
    console.log('  PASS  delete removed document');
    const deleteAudit = await models.auditLogs.countDocuments({ action: 'notifications.deleted', targetId: notifBody.id });
    if (deleteAudit !== 1) throw new Error(`notifications.deleted audit missing (found ${deleteAudit}).`);
    console.log('  PASS  notifications.deleted audit -> 1');
    expect('get deleted notification -> 404', (await authed(baseUrl, `/notifications/${notifBody.id}`, ids.allowedSession)).status, 404);

    console.log('--- data integrity ---');
    const afterCount = await models.notifications.countDocuments();
    if (afterCount !== beforeCount) {
      throw new Error(`Notification count changed: before=${beforeCount} after=${afterCount}.`);
    }
    console.log(`  PASS  notification count unchanged (${beforeCount})`);

    const permDocs = await models.permissions.find({ id: 'NOTIFICATION_MANAGE' }).lean<LooseDocument[]>();
    if (permDocs.length !== 1) throw new Error(`Expected exactly 1 NOTIFICATION_MANAGE permission doc, found ${permDocs.length}.`);
    const perm = permDocs[0];
    if (perm.module !== 'notifications' || perm.resource !== 'notifications' || perm.action !== 'manage') {
      throw new Error('NOTIFICATION_MANAGE permission doc has unexpected module/resource/action.');
    }
    console.log('  PASS  exactly 1 NOTIFICATION_MANAGE permission doc (module/resource/action correct)');

    console.log('\nALL NOTIFICATION MANAGEMENT TESTS PASSED');
  } finally {
    for (const id of createdNotificationIds) {
      try {
        await models.notifications.deleteOne({ id });
      } catch (e) {
        console.error(`cleanup notification/${id} failed:`, e instanceof Error ? e.message : String(e));
      }
    }
    // Remove only the audit rows written by this test run. The filter is scoped
    // to the UUID test admins created above and deletes one document at a time,
    // so real audit history can never be affected.
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
    await mongoose.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Notification management test failed:', error);
    process.exit(1);
  });
