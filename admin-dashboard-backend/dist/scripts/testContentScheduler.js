"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const contentScheduler_1 = require("../services/contentScheduler");
const eventReminders_1 = require("../services/eventReminders");
async function request(baseUrl, path, token, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
}
function expect(label, condition, detail = '') {
    if (!condition)
        throw new Error(`${label}${detail ? ` (${detail})` : ''}`);
    console.log(`  PASS  ${label}${detail ? ` -> ${detail}` : ''}`);
}
function expectStatus(label, actual, expected) {
    if (actual !== expected)
        throw new Error(`${label}: expected ${expected}, received ${actual}.`);
    console.log(`  PASS  ${label} -> ${actual}`);
}
async function testContentScheduler() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
    const ids = {
        publishRole: `test_sched_role_publish_${suffix}`,
        publishAdmin: `test_sched_admin_publish_${suffix}`,
        publishSession: `test_sched_session_publish_${suffix}`,
        pastTip: `test_sched_tip_past_${suffix}`,
        futureTip: `test_sched_tip_future_${suffix}`,
        noScheduleTip: `test_sched_tip_none_${suffix}`,
        pastZodiac: `test_sched_zodiac_past_${suffix}`,
        pastFortune: `test_sched_fortune_past_${suffix}`,
        event: `test_sched_event_${suffix}`,
    };
    const now = new Date();
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
    await registry_1.models.roles.create([
        { id: ids.publishRole, name: 'Scheduler Test Publish', permissions: ['CONTENT_PUBLISH'] },
    ]);
    await registry_1.models.admins.create([
        { id: ids.publishAdmin, name: 'Scheduler Test Publish Admin', email: `${ids.publishAdmin}@test.local`, password: 'test', roleId: ids.publishRole, status: 'active' },
    ]);
    await registry_1.models.adminSessions.create([
        { id: ids.publishSession, adminId: ids.publishAdmin, token: ids.publishSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
    ]);
    const pastDate = new Date(now.getTime() - 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000);
    await registry_1.models.tips.create([
        { id: ids.pastTip, title: 'Scheduler Past Tip', body: 'Should be auto-published.', subtype: 'wellness', status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
        { id: ids.futureTip, title: 'Scheduler Future Tip', body: 'Must NOT be auto-published early.', subtype: 'wellness', status: 'draft', scheduledAt: futureDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
        { id: ids.noScheduleTip, title: 'Scheduler No Schedule Tip', body: 'Has no scheduledAt; untouched.', subtype: 'wellness', status: 'draft', scheduledAt: null, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
    ]);
    await registry_1.models.zodiac.create({
        id: ids.pastZodiac, sign: 'Aries', date: pastDate, horoscope: 'Auto-publish cross-type check.', love: null, career: null, status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now,
    });
    await registry_1.models.fortuneCookies.create({
        id: ids.pastFortune, text: 'Auto-publish fortune check.', category: 'Scheduler Test', status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now,
    });
    await registry_1.models.events.create({
        id: ids.event, title: 'Scheduler Regression Event', type: 'workshop', date: new Date(now.getTime() + 2 * 60 * 60 * 1000), capacity: 50, category: 'Test', status: 'upcoming', attendees: 0, registeredCount: 0, checkedInCount: 0, description: null, location: null, imageUrl: null, host: null, organizerId: null, reminderSentAt: null, reminderConfig: { enabled: true, sendBeforeHours: 24 }, createdAt: now,
    });
    const targetIds = [ids.pastTip, ids.futureTip, ids.noScheduleTip, ids.pastZodiac, ids.pastFortune];
    try {
        console.log('\n--- Run 1: past + future + no-schedule candidates ---');
        const firstRun = await (0, contentScheduler_1.processContentAutoPublish)(registry_1.models);
        expect('first run publishes at least the 3 past-scheduled test items', firstRun >= 3, `published=${firstRun}`);
        const pastTip = (await registry_1.models.tips.findOne({ id: ids.pastTip }).lean());
        expect('past-scheduled tip -> published', pastTip.status === 'published', `status=${pastTip.status}`);
        expect('past-scheduled tip -> publishedAt set', pastTip.publishedAt !== null);
        expect('past-scheduled tip -> scheduledAt KEPT as historical record', pastTip.scheduledAt !== null);
        const zodiac = (await registry_1.models.zodiac.findOne({ id: ids.pastZodiac }).lean());
        expect('past-scheduled zodiac -> published (cross-type)', zodiac.status === 'published', `status=${zodiac.status}`);
        const fortune = (await registry_1.models.fortuneCookies.findOne({ id: ids.pastFortune }).lean());
        expect('past-scheduled fortune -> published (cross-type)', fortune.status === 'published', `status=${fortune.status}`);
        const futureTip = (await registry_1.models.tips.findOne({ id: ids.futureTip }).lean());
        expect('future-scheduled tip NOT published early', futureTip.status === 'draft', `status=${futureTip.status}`);
        const noneTip = (await registry_1.models.tips.findOne({ id: ids.noScheduleTip }).lean());
        expect('tip without scheduledAt unaffected', noneTip.status === 'draft', `status=${noneTip.status}`);
        console.log('\n--- Audit attribution (run 1) ---');
        const auditRun1 = await registry_1.models.auditLogs.find({ targetId: { $in: targetIds } }).lean();
        const autoEntries = auditRun1.filter((e) => e.action.endsWith('.autoPublished'));
        expect('one audit entry per auto-published test item', autoEntries.length === 3, `count=${autoEntries.length}`);
        for (const resource of ['tips', 'zodiac', 'fortuneCookies']) {
            const entry = autoEntries.find((e) => e.action === `${resource}.autoPublished`);
            expect(`${resource}.autoPublished audit entry exists`, !!entry);
            expect(`${resource}.autoPublished attributed to the scheduler`, entry?.adminId === contentScheduler_1.SCHEDULER_ACTOR.id && entry?.adminName === contentScheduler_1.SCHEDULER_ACTOR.name, `${entry?.adminId} / ${entry?.adminName}`);
            expect(`${resource}.autoPublished targetType correct`, entry?.targetType === resource);
        }
        expect('no audit entries for untouched items', !auditRun1.some((e) => [ids.futureTip, ids.noScheduleTip].includes(String(e.targetId))));
        console.log('\n--- Run 2: idempotency (double-processing guard) ---');
        const secondRun = await (0, contentScheduler_1.processContentAutoPublish)(registry_1.models);
        expect('second run publishes nothing (idempotent)', secondRun === 0, `published=${secondRun}`);
        const testAutoCount = (await registry_1.models.auditLogs
            .find({ targetId: { $in: [ids.pastTip, ids.pastZodiac, ids.pastFortune] }, action: /\.autoPublished$/ })
            .lean()).length;
        expect('no duplicate audit entries after second run', testAutoCount === 3, `count=${testAutoCount}`);
        console.log('\n--- Regression: manual publish/unpublish (Phase 3/4 routes) ---');
        const publishRes = await request(baseUrl, `/tips/${ids.futureTip}/publish`, ids.publishSession, { method: 'POST' });
        expectStatus('POST /tips/:id/publish (manual, CONTENT_PUBLISH)', publishRes.status, 200);
        const publishedTip = (await publishRes.json());
        expect('manual publish sets published + publishedAt', publishedTip.status === 'published' && publishedTip.publishedAt !== null, `status=${publishedTip.status}`);
        const unpublishRes = await request(baseUrl, `/tips/${ids.futureTip}/unpublish`, ids.publishSession, { method: 'POST' });
        expectStatus('POST /tips/:id/unpublish (manual)', unpublishRes.status, 200);
        const unpublishedTip = (await unpublishRes.json());
        expect('manual unpublish sets archived', unpublishedTip.status === 'archived', `status=${unpublishedTip.status}`);
        const manualAudit = await registry_1.models.auditLogs.find({ targetId: ids.futureTip }).lean();
        const publishedEntry = manualAudit.find((e) => e.action === 'tips.published');
        const unpublishedEntry = manualAudit.find((e) => e.action === 'tips.unpublished');
        expect('manual publish audited to the human admin', publishedEntry?.adminId === ids.publishAdmin, publishedEntry?.adminId ?? 'missing');
        expect('manual unpublish audited to the human admin', unpublishedEntry?.adminId === ids.publishAdmin, unpublishedEntry?.adminId ?? 'missing');
        console.log('\n--- Regression: event reminder job unaffected ---');
        const reminderClaimed = await (0, eventReminders_1.processEventReminders)(registry_1.models);
        expect('event reminder job claims the enabled event', reminderClaimed >= 1, `claimed=${reminderClaimed}`);
        const event = (await registry_1.models.events.findOne({ id: ids.event }).lean());
        expect('event reminderSentAt claimed by the reminder job', event.reminderSentAt !== null);
        expect('content scheduler did not touch the event document', event.autoPublishClaimAt === undefined);
        const contentAfterReminders = (await registry_1.models.tips.findOne({ id: ids.noScheduleTip }).lean());
        expect('reminder job did not touch content items', contentAfterReminders.status === 'draft');
        console.log('\n--- Cron registration (both jobs coexist) ---');
        const { startContentScheduler, stopContentScheduler } = await Promise.resolve().then(() => __importStar(require('../services/contentScheduler')));
        const { startEventReminderJob, stopEventReminderJob } = await Promise.resolve().then(() => __importStar(require('../services/eventReminders')));
        startContentScheduler(registry_1.models);
        startEventReminderJob(registry_1.models);
        startContentScheduler(registry_1.models);
        console.log('  PASS  startContentScheduler + startEventReminderJob registered (double-start guarded, no error)');
        stopContentScheduler();
        stopEventReminderJob();
        console.log('\nContent scheduler test passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.auditLogs.deleteMany({ targetId: { $in: [...targetIds, ids.event] } }),
            registry_1.models.tips.deleteMany({ id: { $in: [ids.pastTip, ids.futureTip, ids.noScheduleTip] } }),
            registry_1.models.zodiac.deleteMany({ id: ids.pastZodiac }),
            registry_1.models.fortuneCookies.deleteMany({ id: ids.pastFortune }),
            registry_1.models.events.deleteMany({ id: ids.event }),
            registry_1.models.adminSessions.deleteMany({ id: ids.publishSession }),
            registry_1.models.admins.deleteMany({ id: ids.publishAdmin }),
            registry_1.models.roles.deleteMany({ id: ids.publishRole }),
        ]);
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        await mongoose_1.default.disconnect();
    }
}
testContentScheduler().catch((error) => {
    console.error('Content scheduler test failed:', error);
    process.exitCode = 1;
});
