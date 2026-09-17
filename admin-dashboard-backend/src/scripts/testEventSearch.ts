import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';

async function request(baseUrl: string, path: string, token: string | undefined): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function testEventSearch(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    role: `test_search_role_${suffix}`,
    admin: `test_search_admin_${suffix}`,
    session: `test_search_session_${suffix}`,
    event: `test_search_event_${suffix}`,
    userAlpha: `test_search_alpha_${suffix}`,
    userBeta: `test_search_beta_${suffix}`,
    userGamma: `test_search_gamma_${suffix}`,
    regAlpha: `test_search_reg_alpha_${suffix}`,
    regBeta: `test_search_reg_beta_${suffix}`,
    regGamma: `test_search_reg_gamma_${suffix}`,
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
    await models.roles.create([{ id: ids.role, name: 'Search Test', permissions: ['EVENTS_MANAGE'] }]);
    await models.admins.create([{ id: ids.admin, name: 'Search Admin', email: `${ids.admin}@test.local`, password: 'test', roleId: ids.role, status: 'active' }]);
    await models.adminSessions.create([{ id: ids.session, adminId: ids.admin, token: ids.session, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null }]);
    await models.users.create([
      { id: ids.userAlpha, name: 'Alice Johnson', status: 'active' },
      { id: ids.userBeta, name: 'Bob Smith', status: 'active' },
      { id: ids.userGamma, name: 'Charlie Davis', status: 'active' },
    ]);
    await models.events.create({ id: ids.event, title: 'Search Event', type: 'online', date: new Date(Date.now() + 86_400_000), status: 'upcoming', category: 'Testing', capacity: 10 });
    await models.eventRegistrations.create([
      { id: ids.regAlpha, userId: ids.userAlpha, eventId: ids.event, status: 'registered', ticketCode: `TICKET-A-${suffix}` },
      { id: ids.regBeta, userId: ids.userBeta, eventId: ids.event, status: 'registered', ticketCode: `TICKET-B-${suffix}` },
      { id: ids.regGamma, userId: ids.userGamma, eventId: ids.event, status: 'cancelled', ticketCode: `TICKET-C-${suffix}` },
    ]);

    const noSearch = await request(baseUrl, `/events/${ids.event}/registrations`, ids.session);
    if (noSearch.status !== 200) throw new Error(`Expected 200 without search, received ${noSearch.status}.`);
    const noSearchBody = await noSearch.json() as { data: any[]; total: number };
    if (noSearchBody.total !== 3) throw new Error(`Expected 3 registrations without search, got ${noSearchBody.total}.`);

    const nameSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('Alice')}`, ids.session);
    if (nameSearch.status !== 200) throw new Error(`Expected 200 searching name, received ${nameSearch.status}.`);
    const nameBody = await nameSearch.json() as { data: any[]; total: number };
    if (nameBody.total !== 1) throw new Error(`Expected 1 result for name search, got ${nameBody.total}.`);
    if (!nameBody.data.some((r) => r.id === ids.regAlpha)) throw new Error('Expected Alice registration in name search results.');

    const partialSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('ice')}`, ids.session);
    if (partialSearch.status !== 200) throw new Error(`Expected 200 searching partial, received ${partialSearch.status}.`);
    const partialBody = await partialSearch.json() as { data: any[]; total: number };
    if (partialBody.total !== 1) throw new Error(`Expected 1 result for partial search, got ${partialBody.total}.`);
    if (!partialBody.data.some((r) => r.id === ids.regAlpha)) throw new Error('Expected Alice registration in partial search results.');

    const idSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent(ids.regBeta)}`, ids.session);
    if (idSearch.status !== 200) throw new Error(`Expected 200 searching ID, received ${idSearch.status}.`);
    const idBody = await idSearch.json() as { data: any[]; total: number };
    if (idBody.total !== 1) throw new Error(`Expected 1 result for ID search, got ${idBody.total}.`);
    if (!idBody.data.some((r) => r.id === ids.regBeta)) throw new Error('Expected Beta registration in ID search results.');

    const ticketSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent(`TICKET-C-${suffix}`)}`, ids.session);
    if (ticketSearch.status !== 200) throw new Error(`Expected 200 searching ticket, received ${ticketSearch.status}.`);
    const ticketBody = await ticketSearch.json() as { data: any[]; total: number };
    if (ticketBody.total !== 1) throw new Error(`Expected 1 result for ticket search, got ${ticketBody.total}.`);
    if (!ticketBody.data.some((r) => r.id === ids.regGamma)) throw new Error('Expected Gamma registration in ticket search results.');

    const emptySearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('ZZZNOMATCH')}`, ids.session);
    if (emptySearch.status !== 200) throw new Error(`Expected 200 for empty result search, received ${emptySearch.status}.`);
    const emptyBody = await emptySearch.json() as { data: any[]; total: number };
    if (emptyBody.total !== 0) throw new Error(`Expected 0 results for non-matching search, got ${emptyBody.total}.`);

    console.log('Event search tests passed.');
  } finally {
    await Promise.all([
      models.eventRegistrations.deleteMany({ id: { $in: [ids.regAlpha, ids.regBeta, ids.regGamma] } }),
      models.events.deleteMany({ id: ids.event }),
      models.users.deleteMany({ id: { $in: [ids.userAlpha, ids.userBeta, ids.userGamma] } }),
      models.adminSessions.deleteMany({ id: ids.session }),
      models.admins.deleteMany({ id: ids.admin }),
      models.roles.deleteMany({ id: ids.role }),
    ]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
  }
}

testEventSearch().catch((error: unknown) => {
  console.error('Event search test failed:', error);
  process.exitCode = 1;
});
