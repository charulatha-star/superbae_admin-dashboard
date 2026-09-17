import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';

async function request(baseUrl: string, path: string, token: string | undefined): Promise<Response> {
  return fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

async function testEventAnalytics(): Promise<void> {
  await connectDB();
  const suffix = randomUUID();
  const ids = {
    deniedRole: `test_analytics_role_denied_${suffix}`,
    allowedRole: `test_analytics_role_allowed_${suffix}`,
    deniedAdmin: `test_analytics_admin_denied_${suffix}`,
    allowedAdmin: `test_analytics_admin_allowed_${suffix}`,
    deniedSession: `test_analytics_session_denied_${suffix}`,
    allowedSession: `test_analytics_session_allowed_${suffix}`,
    userOne: `test_analytics_user_one_${suffix}`,
    userTwo: `test_analytics_user_two_${suffix}`,
    event: `test_analytics_event_${suffix}`,
    zeroEvent: `test_analytics_zero_event_${suffix}`,
    attended: `test_analytics_attended_${suffix}`,
    registered: `test_analytics_registered_${suffix}`,
    cancelled: `test_analytics_cancelled_${suffix}`,
    directPayment: `test_analytics_direct_payment_${suffix}`,
    linkedPayment: `test_analytics_linked_payment_${suffix}`,
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
      { id: ids.deniedRole, name: 'Analytics Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Analytics Allowed', permissions: ['EVENTS_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Analytics Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Analytics Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);
    await models.users.create([
      { id: ids.userOne, name: 'Analytics User One', status: 'active' },
      { id: ids.userTwo, name: 'Analytics User Two', status: 'active' },
    ]);
    await models.events.create({ id: ids.event, title: 'Past Analytics Event', type: 'online', date: new Date(Date.now() - 86_400_000), status: 'completed', category: 'Testing', capacity: 4, registeredCount: 2, checkedInCount: 1 });
    await models.events.collection.insertOne({ id: ids.zeroEvent, title: 'Zero Capacity Analytics Event', type: 'online', date: new Date(), status: 'upcoming', category: 'Testing', capacity: 0, registeredCount: 0, checkedInCount: 0 });
    await models.eventRegistrations.create([
      { id: ids.attended, userId: ids.userOne, eventId: ids.event, status: 'attended', checkInDate: now, registrationDate: new Date(Date.now() - 172_800_000) },
      { id: ids.registered, userId: ids.userTwo, eventId: ids.event, status: 'registered', registrationDate: new Date(Date.now() - 86_400_000) },
      { id: ids.cancelled, userId: ids.userOne, eventId: ids.event, status: 'cancelled', registrationDate: new Date(Date.now() - 86_400_000) },
    ]);
    await models.payments.create([
      { id: ids.directPayment, userId: ids.userOne, amount: 30, status: 'completed', paymentType: 'event', eventId: ids.event, createdAt: now },
      { id: ids.linkedPayment, userId: ids.userTwo, amount: 20, status: 'completed', paymentType: 'event', registrationId: ids.registered, createdAt: now },
    ]);

    const denied = await request(baseUrl, `/events/${ids.event}/analytics`, ids.deniedSession);
    if (denied.status !== 403) throw new Error(`Expected analytics permission denial 403, received ${denied.status}.`);

    const response = await request(baseUrl, `/events/${ids.event}/analytics`, ids.allowedSession);
    if (response.status !== 200) throw new Error(`Expected analytics 200, received ${response.status}.`);
    const analytics = await response.json() as Record<string, any>;
    const expected: Record<string, number> = { registered: 2, capacity: 4, attended: 1, cancelled: 1, noShows: 1, revenue: 50 };
    for (const [key, value] of Object.entries(expected)) {
      if (analytics[key] !== value) throw new Error(`Expected ${key}=${value}, received ${analytics[key]}.`);
    }
    if (analytics.utilization !== 0.5 || analytics.attendanceRate !== 0.5 || analytics.cancellationRate !== 1 / 3 || analytics.noShowRate !== 0.5) {
      throw new Error('Expected analytics rates and utilization to use documented denominators.');
    }

    const zeroResponse = await request(baseUrl, `/events/${ids.zeroEvent}/analytics`, ids.allowedSession);
    if (zeroResponse.status !== 200) throw new Error(`Expected zero-capacity analytics 200, received ${zeroResponse.status}.`);
    const zeroAnalytics = await zeroResponse.json() as Record<string, any>;
    if (zeroAnalytics.capacity !== 0 || zeroAnalytics.utilization !== 0 || zeroAnalytics.attendanceRate !== 0) throw new Error('Expected safe zero-capacity analytics values.');

    const summary = await request(baseUrl, '/events/analytics/summary', ids.allowedSession);
    if (summary.status !== 200) throw new Error(`Expected analytics summary 200, received ${summary.status}.`);
    console.log('Event analytics Phase 7 test passed.');
  } finally {
    await Promise.all([
      models.payments.deleteMany({ id: { $in: [ids.directPayment, ids.linkedPayment] } }),
      models.eventRegistrations.deleteMany({ id: { $in: [ids.attended, ids.registered, ids.cancelled] } }),
      models.events.deleteMany({ id: { $in: [ids.event, ids.zeroEvent] } }),
      models.users.deleteMany({ id: { $in: [ids.userOne, ids.userTwo] } }),
      models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
      models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
      models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
    ]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
  }
}

testEventAnalytics().catch((error: unknown) => {
  console.error('Event analytics Phase 7 test failed:', error);
  process.exitCode = 1;
});
