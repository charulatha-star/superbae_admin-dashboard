import 'dotenv/config';

import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import type { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';
import { createId } from '../utils/ids';
import { DeviceTokenModel } from '../models/deviceToken';
import { registerDeviceToken, deactivateDeviceToken } from '../services/deviceTokens';
import { processScheduledNotifications } from '../services/notificationScheduler';
import type { SendMessaging } from '../services/notificationSender';

/**
 * Step 6 verification: scheduled-notification dispatcher.
 * Service-level tests using the mocked Firebase messaging and synthetic
 * device destinations (no real tokens, no real delivery, no deleteMany).
 * The exported processScheduledNotifications() is the manual trigger, so
 * scheduling never has to be awaited in tests.
 */

function expect(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  console.log(`  PASS  ${label}`);
}

function assertOk(label: string, condition: unknown, detail = ''): void {
  if (!condition) throw new Error(`${label} failed.${detail ? ` ${detail}` : ''}`);
  console.log(`  PASS  ${label}`);
}

interface ScriptedResponse { success: boolean; code?: string; message?: string; }

function makeFakeMessaging() {
  const state = {
    calls: [] as MulticastMessage[],
    responsesByToken: {} as Record<string, ScriptedResponse>,
  };
  const sendEachForMulticast = async (message: MulticastMessage): Promise<BatchResponse> => {
    state.calls.push(message);
    const responses = (message.tokens ?? []).map((token) => {
      const scripted = state.responsesByToken[token] ?? { success: false, code: 'test/no-script', message: 'No scripted response.' };
      return scripted.success
        ? { success: true, messageId: `projects/fake/messages/${state.calls.length}` }
        : {
            success: false,
            error: Object.assign(new Error(scripted.message ?? 'Requested entity was not found.'), { code: scripted.code }),
          };
    });
    return {
      responses,
      successCount: responses.filter((entry) => entry.success).length,
      failureCount: responses.filter((entry) => !entry.success).length,
    } as unknown as BatchResponse;
  };
  return { state, sendEachForMulticast };
}

async function main(): Promise<void> {
  await connectDB();
  const suffix = randomUUID().replace(/-/g, '').substring(0, 8);
  const createdNotificationIds: string[] = [];
  const createdTokens: string[] = [];
  const fake = makeFakeMessaging();
  const deps = { messaging: fake as unknown as SendMessaging };
  const log = (): void => undefined; // silence scheduler logs in tests

  const notificationsBefore = await models.notifications.countDocuments();
  const devicesBefore = await DeviceTokenModel.countDocuments();
  console.log(`--- notifications before: ${notificationsBefore} | deviceTokens before: ${devicesBefore} ---`);

  const dueScheduled = await models.notifications.countDocuments({
    status: 'scheduled',
    scheduleAt: { $type: 'date', $lte: new Date() },
    scheduledClaimedAt: null,
  });
  if (dueScheduled !== 0) {
    throw new Error(`Expected 0 due unclaimed scheduled notifications before the run, found ${dueScheduled}.`);
  }

  async function createScheduled(scheduleAt: Date, overrides: LooseDocument = {}): Promise<LooseDocument> {
    const created = await models.notifications.create({
      id: createId('notification'),
      title: `Sched T ${suffix}`,
      body: 'Scheduled payload',
      channel: 'push',
      status: 'scheduled',
      scheduleAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    createdNotificationIds.push(String(created.id));
    return created as unknown as LooseDocument;
  }

  function doc(id: string): Promise<LooseDocument | null> {
    return models.notifications.findOne({ id }).lean<LooseDocument | null>();
  }

  try {
    console.log('--- future scheduled notification is not processed ---');
    await createScheduled(new Date(Date.now() + 60 * 60 * 1000));
    const futureSummary = await processScheduledNotifications(models, new Date(), log, deps);
    expect('future: considered = 0', futureSummary.considered, 0);
    expect('future: Firebase never called', fake.state.calls.length, 0);
    assertOk('future: status still scheduled', String((await doc(createdNotificationIds[0]))?.status) === 'scheduled');

    console.log('--- due scheduled + zero devices: no fake delivery, backoff ---');
    const zeroId = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    const zeroRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('zero: considered = 1', zeroRun.considered, 1);
    expect('zero: noDevices = 1', zeroRun.noDevices, 1);
    expect('zero: Firebase never called', fake.state.calls.length, 0);
    const zeroDoc = await doc(zeroId);
    assertOk('zero: still scheduled (nothing delivered)', String(zeroDoc?.status) === 'scheduled');
    const claimAfterZero = zeroDoc?.scheduledClaimedAt ? new Date(String(zeroDoc.scheduledClaimedAt)).getTime() : 0;
    assertOk('zero: backoff claim set into the future', claimAfterZero > Date.now());
    expect('zero: sendSkipped audit recorded', await models.auditLogs.countDocuments({ action: 'notifications.sendSkipped', targetId: zeroId, adminId: 'system_scheduler' }), 1);
    const zeroSecondRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('zero: immediate rerun skips (backoff)', zeroSecondRun.considered, 0);
    expect('zero: audit not duplicated', await models.auditLogs.countDocuments({ action: 'notifications.sendSkipped', targetId: zeroId, adminId: 'system_scheduler' }), 1);

    console.log('--- backoff expiry retries the notification ---');
    await models.notifications.updateOne({ id: zeroId }, { $set: { scheduledClaimedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    const retryRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('backoff expiry: considered = 1', retryRun.considered, 1);
    expect('backoff expiry: re-processed with backoff again', await models.auditLogs.countDocuments({ action: 'notifications.sendSkipped', targetId: zeroId, adminId: 'system_scheduler' }), 2);

    console.log('--- due scheduled + devices: sender invoked, sent once ---');
    const tokenS1 = `test:fcm:sch_s1_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenS1);
    await registerDeviceToken(`tusr_sch_${suffix}`, tokenS1, 'android');
    const sentId = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    fake.state.responsesByToken = { [tokenS1]: { success: true } };
    const sentRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('sent: considered = 1', sentRun.considered, 1);
    expect('sent: summary sent = 1', sentRun.sent, 1);
    const sentDoc = await doc(sentId);
    assertOk('sent: status = sent', String(sentDoc?.status) === 'sent');
    assertOk('sent: sentAt recorded', sentDoc?.sentAt != null);
    assertOk('sent: payload used scheduler system identity', fake.state.calls[0]?.data?.notificationId === sentId);
    expect('sent: notifications.sent audit (system actor)', await models.auditLogs.countDocuments({ action: 'notifications.sent', targetId: sentId, adminId: 'system_scheduler', adminName: 'Notification Scheduler' }), 1);
    expect('sent: Firebase called once', fake.state.calls.length, 1);
    const sentSecondRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('sent: rerun ignores already-sent notification', sentSecondRun.considered, 0);
    expect('sent: no duplicate Firebase call', fake.state.calls.length, 1);

    console.log('--- all-devices-failed via scheduler: no false success ---');
    // Deactivate the healthy device so the only active destination fails.
    await deactivateDeviceToken(`tusr_sch_${suffix}`, tokenS1);
    const tokenF1 = `test:fcm:sch_f1_${suffix}_0123456789abcdef`;
    createdTokens.push(tokenF1);
    await registerDeviceToken(`tusr_sch_${suffix}`, tokenF1, 'android');
    const failId = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    fake.state.responsesByToken = {
      [tokenS1]: { success: true },
      [tokenF1]: { success: false, code: 'messaging/internal-error', message: 'An internal error has occurred.' },
    };
    const failRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('all-failed: summary failed = 1', failRun.failed, 1);
    const failDoc = await doc(failId);
    assertOk('all-failed: status = failed (sender decides, retryable)', String(failDoc?.status) === 'failed');
    assertOk('all-failed: no false sentAt', failDoc?.sentAt === null || failDoc?.sentAt === undefined);
    expect('all-failed: notifications.sendFailed audit', await models.auditLogs.countDocuments({ action: 'notifications.sendFailed', targetId: failId, adminId: 'system_scheduler' }), 1);
    const failSecondRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('all-failed: not auto-retried by next run', failSecondRun.considered, 0);
    expect('all-failed: Firebase call count stable', fake.state.calls.length, 2);

    console.log('--- overlapping runs / duplicate prevention ---');
    const dupA = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    const dupB = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    // Simulate an overlapping run that claimed dupB but crashed before sending.
    await models.notifications.updateOne({ id: dupB }, { $set: { scheduledClaimedAt: new Date() } });
    fake.state.responsesByToken = {
      [tokenS1]: { success: true },
      [tokenF1]: { success: true },
    };
    const overlapRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('overlap: only the unclaimed doc is considered', overlapRun.considered, 1);
    expect('overlap: claimed doc NOT sent in this run', overlapRun.sent, 1);
    const dupBAfter = await doc(dupB);
    assertOk('overlap: claimed doc still scheduled', String(dupBAfter?.status) === 'scheduled');
    expect('overlap: no duplicate send for claimed doc', await models.auditLogs.countDocuments({ targetId: dupB, adminId: 'system_scheduler' }), 0);
    // Stale-claim recovery: crashed claim is older than the stale window.
    await models.notifications.updateOne({ id: dupB }, { $set: { scheduledClaimedAt: new Date(Date.now() - 11 * 60 * 1000) } });
    const recoveryRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('stale recovery: considered = 1', recoveryRun.considered, 1);
    expect('stale recovery: claimed-crashed doc finally sent', recoveryRun.sent, 1);
    assertOk('stale recovery: dupB now sent', String((await doc(dupB))?.status) === 'sent');

    console.log('--- within-run duplicate check: two due docs, one run ---');
    const dupC = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    const dupD = String((await createScheduled(new Date(Date.now() - 60 * 1000))).id);
    const beforeCalls = fake.state.calls.length;
    const twoRun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('one run: both due docs considered', twoRun.considered, 2);
    expect('one run: both sent exactly once', twoRun.sent, 2);
    expect('one run: exactly two Firebase calls added', fake.state.calls.length - beforeCalls, 2);
    const rerun = await processScheduledNotifications(models, new Date(), log, deps);
    expect('rerun: nothing left to consider', rerun.considered, 0);
    expect('rerun: no additional Firebase calls', fake.state.calls.length - beforeCalls, 2);
  } finally {
    for (const id of createdNotificationIds) {
      try {
        await models.notifications.deleteOne({ id });
      } catch {
        // keep cleaning the remaining fixtures
      }
    }
    for (const token of createdTokens) {
      try {
        await DeviceTokenModel.deleteOne({ token });
      } catch {
        // keep cleaning the remaining fixtures
      }
    }
    // Scope scheduler-audit cleanup strictly to this run's target ids and the
    // system actor so no unrelated audit history is ever touched.
    const schedulerAudits = await models.auditLogs
      .find({ adminId: 'system_scheduler', targetType: 'notifications', targetId: { $in: createdNotificationIds } })
      .lean<LooseDocument[]>();
    for (const row of schedulerAudits) {
      await models.auditLogs.deleteOne({ id: row.id });
    }
    console.log(`  cleanup  removed ${schedulerAudits.length} scheduler audit row(s)`);
  }

  const notificationsAfter = await models.notifications.countDocuments();
  const devicesAfter = await DeviceTokenModel.countDocuments();
  expect('notification count unchanged', notificationsAfter, notificationsBefore);
  expect('deviceTokens count unchanged', devicesAfter, devicesBefore);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Notification scheduler test failed:', error);
    process.exit(1);
  });
