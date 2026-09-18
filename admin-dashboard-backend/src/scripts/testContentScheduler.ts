import 'dotenv/config';

import express from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { registerRoutes } from '../routes';
import { processContentAutoPublish, SCHEDULER_ACTOR } from '../services/contentScheduler';
import { processEventReminders } from '../services/eventReminders';

interface AuditLogDoc {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
}

interface ContentDoc {
  id: string;
  status: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}

async function request(
  baseUrl: string,
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

function expect(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`${label}${detail ? ` (${detail})` : ''}`);
  console.log(`  PASS  ${label}${detail ? ` -> ${detail}` : ''}`);
}

function expectStatus(label: string, actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  console.log(`  PASS  ${label} -> ${actual}`);
}

async function testContentScheduler(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    publishRole: `test_sched_role_publish_${suffix}`,
    publishAdmin: `test_sched_admin_publish_${suffix}`,
    publishSession: `test_sched_session_publish_${suffix}`,
    pastTip: `test_sched_tip_past_${suffix}`,
    futureTip: `test_sched_tip_future_${suffix}`,
    noScheduleTip: `test_sched_tip_none_${suffix}`,
    pastZodiac: `test_sched_zodiac_past_${suffix}`,
    pastFortune: `test_sched_fortune_past_${suffix}`,
    missingScheduleTip: `test_sched_tip_missing_${suffix}`,
    event: `test_sched_event_${suffix}`,
  };
  const now = new Date();

  const app = express();
  app.use(express.json());
  registerRoutes(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await models.roles.create([
    { id: ids.publishRole, name: 'Scheduler Test Publish', permissions: ['CONTENT_PUBLISH'] },
  ]);
  await models.admins.create([
    { id: ids.publishAdmin, name: 'Scheduler Test Publish Admin', email: `${ids.publishAdmin}@test.local`, password: 'test', roleId: ids.publishRole, status: 'active' },
  ]);
  await models.adminSessions.create([
    { id: ids.publishSession, adminId: ids.publishAdmin, token: ids.publishSession, createdAt: now, expiresAt: new Date(Date.now() + 300_000), revokedAt: null },
  ]);

  const pastDate = new Date(now.getTime() - 60 * 60 * 1000);
  const futureDate = new Date(now.getTime() + 60 * 60 * 1000);
  await models.tips.create([
    { id: ids.pastTip, title: 'Scheduler Past Tip', body: 'Should be auto-published.', subtype: 'wellness', status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
    { id: ids.futureTip, title: 'Scheduler Future Tip', body: 'Must NOT be auto-published early.', subtype: 'wellness', status: 'draft', scheduledAt: futureDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
    { id: ids.noScheduleTip, title: 'Scheduler No Schedule Tip', body: 'Has no scheduledAt; untouched.', subtype: 'wellness', status: 'draft', scheduledAt: null, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
    { id: ids.missingScheduleTip, title: 'Scheduler Missing Schedule Tip', body: 'scheduledAt field absent entirely; untouched.', subtype: 'wellness', status: 'draft', publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now },
  ]);
  await models.zodiac.create({
    id: ids.pastZodiac, sign: 'Aries', date: pastDate, horoscope: 'Auto-publish cross-type check.', love: null, career: null, status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now,
  });
  await models.fortuneCookies.create({
    id: ids.pastFortune, text: 'Auto-publish fortune check.', category: 'Scheduler Test', status: 'draft', scheduledAt: pastDate, publishedAt: null, isFeatured: false, authorId: null, createdAt: now, updatedAt: now,
  });
  await models.events.create({
    id: ids.event, title: 'Scheduler Regression Event', type: 'workshop', date: new Date(now.getTime() + 2 * 60 * 60 * 1000), capacity: 50, category: 'Test', status: 'upcoming', attendees: 0, registeredCount: 0, checkedInCount: 0, description: null, location: null, imageUrl: null, host: null, organizerId: null, reminderSentAt: null, reminderConfig: { enabled: true, sendBeforeHours: 24 }, createdAt: now,
  });

  const targetIds = [ids.pastTip, ids.futureTip, ids.noScheduleTip, ids.missingScheduleTip, ids.pastZodiac, ids.pastFortune];
  try {
    console.log('\n--- Run 1: past + future + no-schedule candidates ---');
    const firstRun = await processContentAutoPublish(models);
    expect('first run publishes at least the 3 past-scheduled test items', firstRun >= 3, `published=${firstRun}`);

    const pastTip = (await models.tips.findOne({ id: ids.pastTip }).lean()) as unknown as ContentDoc;
    expect('past-scheduled tip -> published', pastTip.status === 'published', `status=${pastTip.status}`);
    expect('past-scheduled tip -> publishedAt set', pastTip.publishedAt !== null);
    expect('past-scheduled tip -> scheduledAt KEPT as historical record', pastTip.scheduledAt !== null);
    const zodiac = (await models.zodiac.findOne({ id: ids.pastZodiac }).lean()) as unknown as ContentDoc;
    expect('past-scheduled zodiac -> published (cross-type)', zodiac.status === 'published', `status=${zodiac.status}`);
    const fortune = (await models.fortuneCookies.findOne({ id: ids.pastFortune }).lean()) as unknown as ContentDoc;
    expect('past-scheduled fortune -> published (cross-type)', fortune.status === 'published', `status=${fortune.status}`);
    const futureTip = (await models.tips.findOne({ id: ids.futureTip }).lean()) as unknown as ContentDoc;
    expect('future-scheduled tip NOT published early', futureTip.status === 'draft', `status=${futureTip.status}`);
    const noneTip = (await models.tips.findOne({ id: ids.noScheduleTip }).lean()) as unknown as ContentDoc;
    expect('tip without scheduledAt unaffected', noneTip.status === 'draft', `status=${noneTip.status}`);
    const missingTip = (await models.tips.findOne({ id: ids.missingScheduleTip }).lean()) as unknown as ContentDoc;
    expect('tip with MISSING scheduledAt field unaffected (regression: tip_005)', missingTip.status === 'draft', `status=${missingTip.status}`);

    console.log('\n--- Audit attribution (run 1) ---');
    const auditRun1 = await models.auditLogs.find({ targetId: { $in: targetIds } }).lean<AuditLogDoc[]>();
    const autoEntries = auditRun1.filter((e) => e.action.endsWith('.autoPublished'));
    expect('one audit entry per auto-published test item', autoEntries.length === 3, `count=${autoEntries.length}`);
    for (const resource of ['tips', 'zodiac', 'fortuneCookies']) {
      const entry = autoEntries.find((e) => e.action === `${resource}.autoPublished`);
      expect(`${resource}.autoPublished audit entry exists`, !!entry);
      expect(`${resource}.autoPublished attributed to the scheduler`, entry?.adminId === SCHEDULER_ACTOR.id && entry?.adminName === SCHEDULER_ACTOR.name, `${entry?.adminId} / ${entry?.adminName}`);
      expect(`${resource}.autoPublished targetType correct`, entry?.targetType === resource);
    }
    expect('no audit entries for untouched items', !auditRun1.some((e) => [ids.futureTip, ids.noScheduleTip].includes(String(e.targetId))));

    console.log('\n--- Run 2: idempotency (double-processing guard) ---');
    const secondRun = await processContentAutoPublish(models);
    expect('second run publishes nothing (idempotent)', secondRun === 0, `published=${secondRun}`);
    const testAutoCount = (await models.auditLogs
      .find({ targetId: { $in: [ids.pastTip, ids.pastZodiac, ids.pastFortune] }, action: /\.autoPublished$/ })
      .lean<AuditLogDoc[]>()).length;
    expect('no duplicate audit entries after second run', testAutoCount === 3, `count=${testAutoCount}`);
    console.log('\n--- Regression: manual publish/unpublish (Phase 3/4 routes) ---');
    const publishRes = await request(baseUrl, `/tips/${ids.futureTip}/publish`, ids.publishSession, { method: 'POST' });
    expectStatus('POST /tips/:id/publish (manual, CONTENT_PUBLISH)', publishRes.status, 200);
    const publishedTip = (await publishRes.json()) as ContentDoc;
    expect('manual publish sets published + publishedAt', publishedTip.status === 'published' && publishedTip.publishedAt !== null, `status=${publishedTip.status}`);
    const unpublishRes = await request(baseUrl, `/tips/${ids.futureTip}/unpublish`, ids.publishSession, { method: 'POST' });
    expectStatus('POST /tips/:id/unpublish (manual)', unpublishRes.status, 200);
    const unpublishedTip = (await unpublishRes.json()) as ContentDoc;
    expect('manual unpublish sets archived', unpublishedTip.status === 'archived', `status=${unpublishedTip.status}`);
    const manualAudit = await models.auditLogs.find({ targetId: ids.futureTip }).lean<AuditLogDoc[]>();
    const publishedEntry = manualAudit.find((e) => e.action === 'tips.published');
    const unpublishedEntry = manualAudit.find((e) => e.action === 'tips.unpublished');
    expect('manual publish audited to the human admin', publishedEntry?.adminId === ids.publishAdmin, publishedEntry?.adminId ?? 'missing');
    expect('manual unpublish audited to the human admin', unpublishedEntry?.adminId === ids.publishAdmin, unpublishedEntry?.adminId ?? 'missing');

    console.log('\n--- Regression: event reminder job unaffected ---');
    const reminderClaimed = await processEventReminders(models);
    expect('event reminder job claims the enabled event', reminderClaimed >= 1, `claimed=${reminderClaimed}`);
    const event = (await models.events.findOne({ id: ids.event }).lean()) as unknown as { reminderSentAt: Date | null; autoPublishClaimAt?: unknown };
    expect('event reminderSentAt claimed by the reminder job', event.reminderSentAt !== null);
    expect('content scheduler did not touch the event document', event.autoPublishClaimAt === undefined);
    const contentAfterReminders = (await models.tips.findOne({ id: ids.noScheduleTip }).lean()) as unknown as ContentDoc;
    expect('reminder job did not touch content items', contentAfterReminders.status === 'draft');

    console.log('\n--- Cron registration (both jobs coexist) ---');
    const { startContentScheduler, stopContentScheduler } = await import('../services/contentScheduler');
    const { startEventReminderJob, stopEventReminderJob } = await import('../services/eventReminders');
    startContentScheduler(models);
    startEventReminderJob(models);
    startContentScheduler(models);
    console.log('  PASS  startContentScheduler + startEventReminderJob registered (double-start guarded, no error)');
    stopContentScheduler();
    stopEventReminderJob();

    console.log('\nContent scheduler test passed.');
  } finally {
    await Promise.all([
      models.auditLogs.deleteMany({ targetId: { $in: [...targetIds, ids.event] } }),
      models.tips.deleteMany({ id: { $in: [ids.pastTip, ids.futureTip, ids.noScheduleTip, ids.missingScheduleTip] } }),
      models.zodiac.deleteMany({ id: ids.pastZodiac }),
      models.fortuneCookies.deleteMany({ id: ids.pastFortune }),
      models.events.deleteMany({ id: ids.event }),
      models.adminSessions.deleteMany({ id: ids.publishSession }),
      models.admins.deleteMany({ id: ids.publishAdmin }),
      models.roles.deleteMany({ id: ids.publishRole }),
    ]);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await mongoose.disconnect();
  }
}

testContentScheduler().catch((error: unknown) => {
  console.error('Content scheduler test failed:', error);
  process.exitCode = 1;
});
