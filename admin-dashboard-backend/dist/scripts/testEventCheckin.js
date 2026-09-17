"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const routes_1 = require("../routes");
async function request(baseUrl, path, token, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
}
async function testEventCheckin() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
    const ids = {
        deniedRole: `test_checkin_role_denied_${suffix}`,
        allowedRole: `test_checkin_role_allowed_${suffix}`,
        deniedAdmin: `test_checkin_admin_denied_${suffix}`,
        allowedAdmin: `test_checkin_admin_allowed_${suffix}`,
        deniedSession: `test_checkin_session_denied_${suffix}`,
        allowedSession: `test_checkin_session_allowed_${suffix}`,
        user: `test_checkin_user_${suffix}`,
        event: `test_checkin_event_${suffix}`,
        otherEvent: `test_checkin_other_event_${suffix}`,
        registration: `test_checkin_registration_${suffix}`,
        cancelled: `test_checkin_cancelled_${suffix}`,
        attended: `test_checkin_attended_${suffix}`,
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
            { id: ids.deniedRole, name: 'Check-in Denied', permissions: [] },
            { id: ids.allowedRole, name: 'Check-in Allowed', permissions: ['EVENTS_MANAGE'] },
        ]);
        await registry_1.models.admins.create([
            { id: ids.deniedAdmin, name: 'Check-in Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
            { id: ids.allowedAdmin, name: 'Check-in Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
        ]);
        await registry_1.models.adminSessions.create([
            { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
            { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        ]);
        await registry_1.models.users.create({ id: ids.user, name: 'Check-in Test User', status: 'active' });
        await registry_1.models.events.create([
            { id: ids.event, title: 'Check-in Event', type: 'online', date: new Date(Date.now() + 86_400_000), status: 'upcoming', category: 'Testing', capacity: 3, registeredCount: 3, checkedInCount: 0 },
            { id: ids.otherEvent, title: 'Other Event', type: 'online', date: new Date(Date.now() + 86_400_000), status: 'upcoming', category: 'Testing', capacity: 3, registeredCount: 0, checkedInCount: 0 },
        ]);
        await registry_1.models.eventRegistrations.create([
            { id: ids.registration, userId: ids.user, eventId: ids.event, status: 'registered', ticketCode: `TICKET-${suffix}` },
            { id: ids.cancelled, userId: ids.user, eventId: ids.event, status: 'cancelled', ticketCode: `CANCELLED-${suffix}` },
            { id: ids.attended, userId: ids.user, eventId: ids.event, status: 'attended', checkInDate: now, ticketCode: `ATTENDED-${suffix}` },
        ]);
        const denied = await request(baseUrl, `/events/${ids.event}/checkin`, ids.deniedSession, {
            method: 'POST', body: JSON.stringify({ registrationId: ids.registration }),
        });
        if (denied.status !== 403)
            throw new Error(`Expected check-in permission denial 403, received ${denied.status}.`);
        const missing = await request(baseUrl, `/events/${ids.event}/checkin`, ids.allowedSession, {
            method: 'POST', body: JSON.stringify({ registrationId: `missing-${suffix}` }),
        });
        if (missing.status !== 404)
            throw new Error(`Expected missing registration 404, received ${missing.status}.`);
        const wrongEvent = await request(baseUrl, `/events/${ids.otherEvent}/checkin`, ids.allowedSession, {
            method: 'POST', body: JSON.stringify({ registrationId: ids.registration }),
        });
        if (wrongEvent.status !== 404)
            throw new Error(`Expected wrong-event registration 404, received ${wrongEvent.status}.`);
        const cancelled = await request(baseUrl, `/events/${ids.event}/checkin`, ids.allowedSession, {
            method: 'POST', body: JSON.stringify({ ticketCode: `CANCELLED-${suffix}` }),
        });
        if (cancelled.status !== 409)
            throw new Error(`Expected cancelled registration 409, received ${cancelled.status}.`);
        const success = await request(baseUrl, `/events/${ids.event}/checkin`, ids.allowedSession, {
            method: 'POST', body: JSON.stringify({ ticketCode: `TICKET-${suffix}` }),
        });
        if (success.status !== 200)
            throw new Error(`Expected successful check-in 200, received ${success.status}.`);
        const checkedIn = await registry_1.models.eventRegistrations.findOne({ id: ids.registration }).lean();
        const eventAfterCheckin = await registry_1.models.events.findOne({ id: ids.event }).lean();
        if (checkedIn?.status !== 'attended' || !checkedIn.checkInDate)
            throw new Error('Expected registration to be attended with checkInDate.');
        if (eventAfterCheckin?.checkedInCount !== 1)
            throw new Error(`Expected checkedInCount=1, found ${eventAfterCheckin?.checkedInCount}.`);
        const duplicate = await request(baseUrl, `/events/${ids.event}/checkin`, ids.allowedSession, {
            method: 'POST', body: JSON.stringify({ registrationId: ids.registration }),
        });
        if (duplicate.status !== 409)
            throw new Error(`Expected duplicate check-in 409, received ${duplicate.status}.`);
        const eventAfterDuplicate = await registry_1.models.events.findOne({ id: ids.event }).lean();
        if (eventAfterDuplicate?.checkedInCount !== 1)
            throw new Error(`Expected checkedInCount to remain 1, found ${eventAfterDuplicate?.checkedInCount}.`);
        const audit = await registry_1.models.auditLogs.findOne({ targetType: 'event', targetId: ids.event, action: 'event.checkin' }).lean();
        if (!audit || !String(audit.description).includes(ids.registration))
            throw new Error('Expected event check-in audit log.');
        const attendees = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent(`TICKET-${suffix}`)}`, ids.allowedSession);
        if (attendees.status !== 200)
            throw new Error(`Expected attendee search 200, received ${attendees.status}.`);
        const attendeeBody = await attendees.json();
        if (attendeeBody.total !== 1)
            throw new Error(`Expected one attendee search result, found ${attendeeBody.total}.`);
        console.log('Event check-in Phase 5 test passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.auditLogs.deleteMany({ targetType: 'event', targetId: ids.event }),
            registry_1.models.eventRegistrations.deleteMany({ id: { $in: [ids.registration, ids.cancelled, ids.attended] } }),
            registry_1.models.events.deleteMany({ id: { $in: [ids.event, ids.otherEvent] } }),
            registry_1.models.users.deleteMany({ id: ids.user }),
            registry_1.models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
            registry_1.models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
            registry_1.models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
        ]);
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose_1.default.disconnect();
    }
}
testEventCheckin().catch((error) => {
    console.error('Event check-in Phase 5 test failed:', error);
    process.exitCode = 1;
});
