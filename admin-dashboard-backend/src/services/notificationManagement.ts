// src/services/notificationManagement.ts
import { Request } from 'express';
import { createId } from '../utils/ids';
import { cleanDoc } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { canonicalizeSegmentId } from './notificationSegments';

/**
 * Permission constant for the dedicated, permission-gated notifications
 * management router (same pattern as TRACKER_CONFIG_MANAGE).
 */
export const NOTIFICATION_MANAGE_PERMISSION = 'NOTIFICATION_MANAGE' as const;

/**
 * Canonical API contract (Step 8). These constants are the single source of
 * truth for validation and for the read-only GET /notifications/options
 * endpoint, so the documented contract cannot drift from the implementation.
 */
// Channels configurable on new/updated notifications. `email` was removed by
// product decision: it is rejected with 400 (legacy stored records are never
// rewritten or deleted). `sms` stays selectable/configurable but has no
// delivery implementation yet — only `push` is sendable (SENDABLE_CHANNELS).
export const NOTIFICATION_CHANNELS = ['push', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['draft', 'scheduled', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/**
 * Statuses a client may set directly. 'sent' and 'failed' are owned by the
 * delivery pipeline (POST /notifications/:id/send and the scheduler), so an
 * admin can never fake a delivery nor erase a recorded one.
 */
export const CLIENT_EDITABLE_STATUSES = ['draft', 'scheduled'] as const;

/** Channels that have a delivery implementation today (Firebase push only). */
export const SENDABLE_CHANNELS = ['push'] as const;

export class NotificationInputError extends Error {
  statusCode = 400;
}

export class NotificationNotFoundError extends Error {
  statusCode = 404;
}

export class NotificationConflictError extends Error {
  statusCode = 409;
}

const CHANNEL_SET = new Set<string>(NOTIFICATION_CHANNELS);
const STATUS_SET = new Set<string>(NOTIFICATION_STATUSES);
const CLIENT_EDITABLE_STATUS_SET = new Set<string>(CLIENT_EDITABLE_STATUSES);

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new NotificationInputError(`${field} is required.`);
  return text;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function channelValue(value: unknown): string {
  const s = String(value ?? 'push').trim().toLowerCase();
  if (!CHANNEL_SET.has(s)) {
    throw new NotificationInputError(`channel must be one of: ${[...CHANNEL_SET].join(', ')}.`);
  }
  return s;
}

function statusValue(value: unknown): string {
  const s = String(value ?? 'draft').trim().toLowerCase();
  if (!STATUS_SET.has(s)) {
    throw new NotificationInputError(`status must be one of: ${[...STATUS_SET].join(', ')}.`);
  }
  return s;
}

function scheduleAtValue(value: unknown): Date | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new NotificationInputError('scheduleAt must be a valid ISO date string.');
    return value;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new NotificationInputError('scheduleAt must be a valid ISO date string.');
  }
  return date;
}

/**
 * Canonicalizes recognized segment values (slugs and the UI labels the
 * existing frontend displays) onto the canonical slug. Unrecognized values are
 * stored verbatim for backward compatibility with legacy records; resolution
 * then reports a descriptive 400 at send/dispatch time instead of guessing.
 */
function segmentIdValue(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;
  return canonicalizeSegmentId(text) ?? text;
}

/**
 * Tolerant read of a stored schedule value (canonical scheduleAt, or the
 * legacy scheduledFor alias on older records). Unparsable legacy values are
 * treated as "no schedule" rather than failing the request.
 */
function storedScheduleAt(current?: LooseDocument): Date | null {
  if (!current) return null;
  const raw = current.scheduleAt ?? current.scheduledFor ?? null;
  try {
    return scheduleAtValue(raw);
  } catch {
    return null;
  }
}

/**
 * Status guard (Step 8). `currentStatus` is undefined for creates and the
 * stored status for PUT/PATCH.
 *
 *  - create: only 'draft' | 'scheduled' may be chosen.
 *  - update: a value equal to the stored status is a no-op (the admin UI
 *    echoes the loaded status back), 'sent' is final in both directions, and
 *    'failed' cannot be set by hand (POST /notifications/:id/send owns it).
 *  - PUT keeps 'sent' when the body omits status instead of resetting it.
 */
function resolvedStatus(requested: unknown, currentStatus?: string): string {
  const fallback = currentStatus === 'sent' ? 'sent' : 'draft';
  const target = statusValue(requested ?? fallback);

  if (currentStatus === undefined) {
    if (!CLIENT_EDITABLE_STATUS_SET.has(target)) {
      throw new NotificationInputError(
        `status '${target}' is set by the delivery pipeline and cannot be chosen when creating a notification; use one of: ${CLIENT_EDITABLE_STATUSES.join(', ')}.`
      );
    }
    return target;
  }
  if (target === currentStatus) return target;
  if (currentStatus === 'sent') {
    throw new NotificationInputError(
      `status 'sent' is final: a sent notification cannot be changed to '${target}'. Its delivery result is recorded history.`
    );
  }
  if (!CLIENT_EDITABLE_STATUS_SET.has(target)) {
    throw new NotificationInputError(
      `status '${target}' is set by the delivery pipeline; use POST /notifications/:id/send instead. Allowed client values are: ${CLIENT_EDITABLE_STATUSES.join(', ')}.`
    );
  }
  return target;
}

