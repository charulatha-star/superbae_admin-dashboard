"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const routes_1 = require("../routes");
const eventImageStorage_1 = require("../services/eventImageStorage");
async function request(baseUrl, token) {
    return fetch(`${baseUrl}/event-management`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
}
async function testEventManagementBoundary() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
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
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    (0, routes_1.registerRoutes)(app);
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Test server did not expose a port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const now = new Date();
    try {
        await registry_1.models.roles.create([
            { id: ids.deniedRole, name: 'Event Test Denied', permissions: [] },
            { id: ids.allowedRole, name: 'Event Test Allowed', permissions: ['EVENTS_MANAGE'] },
        ]);
        await registry_1.models.admins.create([
            { id: ids.deniedAdmin, name: 'Event Test Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
            { id: ids.allowedAdmin, name: 'Event Test Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
        ]);
        await registry_1.models.adminSessions.create([
            { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
            { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        ]);
        const unauthenticated = await request(baseUrl);
        if (unauthenticated.status !== 401)
            throw new Error(`Expected 401 without authentication, received ${unauthenticated.status}.`);
        const denied = await request(baseUrl, ids.deniedSession);
        if (denied.status !== 403)
            throw new Error(`Expected 403 without EVENTS_MANAGE, received ${denied.status}.`);
        const allowed = await request(baseUrl, ids.allowedSession);
        if (allowed.status !== 200)
            throw new Error(`Expected 200 with EVENTS_MANAGE, received ${allowed.status}.`);
        // Create event with image URL (simulating uploaded image)
        const uploadDir = path_1.default.resolve(process.cwd(), 'uploads', 'events');
        if (!fs_1.default.existsSync(uploadDir))
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        const testImagePath = path_1.default.join(uploadDir, ids.imageFile);
        fs_1.default.writeFileSync(testImagePath, 'fake image content');
        const testImageUrl = (0, eventImageStorage_1.eventImageUrl)({ protocol: 'http:', get: () => 'localhost' }, ids.imageFile);
        const createResponse = await fetch(`${baseUrl}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
            body: JSON.stringify({ id: ids.event, title: 'Phase 3 Test Event', type: 'online', date: new Date(Date.now() + 86_400_000).toISOString(), category: 'Testing', capacity: 5, imageUrl: testImageUrl }),
        });
        if (createResponse.status !== 201)
            throw new Error(`Expected event create 201, received ${createResponse.status}.`);
        const createdEvent = await createResponse.json();
        if (!createdEvent.id)
            throw new Error('Expected created event ID.');
        ids.event = createdEvent.id;
        const createdImageUrl = createdEvent.imageUrl || testImageUrl;
        // Verify image file exists
        const createdImageFilename = createdImageUrl.match(/\/uploads\/events\/([^/?#]+)/)?.[1];
        if (!createdImageFilename)
            throw new Error('Expected image URL with filename');
        const createdImagePath = path_1.default.join(uploadDir, createdImageFilename);
        if (!fs_1.default.existsSync(createdImagePath))
            throw new Error('Expected uploaded image file to exist on disk');
        const genericRead = await fetch(`${baseUrl}/events/${ids.event}`, { headers: { Authorization: `Bearer ${ids.allowedSession}` } });
        if (genericRead.status !== 200)
            throw new Error(`Expected generic event GET 200, received ${genericRead.status}.`);
        const updateResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
            body: JSON.stringify({ title: 'Updated Phase 3 Test Event', capacity: 5 }),
        });
        if (updateResponse.status !== 200)
            throw new Error(`Expected event update 200, received ${updateResponse.status}.`);
        await registry_1.models.eventRegistrations.create({ id: ids.registration, userId: ids.allowedAdmin, eventId: ids.event, status: 'registered' });
        await registry_1.models.eventRegistrations.create({ id: ids.registrationTwo, userId: ids.deniedAdmin, eventId: ids.event, status: 'registered' });
        const conflictResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
            body: JSON.stringify({ capacity: 1 }),
        });
        if (conflictResponse.status !== 409)
            throw new Error(`Expected capacity conflict 409, received ${conflictResponse.status}.`);
        await registry_1.models.payments.create({ id: ids.payment, userId: ids.allowedAdmin, amount: 10, paymentType: 'event', eventId: ids.event, registrationId: ids.registration });
        // --- Test REAL DELETE (not archive) ---
        const deleteResponse = await fetch(`${baseUrl}/events/${ids.event}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${ids.allowedSession}` },
        });
        if (deleteResponse.status !== 204)
            throw new Error(`Expected event delete 204, received ${deleteResponse.status}.`);
        // Verify event is gone (404)
        const getDeleted = await fetch(`${baseUrl}/events/${ids.event}`, { headers: { Authorization: `Bearer ${ids.allowedSession}` } });
        if (getDeleted.status !== 404)
            throw new Error(`Expected deleted event GET 404, received ${getDeleted.status}.`);
        // Verify all registrations for this event are cascade deleted
        const remainingRegs = await registry_1.models.eventRegistrations.countDocuments({ eventId: ids.event });
        if (remainingRegs !== 0)
            throw new Error(`Expected 0 registrations after delete, found ${remainingRegs}.`);
        // Verify image file was deleted from disk
        if (fs_1.default.existsSync(createdImagePath))
            throw new Error('Expected uploaded image file to be deleted from disk');
        // Verify payments are NOT deleted (financial records preserved)
        const payment = await registry_1.models.payments.findOne({ id: ids.payment }).lean();
        if (!payment)
            throw new Error('Expected payment record to be preserved after event deletion.');
        // Verify audit log entry was created with enough detail (title, id)
        const auditLogs = await registry_1.models.auditLogs.find({ targetType: 'event', targetId: ids.event }).lean();
        if (auditLogs.length === 0)
            throw new Error('Expected audit log entry for deleted event.');
        const deleteAudit = auditLogs.find(a => a.action === 'event.deleted');
        if (!deleteAudit)
            throw new Error('Expected audit log with action event.deleted.');
        if (!deleteAudit.description.includes(ids.event))
            throw new Error('Audit log missing event ID.');
        if (!deleteAudit.description.includes('Phase 3 Test Event'))
            throw new Error('Audit log missing event title.');
        // Verify permission denied without EVENTS_MANAGE
        const newEventRes = await fetch(`${baseUrl}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ids.allowedSession}` },
            body: JSON.stringify({ id: `new_${ids.event}`, title: 'Another Event', type: 'online', date: new Date(Date.now() + 86_400_000).toISOString(), category: 'Testing', capacity: 5 }),
        });
        if (newEventRes.status !== 201)
            throw new Error(`Expected event create 201, received ${newEventRes.status}.`);
        const newEvent = await newEventRes.json();
        const newEventId = newEvent.id;
        const deniedDelete = await fetch(`${baseUrl}/events/${newEventId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${ids.deniedSession}` },
        });
        if (deniedDelete.status !== 403)
            throw new Error(`Expected 403 for delete without EVENTS_MANAGE, received ${deniedDelete.status}.`);
        console.log('Event management Phase 3 test passed (real deletion).');
    }
    finally {
        // Cleanup
        await Promise.all([
            registry_1.models.auditLogs.deleteMany({ targetType: 'event', targetId: ids.event }),
            registry_1.models.payments.deleteMany({ id: ids.payment }),
            registry_1.models.eventRegistrations.deleteMany({ eventId: ids.event }),
            registry_1.models.events.deleteMany({ id: ids.event }),
            registry_1.models.events.deleteMany({ id: `new_${ids.event}` }),
            registry_1.models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
            registry_1.models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
            registry_1.models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
        ]);
        // Clean up any leftover test image files
        const uploadDir = path_1.default.resolve(process.cwd(), 'uploads', 'events');
        const testFiles = [ids.imageFile, `${ids.event}.jpg`, `${ids.event}.png`, `${ids.event}.webp`, `${ids.event}.gif`];
        for (const f of testFiles) {
            const fp = path_1.default.join(uploadDir, f);
            if (fs_1.default.existsSync(fp))
                fs_1.default.unlinkSync(fp);
        }
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose_1.default.disconnect();
    }
}
testEventManagementBoundary().catch((error) => {
    console.error('Event management permission boundary test failed:', error);
    process.exitCode = 1;
});
