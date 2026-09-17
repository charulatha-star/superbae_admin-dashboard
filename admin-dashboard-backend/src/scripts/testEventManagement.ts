import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';
import { eventImageUrl } from '../services/eventImageStorage';

interface AuditLogDoc {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  description: string;
  createdAt: Date;
  targetType: string;
  targetId: string;
  reason: string | null;
}

async function request(baseUrl: string, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/event-management`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function testEventManagementBoundary(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    deniedRole: `test_event_role_denied_${suffix}`,
    allowedRole: `test_event_role_allowed_${suffix}`,
    deniedAdmin: `test_event_admin_denied_${suffix}`,
    allowedAdmin: `test_event_admin_allowed_${suffix}`,
    deniedSession: `test_event_session_denied_${suffix}`,
    allowedSession: `test_event_session_allowed_${suffix}`,
    event: `test_event_${suffix}`,
    registration: `test_event_registration_${suffix}`,
    registrationTwo: `test_event_registration_two_${suffix}`,
    payment: `test_event_payment_${suffix}`,
    imageFile: `test_event_image_${suffix}.jpg`,
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
      { id: ids.deniedRole, name: 'Event Test Denied', permissions: [] },
      { id: ids.allowedRole, name: 'Event Test Allowed', permissions: ['EVENTS_MANAGE'] },
    ]);
    await models.admins.create([
      { id: ids.deniedAdmin, name: 'Event Test Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
      { id: ids.allowedAdmin, name: 'Event Test Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
    ]);
    await models.adminSessions.create([
      { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
    ]);

    const unauthenticated = await request(baseUrl);
    if (unauthenticated.status !== 401) throw new Error(`Expected 401 without authentication, received ${unauthenticated.status}.`);

    const denied = await request(baseUrl, ids.deniedSession);
    if (denied.status !== 403) throw new Error(`Expected 403 without EVENTS_MANAGE, received ${denied.status}.`);

    const allowed = await request(baseUrl, ids.allowedSession);
    if (allowed.status !== 200) throw new Error(`Expected 200 with EVENTS_MANAGE, received ${allowed.status}.`);

    // Create event with image URL (simulating uploaded image)
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'events');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const testImagePath = path.join(uploadDir, ids.imageFile);
    fs.writeFileSync(testImagePath, 'fake image content');
    const testImageUrl = eventImageUrl({ protocol: 'http:', get: () => 'localhost' }, ids.imageFile);

    const createResponse = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
      body: JSON.stringify({ id: ids.event, title: 'Phase 3 Test Event', type: 'online', date: new Date(Date.now() + 86_400_000).toISOString(), category: 'Testing', capacity: 5, imageUrl: testImageUrl }),
    });
    if (createResponse.status !== 201) throw new Error(`Expected event create 201, received ${createResponse.status}.`);
    const createdEvent = await createResponse.json() as { id?: string; imageUrl?: string };
    if (!createdEvent.id) throw new Error('Expected created event ID.');
    ids.event = createdEvent.id;
    const createdImageUrl = createdEvent.imageUrl || testImageUrl;

    // Verify image file exists
    const createdImageFilename = createdImageUrl.match(/\/uploads\/events\/([^/?#]+)/)?.[1];
    if (!createdImageFilename) throw new Error('Expected image URL with filename');
    const createdImagePath = path.join(uploadDir, createdImageFilename);
    if (!fs.existsSync(createdImagePath)) throw new Error('Expected uploaded image file to exist on disk');

    const genericRead = await fetch(`${baseUrl}/events/${ids.event}`, { headers: { Authorization: `Bearer ${ids.allowedSession}` } });
    if (genericRead.status !== 200) throw new Error(`Expected generic event GET 200, received ${genericRead.status}.`);

    const updateResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
      body: JSON.stringify({ title: 'Updated Phase 3 Test Event', capacity: 5 }),
    });
    if (updateResponse.status !== 200) throw new Error(`Expected event update 200, received ${updateResponse.status}.`);

    await models.eventRegistrations.create({ id: ids.registration, userId: ids.allowedAdmin, eventId: ids.event, status: 'registered' });
    await models.eventRegistrations.create({ id: ids.registrationTwo, userId: ids.deniedAdmin, eventId: ids.event, status: 'registered' });
    const conflictResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
      body: JSON.stringify({ capacity: 1 }),
    });
    if (conflictResponse.status !== 409) throw new Error(`Expected capacity conflict 409, received ${conflictResponse.status}.`);

    await models.payments.create({ id: ids.payment, userId: ids.allowedAdmin, amount: 10, paymentType: 'event', eventId: ids.event, registrationId: ids.registration });

    // --- Test REAL DELETE (not archive) ---
    const deleteResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ids.allowedSession}` },
    });
    if (deleteResponse.status !== 204) throw new Error(`Expected event delete 204, received ${deleteResponse.status}.`);

    // Verify event is gone (404)
    const getDeleted = await fetch(`${baseUrl}/events/${ids.event}`, { headers: { Authorization: `Bearer ${ids.allowedSession}` } });
    if (getDeleted.status !== 404) throw new Error(`Expected deleted event GET 404, received ${getDeleted.status}.`);

    // Verify all registrations for this event are cascade deleted
    const remainingRegs = await models.eventRegistrations.countDocuments({ eventId: ids.event });
    if (remainingRegs !== 0) throw new Error(`Expected 0 registrations after delete, found ${remainingRegs}.`);

    // Verify image file was deleted from disk
    if (fs.existsSync(createdImagePath)) throw new Error('Expected uploaded image file to be deleted from disk');

    // Verify payments are NOT deleted (financial records preserved)
    const payment = await models.payments.findOne({ id: ids.payment }).lean();
    if (!payment) throw new Error('Expected payment record to be preserved after event deletion.');

    // Verify audit log entry was created with enough detail (title, id)
    const auditLogs = await models.auditLogs.find({ targetType: 'event', targetId: ids.event }).lean<AuditLogDoc[]>();
    if (auditLogs.length === 0) throw new Error('Expected audit log entry for deleted event.');
    const deleteAudit = auditLogs.find(a => a.action === 'event.deleted');
    if (!deleteAudit) throw new Error('Expected audit log with action event.deleted.');
    if (!deleteAudit.description.includes(ids.event)) throw new Error('Audit log missing event ID.');
    if (!deleteAudit.description.includes('Phase 3 Test Event')) throw new Error('Audit log missing event title.');

    // Verify permission denied without EVENTS_MANAGE
    const newEventRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
      body: JSON.stringify({ id: `new_${ids.event}`, title: 'Another Event', type: 'online', date: new Date(Date.now() + 86_400_000).toISOString(), category: 'Testing', capacity: 5 }),
    });
    if (newEventRes.status !== 201) throw new Error(`Expected event create 201, received ${newEventRes.status}.`);
    const newEvent = await newEventRes.json() as { id?: string };
    const newEventId = newEvent.id!;
    const deniedDelete = await fetch(`${baseUrl}/events/${newEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ids.deniedSession}` },
    });
    if (deniedDelete.status !== 403) throw new Error(`Expected 403 for delete without EVENTS_MANAGE, received ${deniedDelete.status}.`);

    console.log('Event management Phase 3 test passed (real deletion).');
  } finally {
    // Cleanup
    await Promise.all([
      models.auditLogs.deleteMany({ targetType: 'event', targetId: ids.event }),
      models.payments.deleteMany({ id: ids.payment }),
      models.eventRegistrations.deleteMany({ eventId: ids.event }),
      models.events.deleteMany({ id: ids.event }),
      models.events.deleteMany({ id: `new_${ids.event}` }),
      models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
      models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
      models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
    ]);
    // Clean up any leftover test image files
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'events');
    const testFiles = [ids.imageFile, `${ids.event}.jpg`, `${ids.event}.png`, `${ids.event}.webp`, `${ids.event}.gif`];
    for (const f of testFiles) {
      const fp = path.join(uploadDir, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.disconnect();
  }
}

testEventManagementBoundary().catch((error: unknown) => {
  console.error('Event management permission boundary test failed:', error);
  process.exitCode = 1;
});
