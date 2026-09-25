// src/services/notificationScheduler.ts
import cron from 'node-cron';
import { Request } from 'express';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { sendNotification, SendDeps } from './notificationSender';

/**
 * Scheduled-notification dispatcher (Step 6).
 *
 * Mirrors the established scheduler architecture (contentScheduler.ts):
 * node-cron task + exported pure processing function + atomic findOneAndUpdate
 * claim on a transient field so overlapping runs can never process the same
 * notification twice.
 *
 * Candidates: notifications with status 'scheduled' whose scheduleAt has
 * passed. Each due notification is handed to the EXISTING Step-5 sender
 * (sendNotification) — the dispatcher contains no FCM logic of its own and
 * therefore inherits all Step-5 honesty rules: zero devices -> no delivery
 * claim and no fake success; invalid tokens -> deactivated, never deleted;
 * all-failed -> status 'failed' (retryable); audit events with a system actor.
 *
 * Duplicate/backoff handling via the transient 'scheduledClaimedAt' field:
 *  - atomic claim prevents overlapping runs from double-sending;
 *  - zero-device sends set the claim INTO THE FUTURE (backoff) so the
 *    notification is retried automatically later without per-minute spam;
 *  - a claim older than STALE_CLAIM_MS is treated as a crashed run and
 *    re-claimed;
 *  - terminal states ('sent', 'failed') never match the candidate filter
 *    again ('failed' is retried manually via POST /notifications/:id/send).
 */

const DISPATCHER_CRON = '* * * * *'; // every minute

/** A claim older than this is a crashed run: re-claimable. */
const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Zero-device sends are retried with this backoff instead of every minute. */
const ZERO_DEVICE_RETRY_MS = 15 * 60 * 1000;

/** Max notifications claimed per run (batch safety). */
const BATCH_LIMIT = 25;

/** Audit attribution for dispatcher-driven sends: no human admin is involved. */
export const NOTIFICATION_SCHEDULER_ACTOR = {
  id: 'system_scheduler',
  name: 'Notification Scheduler',
} as const;

const CLAIM_FIELD = 'scheduledClaimedAt';

export interface DispatcherRunSummary {
  considered: number;
  sent: number;
  failed: number;
  noDevices: number;
  stillScheduled: number;
}

function schedulerReq(): Request {
  // writeNotificationAudit reads req.currentAdmin for attribution; the
  // dispatcher has no admin session, so it acts as a system identity.
  return { currentAdmin: NOTIFICATION_SCHEDULER_ACTOR } as unknown as Request;
}

export async function processScheduledNotifications(
  models: ModelRegistry,
  now: Date = new Date(),
  log: (message: string) => void = console.log,
  deps: SendDeps = {}
): Promise<DispatcherRunSummary> {
  const staleCutoff = new Date(now.getTime() - STALE_CLAIM_MS);

  const candidates = await models.notifications
    .find({
      status: 'scheduled',
      scheduleAt: { $type: 'date', $lte: now },
      $or: [{ [CLAIM_FIELD]: null }, { [CLAIM_FIELD]: { $type: 'date', $lte: staleCutoff } }],
    })
    .sort({ scheduleAt: 1 })
    .limit(BATCH_LIMIT)
    .lean<LooseDocument[]>();

  const summary: DispatcherRunSummary = {
    considered: candidates.length,
    sent: 0,
    failed: 0,
    noDevices: 0,
    stillScheduled: 0,
  };

  for (const candidate of candidates) {
    const notificationId = String(candidate.id);

    // Atomic claim: an overlapping run's identical filter matches nothing,
    // so the same notification is never handed to the sender twice.
    const claimed = await models.notifications
      .findOneAndUpdate(
        {
          id: notificationId,
          status: 'scheduled',
          scheduleAt: { $type: 'date', $lte: now },
          $or: [{ [CLAIM_FIELD]: null }, { [CLAIM_FIELD]: { $type: 'date', $lte: staleCutoff } }],
        },
        { $set: { [CLAIM_FIELD]: now } },
        { new: true, lean: true }
      )
      .lean<LooseDocument | null>();
    if (!claimed) continue;

    let outcome: 'sent' | 'failed' | 'noDevices' | 'error';
    try {
      const { result } = await sendNotification(models, schedulerReq(), notificationId, deps);
      if (result.targeted === 0) {
        outcome = 'noDevices';
      } else if (result.successful > 0) {
        outcome = 'sent';
      } else {
        outcome = 'failed';
      }
    } catch (error) {
      // Sender threw before completing (e.g. Firebase bootstrap error). Keep
      // the claim so the stale-claim window paces retries instead of looping
      // every tick; the notification is never lost (still 'scheduled').
      log(`[Notification Scheduler] Send threw for ${notificationId}: ${error instanceof Error ? error.message : String(error)}`);
      outcome = 'error';
    }

    if (outcome === 'noDevices') {
      // No registered destinations yet: retry later with backoff (future claim
      // makes the candidate filter skip this notification until then).
      await models.notifications.updateOne(
        { id: notificationId, status: 'scheduled' },
        { $set: { [CLAIM_FIELD]: new Date(now.getTime() + ZERO_DEVICE_RETRY_MS) } }
      );
      summary.noDevices += 1;
      log(`[Notification Scheduler] ${notificationId}: 0 registered devices; retry scheduled.`);
    } else if (outcome === 'sent') {
      await models.notifications.updateOne(
        { id: notificationId },
        { $set: { [CLAIM_FIELD]: null } }
      );
      summary.sent += 1;
      log(`[Notification Scheduler] ${notificationId}: sent.`);
    } else if (outcome === 'failed') {
      await models.notifications.updateOne(
        { id: notificationId },
        { $set: { [CLAIM_FIELD]: null } }
      );
      summary.failed += 1;
      log(`[Notification Scheduler] ${notificationId}: delivery failed; marked failed for manual retry.`);
    } else {
      summary.stillScheduled += 1;
    }
  }

  return summary;
}

/** Start the scheduled-notification dispatcher independently from the other jobs. */
export function startNotificationScheduler(models: ModelRegistry, deps: SendDeps = {}): void {
  if (notificationJob) return;
  notificationJob = cron.schedule(DISPATCHER_CRON, async () => {
    try {
      const summary = await processScheduledNotifications(models, new Date(), console.log, deps);
      if (summary.considered > 0) {
        console.log(
          `[Notification Scheduler] Considered ${summary.considered}: sent ${summary.sent}, failed ${summary.failed}, no devices ${summary.noDevices}, pending ${summary.stillScheduled}.`
        );
      }
    } catch (error) {
      console.error('[Notification Scheduler] Scheduled run failed:', error);
    }
  });
  console.log('[Notification Scheduler] Dispatcher job started (every minute).');
}

export function stopNotificationScheduler(): void {
  if (!notificationJob) return;
  notificationJob.stop();
  notificationJob = null;
  console.log('[Notification Scheduler] Dispatcher job stopped.');
}

let notificationJob: cron.ScheduledTask | null = null;

