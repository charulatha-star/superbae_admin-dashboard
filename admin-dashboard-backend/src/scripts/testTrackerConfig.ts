import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
import { registerRoutes } from '../routes';

/**
 * Phase 2 verification: Tracker configuration backend.
 * Ephemeral express server + UUID-scoped fixtures; cleanup uses
 * deleteOne per record (no broad deletes). Verifies 401/403/matrix,
 * duplicate trackerType 409, enum validation, CRUD, singletons, audit.
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
    deniedRole: `ttrk_role_denied_${suffix}`,
    allowedRole: `ttrk_role_allowed_${suffix}`,
    deniedAdmin: `ttrk_admin_denied_${suffix}`,
    allowedAdmin: `ttrk_admin_allowed_${suffix}`,
    deniedSession: `ttrk_sess_denied_${suffix}`,
    allowedSession: `ttrk_sess_allowed_${suffix}`,
  };
  const created: Array<{ resource: 'moodOptions' | 'expenseCategories'; id: string }> = [];

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
      { id: ids.deniedRole, name: 'Tracker Test Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Tracker Test Allowed', permissions: ['TRACKER_CONFIG_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Tracker Denied', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Tracker Allowed', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
    ]);

    console.log('--- auth matrix ---');
    expect('unauthenticated GET /trackers', (await authed(baseUrl, '/trackers', undefined)).status, 401);
    expect('unauthenticated POST /trackers', (await authed(baseUrl, '/trackers', undefined, { method: 'POST', body: '{}' })).status, 401);
    expect('denied GET /trackers (read allowed)', (await authed(baseUrl, '/trackers', ids.deniedSession)).status, 200);
    expect('denied POST /trackers', (await authed(baseUrl, '/trackers', ids.deniedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'mood', name: 'X' }) })).status, 403);
    expect('denied POST /moodOptions', (await authed(baseUrl, '/moodOptions', ids.deniedSession, { method: 'POST', body: '{}' })).status, 403);
    expect('denied PATCH /waterUnits', (await authed(baseUrl, '/waterUnits', ids.deniedSession, { method: 'PATCH', body: '{}' })).status, 403);

    console.log('--- validation ---');
    expect('duplicate trackerType mood', (await authed(baseUrl, '/trackers', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'mood', name: 'Dup Mood' }) })).status, 409);
    expect('invalid trackerType enum', (await authed(baseUrl, '/trackers', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'nope', name: 'Bad' }) })).status, 400);
    expect('legacy shape rejected', (await authed(baseUrl, '/trackers', ids.allowedSession, { method: 'POST', body: JSON.stringify({ name: 'Water Intake', category: 'Health', unit: 'ml', status: 'active' }) })).status, 400);
    expect('invalid expenseType', (await authed(baseUrl, '/expenseCategories', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'expense', label: 'Bad', expenseType: 'bogus' }) })).status, 400);
    expect('invalid cadence', (await authed(baseUrl, '/reminderTemplates', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'mood', defaultMessage: 'x', defaultCadence: 'hourly' }) })).status, 400);
    expect('imperial units rejected', (await authed(baseUrl, '/measurementUnits', ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ unitSystem: 'imperial' }) })).status, 400);
    expect('invalid option trackerType', (await authed(baseUrl, '/moodOptions', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'nope', label: 'x' }) })).status, 400);

    console.log('--- option CRUD + audit ---');
    const moodRes = await authed(baseUrl, '/moodOptions', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'mood', label: `Calm ${suffix}` }) });
    expect('create moodOption', moodRes.status, 201);
    const moodBody = (await moodRes.json()) as { id: string };
    created.push({ resource: 'moodOptions', id: moodBody.id });
    const moodAudit = await models.auditLogs.countDocuments({ action: 'moodOptions.created', targetId: moodBody.id });
    if (moodAudit !== 1) throw new Error(`moodOptions.created audit missing (found ${moodAudit}).`);
    console.log('  PASS  moodOptions.created audit -> 1');
    expect('patch moodOption', (await authed(baseUrl, `/moodOptions/${moodBody.id}`, ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ label: `Serene ${suffix}` }) })).status, 200);
    const expRes = await authed(baseUrl, '/expenseCategories', ids.allowedSession, { method: 'POST', body: JSON.stringify({ trackerType: 'expense', label: `Test Exp ${suffix}`, expenseType: 'expense' }) });
    expect('create expenseCategory', expRes.status, 201);
    const expBody = (await expRes.json()) as { id: string };
    created.push({ resource: 'expenseCategories', id: expBody.id });

    console.log('--- singletons ---');
    expect('read measurementUnits', (await authed(baseUrl, '/measurementUnits', ids.deniedSession)).status, 200);
    expect('patch waterUnits dailyGoal', (await authed(baseUrl, '/waterUnits', ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ dailyGoalMl: 1200 }) })).status, 200);
    const wuAudit = await models.auditLogs.countDocuments({ action: 'waterUnits.updated' });
    if (wuAudit < 1) throw new Error('waterUnits.updated audit missing.');
    console.log('  PASS  waterUnits.updated audit -> present');
    expect('restore waterUnits dailyGoal', (await authed(baseUrl, '/waterUnits', ids.allowedSession, { method: 'PATCH', body: JSON.stringify({ dailyGoalMl: 1000 }) })).status, 200);

    console.log('--- legacy absence ---');
    const legacy = await models.trackers.findOne({ id: 'track_1' }).lean<LooseDocument | null>();
    if (legacy) throw new Error('track_1 unexpectedly present.');
    console.log('  PASS  track_1 absent');
    const count = await models.trackers.countDocuments();
    if (count !== 10) throw new Error(`Expected 10 trackers, found ${count}.`);
    console.log('  PASS  10 canonical trackers');

    console.log('\nALL TRACKER CONFIG TESTS PASSED');
  } finally {
    for (const { resource, id } of created) {
      try {
        await models[resource].deleteOne({ id });
      } catch (e) {
        console.error(`cleanup ${resource}/${id} failed:`, e instanceof Error ? e.message : String(e));
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
    process.exit(0);
  }
}

main().catch((error: unknown) => {
  console.error('Tracker config test failed:', error);
  process.exit(1);
});




