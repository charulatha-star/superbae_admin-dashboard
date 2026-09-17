import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';

async function request(baseUrl: string, path: string, token?: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

async function testEventRegistration(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    role: `test_registration_role_${suffix}`,
    adminOne: `test_registration_admin_one_${suffix}`,
    adminTwo: `test_registration_admin_two_${suffix}`,
    sessionOne: `test_registration_session_one_${suffix}`,
    sessionTwo: `test_registration_session_two_${suffix}`,
    userOne: `test_registration_user_one_${suffix}`,
    userTwo: `test_registration_user_two_${suffix}`,
    event: `test_registration_event_${suffix}`,
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
    await models.roles.create({ id: ids.role, name: 'Registration Test Role', permissions: [] });
    await models.admins.create([
      { id: ids.adminOne, name: 'Registration Admin One', email: `${ids.adminOne}@test.local`, password: 'test', roleId: ids.role, status: 'active' },
      { id: ids.adminTwo, name: 'Registration Admin Two', email: `${ids.adminTwo}@test.local`, password: 'test', roleId: ids.role, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.sessionOne, adminId: ids.adminOne, token: ids.sessionOne, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { id: ids.sessionTwo, adminId: ids.adminTwo, token: ids.sessionTwo, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);
    await models.users.create([
      { id: ids.userOne, name: 'Registration User One', status: 'active' },
      { id: ids.userTwo, name: 'Registration User Two', status: 'active' },
    ]);
    await models.events.create({
      id: ids.event,
      title: 'Registration Test Event',
      type: 'online',
      date: new Date(Date.now() + 86_400_000),
      status: 'upcoming',
      category: 'Testing',
      capacity: 1,
      registeredCount: 0,
      checkedInCount: 0,
    });

    const unauthorized = await request(baseUrl, `/events/${ids.event}/registrations`, undefined, {
      method: 'POST',
      body: JSON.stringify({ userId: ids.userOne }),
    });
    if (unauthorized.status !== 401) throw new Error(`Expected unauthorized registration 401, received ${unauthorized.status}.`);

    const raceResponses = await Promise.all([
      request(baseUrl, `/events/${ids.event}/registrations`, ids.sessionOne, { method: 'POST', body: JSON.stringify({ userId: ids.userOne }) }),
      request(baseUrl, `/events/${ids.event}/registrations`, ids.sessionTwo, { method: 'POST', body: JSON.stringify({ userId: ids.userTwo }) }),
    ]);
    const raceStatuses = raceResponses.map((response) => response.status).sort((a, b) => a - b);
    if (raceStatuses.join(',') !== '201,409') throw new Error(`Expected concurrent registration statuses 201,409, received ${raceStatuses.join(',')}.`);

    const registrations = await models.eventRegistrations.find({ eventId: ids.event }).lean();
    if (registrations.length !== 1) throw new Error(`Expected exactly one registration after race, found ${registrations.length}.`);
    const winner = registrations[0];
    const eventAfterRace = await models.events.findOne({ id: ids.event }).lean();
    if (eventAfterRace?.registeredCount !== 1) throw new Error(`Expected registeredCount=1 after race, found ${eventAfterRace?.registeredCount}.`);

    const duplicate = await request(baseUrl, `/events/${ids.event}/registrations`, winner.userId === ids.userOne ? ids.sessionOne : ids.sessionTwo, {
      method: 'POST',
      body: JSON.stringify({ userId: winner.userId }),
    });
    if (duplicate.status !== 409) throw new Error(`Expected duplicate registration 409, received ${duplicate.status}.`);

    const full = await request(baseUrl, `/events/${ids.event}/registrations`, winner.userId === ids.userOne ? ids.sessionTwo : ids.sessionOne, {
      method: 'POST',
      body: JSON.stringify({ userId: winner.userId === ids.userOne ? ids.userTwo : ids.userOne }),
    });
    if (full.status !== 409) throw new Error(`Expected full event 409, received ${full.status}.`);

    const cancelled = await request(baseUrl, `/events/${ids.event}/registrations/${winner.id}`, ids.sessionOne, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (cancelled.status !== 200) throw new Error(`Expected cancellation 200, received ${cancelled.status}.`);

    const eventAfterCancellation = await models.events.findOne({ id: ids.event }).lean();
    if (eventAfterCancellation?.registeredCount !== 0) throw new Error(`Expected registeredCount=0 after cancellation, found ${eventAfterCancellation?.registeredCount}.`);

    const replacementUserId = winner.userId === ids.userOne ? ids.userTwo : ids.userOne;
    const replacementToken = replacementUserId === ids.userOne ? ids.sessionOne : ids.sessionTwo;
    const replacement = await request(baseUrl, `/events/${ids.event}/registrations`, replacementToken, {
      method: 'POST',
      body: JSON.stringify({ userId: replacementUserId }),
    });
    if (replacement.status !== 201) throw new Error(`Expected registration after cancellation 201, received ${replacement.status}.`);

    await models.events.updateOne({ id: ids.event }, { $set: { status: 'archived' } });
    const archived = await request(baseUrl, `/events/${ids.event}/registrations`, replacementToken, {
      method: 'POST',
      body: JSON.stringify({ userId: winner.userId }),
    });
    if (archived.status !== 409) throw new Error(`Expected archived event conflict 409, received ${archived.status}.`);

    console.log('Event registration Phase 4 test passed.');
  } finally {
    await Promise.all([
      models.eventRegistrations.deleteMany({ eventId: ids.event }),
      models.events.deleteMany({ id: ids.event }),
      models.users.deleteMany({ id: { $in: [ids.userOne, ids.userTwo] } }),
      models.adminSessions.deleteMany({ id: { $in: [ids.sessionOne, ids.sessionTwo] } }),
      models.admins.deleteMany({ id: { $in: [ids.adminOne, ids.adminTwo] } }),
      models.roles.deleteMany({ id: ids.role }),
    ]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
  }
}

testEventRegistration().catch((error: unknown) => {
  console.error('Event registration Phase 4 test failed:', error);
  process.exitCode = 1;
});
