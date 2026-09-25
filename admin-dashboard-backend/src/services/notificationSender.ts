// src/services/notificationSender.ts
import { Request } from 'express';
import type { Messaging } from 'firebase-admin/messaging';
import { cleanDoc } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { getFirebaseMessaging } from './firebaseAdmin';
import { deactivateDeviceToken } from './deviceTokens';
import { effectiveSegmentValue, resolveTargetDevices } from './notificationTargeting';
import {
  NotificationConflictError,
  NotificationInputError,
  NotificationNotFoundError,
  SENDABLE_CHANNELS,
  writeNotificationAudit,
} from './notificationManagement';

/**
 * Notification sender (Step 5, targeting-aware since Step 7).
 *
 * Destination resolution lives in notificationTargeting.ts (the only place
 * that interprets segmentId against existing user data); this module remains
 * the SINGLE place responsible for FCM delivery.
 *
 * Honesty rules:
 *  - Zero resolved destinations -> no Firebase call, no status change,
 *    result { targeted: 0, ... }. Nothing is "delivered" and nothing is faked.
 *  - Invalid/unregistered tokens (per Firebase error codes) deactivate the
 *    device record via the device-token service (never delete).
 *  - Temporary Firebase errors never deactivate devices.
 *  - No Firebase credential material is ever included in results, logs or
 *    errors; failures reference devices by id + a masked token suffix.
 *  - Unsupported segments are rejected by the targeting service with a
 *    descriptive 400 (never guessed).
 *  - Every result carries an explicit `outcome` ('sent' | 'partial' |
 *    'failed' | 'no_devices'), persisted with the send bookkeeping, so API
 *    consumers never infer the delivery case from the counts.
 */

export interface SendFailure {
  deviceTokenId: string;
  userId: string;
  tokenMask: string;
  code: string;
  message: string;
}

export interface NotificationSendResult {
  targeted: number;
  successful: number;
  failed: number;
  skipped: number;
  /**
   * Step 8 (additive) discriminator so clients never have to infer the case
   * from the counts:
   *   no_devices -> targeted === 0, nothing was attempted, no status change
   *   sent       -> every targeted device accepted the message
   *   partial    -> at least one success and at least one failure
   *   failed     -> every attempt failed (notification kept retryable)
   */
  outcome: SendOutcome;
  sentAt?: string;
  failures?: SendFailure[];
}

export type SendOutcome = 'sent' | 'partial' | 'failed' | 'no_devices';

/** Firebase error codes that mean the token can never work again for this sender. */
const UNREGISTERED_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** Max failure entries persisted on the notification document. */
const MAX_RECORDED_FAILURES = 25;

export type SendMessaging = Pick<Messaging, 'sendEachForMulticast'>;

export interface SendDeps {
  /** Injectable messaging for tests; defaults to the real Firebase messaging. */
  messaging?: SendMessaging;
}

function tokenMask(token: string): string {
  return token.length <= 10 ? '***' : `…${token.slice(-6)}`;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : 'unknown';
}

function firstLine(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : 'unknown error';
}

export async function sendNotification(
  models: ModelRegistry,
  req: Request,
  notificationId: string,
  deps: SendDeps = {}
): Promise<{ result: NotificationSendResult; notification: LooseDocument }> {
  // -- 1. Load and validate the notification -------------------------------
  const notification = await models.notifications
    .findOne({ id: notificationId })
    .lean<LooseDocument | null>();
  if (!notification) {
    throw new NotificationNotFoundError('notifications not found');
  }

  if (String(notification.status) === 'sent') {
    throw new NotificationConflictError('Notification has already been sent and cannot be sent again.');
  }

  const sendChannel = String(notification.channel ?? 'push');
  if (!(SENDABLE_CHANNELS as readonly string[]).includes(sendChannel)) {
    // Fires before targeting/FCM: non-push channels never reach Firebase and
    // never produce a delivery result.
    throw new NotificationInputError(
      sendChannel === 'sms'
        ? 'SMS delivery is not implemented yet. Only push notifications can be sent right now.'
        : `Channel '${sendChannel}' has no delivery implementation yet; only push notifications can be sent.`
    );
  }

  const title = String(notification.title ?? '').trim();
  const body = String(notification.body ?? '').trim();
  if (!title || !body) {
    throw new NotificationInputError('Notification title and body must be non-empty before sending.');
  }

  // -- 2. Resolve destinations through targeting (Step 7) ------------------
  // Unsupported segments throw a descriptive 400 from the targeting service.
  // segmentId is canonical; legacy records carry the UI field targetSegment.
  const { devices, description: segmentDescription } = await resolveTargetDevices(
    models,
    effectiveSegmentValue(notification)
  );
  const targeted = devices.length;

  if (targeted === 0) {
    // No real mobile destinations exist: nothing is delivered, nothing is
    // faked, and the notification keeps its current status for a later retry.
    await writeNotificationAudit(
      models,
      req,
      'notifications.sendSkipped',
      'notifications',
      notificationId,
      `Send skipped: segment '${segmentDescription}' resolved 0 registered devices; notification not delivered and status unchanged.`
    );
    return { result: { targeted: 0, successful: 0, failed: 0, skipped: 0, outcome: 'no_devices' }, notification };
  }

  return deliver(models, req, notification, devices, title, body, targeted, segmentDescription, deps);
}

