import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';

async function request(baseUrl: string, path: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function testAnonymousModeration(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    deniedRole: `test_role_denied_${suffix}`,
    allowedRole: `test_role_allowed_${suffix}`,
    deniedAdmin: `test_admin_denied_${suffix}`,
    allowedAdmin: `test_admin_allowed_${suffix}`,
    deniedSession: `test_session_denied_${suffix}`,
    allowedSession: `test_session_allowed_${suffix}`,
    user: `test_user_${suffix}`,
    post: `test_anonymous_post_${suffix}`,
  };

  const app = express();
  app.use(express.json());
  registerRoutes(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const now = new Date();

  try {
    await models.roles.create([
      { id: ids.deniedRole, name: 'Test Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Test Allowed', permissions: ['COMMUNITY_MODERATE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Test Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Test Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);
    await models.users.create({ id: ids.user, name: 'Test Anonymous Author', status: 'active' });
    await models.anonymousPosts.create({ id: ids.post, content: 'Moderation integration test post', status: 'pending', realAuthorId: ids.user, riskScore: 90 });

    const denied = await request(baseUrl, '/anonymousPosts', ids.deniedSession);
    if (denied.status !== 403) throw new Error(`Expected 403 without permission, received ${denied.status}.`);

    const allowed = await request(baseUrl, `/anonymousPosts?search=${encodeURIComponent('integration test')}`, ids.allowedSession);
    if (allowed.status !== 200) throw new Error(`Expected 200 with permission, received ${allowed.status}.`);

    const action = await request(baseUrl, `/anonymousPosts/${ids.post}/action`, ids.allowedSession, {
      method: 'POST',
      body: JSON.stringify({ action: 'suspend', reason: 'Integration test moderation action' }),
    });
    if (action.status !== 200) throw new Error(`Expected action 200, received ${action.status}.`);

    const auditLogs = await models.auditLogs.find({ targetId: { $in: [ids.post, ids.user] } }).lean();
    if (auditLogs.length < 2) throw new Error(`Expected at least two audit logs, found ${auditLogs.length}.`);
    console.log('Anonymous moderation integration test passed.');
  } finally {
    await Promise.all([
      models.auditLogs.deleteMany({ targetId: { $in: [ids.post, ids.user] } }),
      models.anonymousPosts.deleteMany({ id: ids.post }),
      models.users.deleteMany({ id: ids.user }),
      models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
      models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
      models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
    ]);
    await server.close();
  }
}

testAnonymousModeration().catch((error: unknown) => {
  console.error('Anonymous moderation integration test failed:', error);
  process.exitCode = 1;
});