/**
 * A notification can only be picked up by the dispatcher when it carries a
 * real schedule date, so the API refuses to store 'scheduled' without one
 * (previously such a record silently never fired).
 */
function ensureSchedulable(status: string, scheduleAt: Date | null): void {
  if (status !== 'scheduled' || scheduleAt !== null) return;
  throw new NotificationInputError(
    "status 'scheduled' requires a scheduleAt date: the dispatcher only processes notifications with a real schedule date."
  );
}

/**
 * Validates a notification creation payload. Field set is intentionally
 * limited to the established notification schema (title, body, channel,
 * scheduleAt, segmentId, templateId, status); server-owned fields (sentAt,
 * sendResult, id, timestamps) and delivery inputs (device tokens, arbitrary
 * user ids) can never be supplied by a client — unknown body keys are dropped.
 *
 * Compatibility shim (Step 7 discovery): the existing notifications UI posts
 * `type`, `targetSegment` and `scheduledFor`; these are accepted as aliases
 * for the canonical `channel`, `segmentId` and `scheduleAt`, which always
 * take precedence when explicitly provided. Without this shim the UI values
 * were silently dropped.
 *
 * PUT reuses this function with the stored document as `current`, so a full
 * replace cannot reset an already-sent notification back to draft.
 */
export function validateNotificationCreate(input: LooseDocument, current?: LooseDocument): LooseDocument {
  const currentStatus = current === undefined ? undefined : String(current.status ?? 'draft');
  const status = resolvedStatus(input.status, currentStatus);
  const scheduleAt = scheduleAtValue(input.scheduleAt !== undefined ? input.scheduleAt : input.scheduledFor);
  ensureSchedulable(status, scheduleAt);
  return {
    title: requiredText(input.title, 'title'),
    body: requiredText(input.body, 'body'),
    channel: channelValue(input.channel !== undefined ? input.channel : input.type),
    scheduleAt,
    segmentId: segmentIdValue(input.segmentId !== undefined ? input.segmentId : input.targetSegment),
    templateId: optionalText(input.templateId),
    status,
  };
}

export function validateNotificationUpdates(input: LooseDocument, current?: LooseDocument): LooseDocument {
  const updates: LooseDocument = {};
  if (input.title !== undefined) updates.title = requiredText(input.title, 'title');
  if (input.body !== undefined) updates.body = requiredText(input.body, 'body');
  if (input.channel !== undefined || input.type !== undefined) {
    updates.channel = channelValue(input.channel !== undefined ? input.channel : input.type);
  }
  const scheduleProvided = input.scheduleAt !== undefined || input.scheduledFor !== undefined;
  if (scheduleProvided) {
    updates.scheduleAt = scheduleAtValue(input.scheduleAt !== undefined ? input.scheduleAt : input.scheduledFor);
  }
  if (input.segmentId !== undefined || input.targetSegment !== undefined) {
    updates.segmentId = segmentIdValue(input.segmentId !== undefined ? input.segmentId : input.targetSegment);
  }
  if (input.templateId !== undefined) updates.templateId = optionalText(input.templateId);
  if (input.status !== undefined) {
    updates.status = resolvedStatus(input.status, current === undefined ? undefined : String(current.status ?? 'draft'));
  }
  if (Object.keys(updates).length === 0) {
    throw new NotificationInputError('At least one notification field is required.');
  }
  // The resulting record must stay dispatchable while it is 'scheduled'.
  const resultingStatus = String(updates.status ?? current?.status ?? 'draft');
  const resultingSchedule = scheduleProvided ? (updates.scheduleAt as Date | null) : storedScheduleAt(current);
  ensureSchedulable(resultingStatus, resultingSchedule);
  // The dispatcher reads scheduleAt only. When a transition to 'scheduled'
  // was validated against a legacy scheduledFor date (or an existing canonical
  // date not echoed in the body), canonicalize it on write so the record the
  // API just accepted can actually be dispatched instead of silently never
  // firing. Service-layer canonicalization — the scheduler itself is unchanged.
  if (resultingStatus === 'scheduled' && updates.scheduleAt === undefined && resultingSchedule instanceof Date) {
    updates.scheduleAt = resultingSchedule;
  }
  return updates;
}

/**
 * Strict audit writer for notification configuration changes (mirrors
 * writeTrackerAudit). Throws on failure so a lost audit entry cannot pass
 * silently; do not confuse with the fire-and-forget utils/audit logAudit.
 */
export async function writeNotificationAudit(
  models: ModelRegistry,
  req: Request,
  action: string,
  resource: string,
  targetId: string,
  description: string,
): Promise<LooseDocument> {
  try {
    const result = await models.auditLogs.create({
      id: createId('audit'),
      adminId: typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown',
      adminName: typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin',
      action,
      target: targetId,
      description,
      createdAt: new Date(),
      targetType: resource,
      targetId,
      reason: null,
    });
    return cleanDoc(result);
  } catch (e) {
    console.error(`[NOTIFICATION AUDIT] Failed to write audit entry for ${action}:`, e);
    throw e;
  }
}























// The mobile user could receive a notification even when the Super Bae app is not currently open, depending on the mobile app's notification handling.

// Your current backend is already prepared for this. The remaining real-device dependency is the mobile developer's FCM token registration.