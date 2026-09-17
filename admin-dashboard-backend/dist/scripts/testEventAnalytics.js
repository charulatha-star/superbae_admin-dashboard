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
async function request(baseUrl, path, token) {
    return fetch(`${baseUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
async function testEventAnalytics() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
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
            { id: ids.deniedRole, name: 'Analytics Denied', permissions: [] },
            { id: ids.allowedRole, name: 'Analytics Allowed', permissions: ['EVENTS_MANAGE'] },
        ]);
        await registry_1.models.admins.create([
            { id: ids.deniedAdmin, name: 'Analytics Denied Admin', email: `${ids.deniedAdmin}@test.local`, password: 'test', roleId: ids.deniedRole, status: 'active' },
            { id: ids.allowedAdmin, name: 'Analytics Allowed Admin', email: `${ids.allowedAdmin}@test.local`, password: 'test', roleId: ids.allowedRole, status: 'active' },
        ]);
        await registry_1.models.adminSessions.create([
            { id: ids.deniedSession, adminId: ids.deniedAdmin, token: ids.deniedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
            { id: ids.allowedSession, adminId: ids.allowedAdmin, token: ids.allowedSession, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
        ]);
        await registry_1.models.users.create([
            { id: ids.userOne, name: 'Analytics User One', status: 'active' },
            { id: ids.userTwo, name: 'Analytics User Two', status: 'active' },
        ]);
        await registry_1.models.events.create({ id: ids.event, title: 'Past Analytics Event', type: 'online', date: new Date(Date.now() - 86_400_000), status: 'completed', category: 'Testing', capacity: 4, registeredCount: 2, checkedInCount: 1 });
        await registry_1.models.events.collection.insertOne({ id: ids.zeroEvent, title: 'Zero Capacity Analytics Event', type: 'online', date: new Date(), status: 'upcoming', category: 'Testing', capacity: 0, registeredCount: 0, checkedInCount: 0 });
        await registry_1.models.eventRegistrations.create([
            { id: ids.attended, userId: ids.userOne, eventId: ids.event, status: 'attended', checkInDate: now, registrationDate: new Date(Date.now() - 172_800_000) },
            { id: ids.registered, userId: ids.userTwo, eventId: ids.event, status: 'registered', registrationDate: new Date(Date.now() - 86_400_000) },
            { id: ids.cancelled, userId: ids.userOne, eventId: ids.event, status: 'cancelled', registrationDate: new Date(Date.now() - 86_400_000) },
        ]);
        await registry_1.models.payments.create([
            { id: ids.directPayment, userId: ids.userOne, amount: 30, status: 'completed', paymentType: 'event', eventId: ids.event, createdAt: now },
            { id: ids.linkedPayment, userId: ids.userTwo, amount: 20, status: 'completed', paymentType: 'event', registrationId: ids.registered, createdAt: now },
        ]);
        const denied = await request(baseUrl, `/events/${ids.event}/analytics`, ids.deniedSession);
        if (denied.status !== 403)
            throw new Error(`Expected analytics permission denial 403, received ${denied.status}.`);
        const response = await request(baseUrl, `/events/${ids.event}/analytics`, ids.allowedSession);
        if (response.status !== 200)
            throw new Error(`Expected analytics 200, received ${response.status}.`);
        const analytics = await response.json();
        const expected = { registered: 2, capacity: 4, attended: 1, cancelled: 1, noShows: 1, revenue: 50 };
        for (const [key, value] of Object.entries(expected)) {
            if (analytics[key] !== value)
                throw new Error(`Expected ${key}=${value}, received ${analytics[key]}.`);
        }
        if (analytics.utilization !== 0.5 || analytics.attendanceRate !== 0.5 || analytics.cancellationRate !== 1 / 3 || analytics.noShowRate !== 0.5) {
            throw new Error('Expected analytics rates and utilization to use documented denominators.');
        }
        const zeroResponse = await request(baseUrl, `/events/${ids.zeroEvent}/analytics`, ids.allowedSession);
        if (zeroResponse.status !== 200)
            throw new Error(`Expected zero-capacity analytics 200, received ${zeroResponse.status}.`);
        const zeroAnalytics = await zeroResponse.json();
        if (zeroAnalytics.capacity !== 0 || zeroAnalytics.utilization !== 0 || zeroAnalytics.attendanceRate !== 0)
            throw new Error('Expected safe zero-capacity analytics values.');
        const summary = await request(baseUrl, '/events/analytics/summary', ids.allowedSession);
        if (summary.status !== 200)
            throw new Error(`Expected analytics summary 200, received ${summary.status}.`);
        console.log('Event analytics Phase 7 test passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.payments.deleteMany({ id: { $in: [ids.directPayment, ids.linkedPayment] } }),
            registry_1.models.eventRegistrations.deleteMany({ id: { $in: [ids.attended, ids.registered, ids.cancelled] } }),
            registry_1.models.events.deleteMany({ id: { $in: [ids.event, ids.zeroEvent] } }),
            registry_1.models.users.deleteMany({ id: { $in: [ids.userOne, ids.userTwo] } }),
            registry_1.models.adminSessions.deleteMany({ id: { $in: [ids.deniedSession, ids.allowedSession] } }),
            registry_1.models.admins.deleteMany({ id: { $in: [ids.deniedAdmin, ids.allowedAdmin] } }),
            registry_1.models.roles.deleteMany({ id: { $in: [ids.deniedRole, ids.allowedRole] } }),
        ]);
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose_1.default.disconnect();
    }
}
testEventAnalytics().catch((error) => {
    console.error('Event analytics Phase 7 test failed:', error);
    process.exitCode = 1;
});