async function deliver(
  models: ModelRegistry,
  req: Request,
  notification: LooseDocument,
  devices: LooseDocument[],
  title: string,
  body: string,
  targeted: number,
  segmentDescription: string,
  deps: SendDeps
): Promise<{ result: NotificationSendResult; notification: LooseDocument }> {
  const notificationId = String(notification.id);

  // -- 3. Build the payload and send through the existing Firebase Admin SDK --
  const messaging = deps.messaging ?? getFirebaseMessaging();
  const tokens = devices.map((device) => String(device.token));
  const message = {
    tokens,
    notification: { title, body },
    data: {
      notificationId,
      channel: 'push',
      source: 'admin-dashboard',
    },
  };

  const failures: SendFailure[] = [];
  const deactivateTargets: Array<{ userId: string; token: string }> = [];
  let successful = 0;
  let failed = 0;

  let batchResponses: Array<{ success: boolean; error?: unknown }> = [];
  try {
    const batch = await messaging.sendEachForMulticast(message);
    batchResponses = batch.responses.map((entry) => ({ success: entry.success, error: entry.error }));
  } catch (error) {
    // Batch-level exception (network/credential/argument): every targeted
    // device counts as failed; no device is deactivated for an unknown error.
    batchResponses = devices.map(() => ({ success: false, error }));
  }

  for (let index = 0; index < batchResponses.length; index += 1) {
    const response = batchResponses[index];
    const device = devices[index];
    if (response.success) {
      successful += 1;
      continue;
    }
    failed += 1;
    const code = errorCode(response.error);
    failures.push({
      deviceTokenId: String(device.id),
      userId: String(device.userId),
      tokenMask: tokenMask(String(device.token)),
      code,
      message: firstLine(response.error),
    });
    // Deactivate ONLY clearly invalid/unregistered destinations; temporary
    // errors (unavailable, internal, quota...) must not disable devices.
    if (UNREGISTERED_CODES.has(code)) {
      deactivateTargets.push({ userId: String(device.userId), token: String(device.token) });
    }
  }

  for (const target of deactivateTargets) {
    await deactivateDeviceToken(target.userId, target.token);
  }

  const skipped = targeted - successful - failed;
  const sentAtDate = new Date();
  const sentAtIso = sentAtDate.toISOString();
  const outcome: SendOutcome = successful === 0 ? 'failed' : failed > 0 ? 'partial' : 'sent';
  const sendResultRecord = {
    targeted,
    successful,
    failed,
    skipped,
    outcome,
    at: sentAtIso,
    failures: failures.slice(0, MAX_RECORDED_FAILURES),
  };

  // -- 4. Record the actual result and update status -----------------------
  // delivered to at least one device -> sent; every attempt failed -> failed
  // (retryable). Zero-device no-ops never reach this code path.
  const newStatus = successful > 0 ? 'sent' : 'failed';
  const updated = await models.notifications
    .findOneAndUpdate(
      { id: notificationId },
      {
        $set: {
          status: newStatus,
          sentAt: successful > 0 ? sentAtDate : null,
          sendResult: sendResultRecord,
          updatedAt: sentAtDate,
        },
      },
      { new: true, runValidators: true, lean: true }
    )
    .lean<LooseDocument | null>();
  if (!updated) {
    throw new NotificationNotFoundError('notifications not found');
  }

  // -- 5. Audit --------------------------------------------------------------
  const deactivatedNote = deactivateTargets.length > 0 ? ` Deactivated ${deactivateTargets.length} invalid device(s).` : '';
  if (successful > 0) {
    await writeNotificationAudit(
      models,
      req,
      'notifications.sent',
      'notifications',
      notificationId,
      `Sent notification ${notificationId} (segment: ${segmentDescription}): targeted ${targeted}, delivered ${successful}, failed ${failed}, skipped ${skipped}.${deactivatedNote}`
    );
  } else {
    await writeNotificationAudit(
      models,
      req,
      'notifications.sendFailed',
      'notifications',
      notificationId,
      `Send failed for all ${targeted} targeted devices (segment: ${segmentDescription}); notification marked failed for retry.${deactivatedNote}`
    );
  }

  const result: NotificationSendResult = {
    targeted,
    successful,
    failed,
    skipped,
    outcome,
    ...(successful > 0 ? { sentAt: sentAtIso } : {}),
    failures: failures.slice(0, MAX_RECORDED_FAILURES),
  };
  return { result, notification: cleanDoc(updated) };
}

