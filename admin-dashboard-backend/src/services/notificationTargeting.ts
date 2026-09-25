// src/services/notificationTargeting.ts
import { LooseDocument, ModelRegistry } from '../models/registry';
import { DeviceTokenModel } from '../models/deviceToken';
import { cleanDoc } from '../utils/clean';
import { NotificationInputError } from './notificationManagement';
import {
  ACTIVE_WINDOW_DAYS,
  SEGMENT_LABELS,
  SUPPORTED_SEGMENTS,
  canonicalizeSegmentId,
} from './notificationSegments';
import type { SupportedSegment } from './notificationSegments';

/**
 * Notification targeting (Step 7).
 *
 * Resolves the destination set for a notification from data that ALREADY
 * exists in this backend. The supported segment allowlist is the exact
 * contract of the existing notifications UI (create/page.tsx):
 *
 *   all_users      -> All Users                       (default; empty/null too)
 *   active_users   -> Active Users (last 7 days)      -> users.lastSeen >= cutoff
 *   premium_users  -> Premium Subscribers             -> users.plan === 'premium'
 *   inactive_users -> Inactive Users                  -> users NOT seen in the last 7 days
 *                     (older lastSeen, or no usable lastSeen value)
 *
 * Identity rule (verified Step 4): the users collection has NO firebaseUid
 * field and this backend has no mobile-user authentication, so segments based
 * on Firebase identity are NOT supported and never guessed. Any other
 * segmentId value is rejected with a 400 naming the supported set and the
 * missing integration.
 *
 * The result is a device registration list (never raw tokens exposed to
 * callers beyond what the sender already masks); the sender stays the single
 * place that performs FCM delivery.
 */

// The segment vocabulary lives in the dependency-free notificationSegments
// module (single source of truth, shared with the management service and the
// read-only /notifications/options contract endpoint). It is imported for
// local use and re-exported so existing importers keep working unchanged.
export { ACTIVE_WINDOW_DAYS, SEGMENT_LABELS, SUPPORTED_SEGMENTS, canonicalizeSegmentId };
export type { SupportedSegment };

/**
 * Validates and normalizes a stored segment value. Returns null for the
 * implicit default (all users); throws a descriptive 400 for unsupported
 * values instead of pretending they resolve.
 */
export function normalizeSegmentId(raw: unknown): SupportedSegment | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = String(raw).trim();
  const canonical = canonicalizeSegmentId(value);
  if (canonical) return canonical;
  throw new NotificationInputError(
    `Unsupported target segment '${value}'. Supported segments: ${SUPPORTED_SEGMENTS.join(', ')}. ` +
      'Segments based on Firebase identity are not available yet: the users collection has no firebaseUid field and mobile-user authentication is not integrated.'
  );
}

/**
 * The effective segment source for a notification: the canonical `segmentId`
 * when present, otherwise the legacy UI field `targetSegment` that seeded and
 * older records carry. Keeping the fallback here (rather than defaulting to
 * all_users) prevents a legacy "Premium Subscribers" record from silently
 * being treated as an all-users broadcast.
 */
export function effectiveSegmentValue(notification: {
  segmentId?: unknown;
  targetSegment?: unknown;
}): unknown {
  const canonical = notification.segmentId;
  if (canonical !== undefined && canonical !== null && String(canonical).trim() !== '') {
    return canonical;
  }
  return notification.targetSegment;
}

function activeWindowCutoff(now: Date): Date {
  return new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Resolves the user ids for a supported segment. Returns null when the
 * segment targets all users (no user-side filter needed).
 */
async function resolveUserIds(
  models: ModelRegistry,
  segment: SupportedSegment,
  now: Date
): Promise<string[] | null> {
  if (segment === 'all_users') return null;

  if (segment === 'premium_users') {
    const users = await models.users
      .find({ plan: 'premium' })
      .select({ id: 1 })
      .lean<LooseDocument[]>();
    return users.map((user) => String(user.id));
  }

  const cutoff = activeWindowCutoff(now);
  if (segment === 'active_users') {
    const users = await models.users
      .find({ lastSeen: { $type: 'date', $gte: cutoff } })
      .select({ id: 1 })
      .lean<LooseDocument[]>();
    return users.map((user) => String(user.id));
  }

  // inactive_users: everyone NOT seen within the window (older lastSeen,
  // or no lastSeen at all). $type:'date' guards against malformed values,
  // mirroring the contentScheduler lesson — non-dates count as inactive.
  const recent = await models.users
    .find({ lastSeen: { $type: 'date', $gte: cutoff } })
    .select({ id: 1 })
    .lean<LooseDocument[]>();
  const recentIds = new Set(recent.map((user) => String(user.id)));
  const all = await models.users
    .find({})
    .select({ id: 1 })
    .lean<LooseDocument[]>();
  return all.map((user) => String(user.id)).filter((id) => !recentIds.has(id));
}

export interface ResolvedTargets {
  devices: LooseDocument[];
  description: string;
}

/**
 * Resolves the active device registrations for the notification's segment.
 * Inactive device registrations are always excluded; the caller (sender)
 * handles the zero-device case honestly.
 */
export async function resolveTargetDevices(
  models: ModelRegistry,
  segmentId: unknown
): Promise<ResolvedTargets> {
  const segment = normalizeSegmentId(segmentId) ?? 'all_users';
  const userIds = await resolveUserIds(models, segment, new Date());
  const filter =
    userIds === null
      ? { isActive: true }
      : { isActive: true, userId: { $in: userIds } };
  const docs = await DeviceTokenModel.find(filter).lean<LooseDocument[]>();
  return { devices: docs.map((doc) => cleanDoc(doc)), description: segment };
}
