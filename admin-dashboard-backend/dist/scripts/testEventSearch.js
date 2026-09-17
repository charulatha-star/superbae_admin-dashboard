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
    return fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
}
async function testEventSearch() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
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
        await registry_1.models.roles.create([{ id: ids.role, name: 'Search Test', permissions: ['EVENTS_MANAGE'] }]);
        await registry_1.models.admins.create([{ id: ids.admin, name: 'Search Admin', email: `${ids.admin}@test.local`, password: 'test', roleId: ids.role, status: 'active' }]);
        await registry_1.models.adminSessions.create([{ id: ids.session, adminId: ids.admin, token: ids.session, createdAt: now, expiresAt: new Date(Date.now() + 60_000), revokedAt: null }]);
        await registry_1.models.users.create([
            { id: ids.userAlpha, name: 'Alice Johnson', status: 'active' },
            { id: ids.userBeta, name: 'Bob Smith', status: 'active' },
            { id: ids.userGamma, name: 'Charlie Davis', status: 'active' },
        ]);
        await registry_1.models.events.create({ id: ids.event, title: 'Search Event', type: 'online', date: new Date(Date.now() + 86_400_000), status: 'upcoming', category: 'Testing', capacity: 10 });
        await registry_1.models.eventRegistrations.create([
            { id: ids.regAlpha, userId: ids.userAlpha, eventId: ids.event, status: 'registered', ticketCode: `TICKET-A-${suffix}` },
            { id: ids.regBeta, userId: ids.userBeta, eventId: ids.event, status: 'registered', ticketCode: `TICKET-B-${suffix}` },
            { id: ids.regGamma, userId: ids.userGamma, eventId: ids.event, status: 'cancelled', ticketCode: `TICKET-C-${suffix}` },
        ]);
        const noSearch = await request(baseUrl, `/events/${ids.event}/registrations`, ids.session);
        if (noSearch.status !== 200)
            throw new Error(`Expected 200 without search, received ${noSearch.status}.`);
        const noSearchBody = await noSearch.json();
        if (noSearchBody.total !== 3)
            throw new Error(`Expected 3 registrations without search, got ${noSearchBody.total}.`);
        const nameSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('Alice')}`, ids.session);
        if (nameSearch.status !== 200)
            throw new Error(`Expected 200 searching name, received ${nameSearch.status}.`);
        const nameBody = await nameSearch.json();
        if (nameBody.total !== 1)
            throw new Error(`Expected 1 result for name search, got ${nameBody.total}.`);
        if (!nameBody.data.some((r) => r.id === ids.regAlpha))
            throw new Error('Expected Alice registration in name search results.');
        const partialSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('ice')}`, ids.session);
        if (partialSearch.status !== 200)
            throw new Error(`Expected 200 searching partial, received ${partialSearch.status}.`);
        const partialBody = await partialSearch.json();
        if (partialBody.total !== 1)
            throw new Error(`Expected 1 result for partial search, got ${partialBody.total}.`);
        if (!partialBody.data.some((r) => r.id === ids.regAlpha))
            throw new Error('Expected Alice registration in partial search results.');
        const idSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent(ids.regBeta)}`, ids.session);
        if (idSearch.status !== 200)
            throw new Error(`Expected 200 searching ID, received ${idSearch.status}.`);
        const idBody = await idSearch.json();
        if (idBody.total !== 1)
            throw new Error(`Expected 1 result for ID search, got ${idBody.total}.`);
        if (!idBody.data.some((r) => r.id === ids.regBeta))
            throw new Error('Expected Beta registration in ID search results.');
        const ticketSearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent(`TICKET-C-${suffix}`)}`, ids.session);
        if (ticketSearch.status !== 200)
            throw new Error(`Expected 200 searching ticket, received ${ticketSearch.status}.`);
        const ticketBody = await ticketSearch.json();
        if (ticketBody.total !== 1)
            throw new Error(`Expected 1 result for ticket search, got ${ticketBody.total}.`);
        if (!ticketBody.data.some((r) => r.id === ids.regGamma))
            throw new Error('Expected Gamma registration in ticket search results.');
        const emptySearch = await request(baseUrl, `/events/${ids.event}/registrations?search=${encodeURIComponent('ZZZNOMATCH')}`, ids.session);
        if (emptySearch.status !== 200)
            throw new Error(`Expected 200 for empty result search, received ${emptySearch.status}.`);
        const emptyBody = await emptySearch.json();
        if (emptyBody.total !== 0)
            throw new Error(`Expected 0 results for non-matching search, got ${emptyBody.total}.`);
        console.log('Event search tests passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.eventRegistrations.deleteMany({ id: { $in: [ids.regAlpha, ids.regBeta, ids.regGamma] } }),
            registry_1.models.events.deleteMany({ id: ids.event }),
            registry_1.models.users.deleteMany({ id: { $in: [ids.userAlpha, ids.userBeta, ids.userGamma] } }),
            registry_1.models.adminSessions.deleteMany({ id: ids.session }),
            registry_1.models.admins.deleteMany({ id: ids.admin }),
            registry_1.models.roles.deleteMany({ id: ids.role }),
        ]);
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await mongoose_1.default.disconnect();
    }
}
testEventSearch().catch((error) => {
    console.error('Event search test failed:', error);
    process.exitCode = 1;
});
