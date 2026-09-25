// src/lib/notifications/helpers.ts
/**
 * Pure Notifications UI helpers (Step 9).
 *
 * Deliberately dependency-free (zero imports) on purpose: the verification
 * script (scripts/verify-notifications.mjs) imports this file directly under
 * Node's native type stripping to unit-check the outcome/status/error
 * mappings, while the three notification pages share it so each mapping
 * lives in exactly one place.
 *
 * Only display-safe API fields are ever referenced — never Firebase
 * credentials, full device tokens, or internal dispatcher fields such as
 * `scheduledClaimedAt` (the backend strips those from every response).
 */

/** One entry of GET /notifications/options → segments. */
export interface SegmentOption {
  value: string;
  label: string;
}

/** Normalized shape of GET /notifications/options (the source of truth). */
export interface NotificationOptions {
  channels: string[];
  sendableChannels: string[];
  statuses: string[];
  clientEditableStatuses: string[];
  segments: SegmentOption[];
}

/** A single delivery failure exactly as returned by the send endpoint. */
export interface NotificationSendFailure {
  tokenMask?: string;
  code?: string;
  message?: string;
}

/** `sendResult` / send-response `result` (counts are always backend-set). */
export interface NotificationSendResult {
  targeted?: number;
  successful?: number;
  failed?: number;
  skipped?: number;
  outcome?: 'sent' | 'partial' | 'failed' | 'no_devices';
  at?: string;
  sentAt?: string;
  failures?: NotificationSendFailure[];
}

/** The only two statuses an admin may set by hand. `sent` and `failed` are
 *  written only by the backend delivery pipeline / scheduler. */
export const CLIENT_STATUS_OPTIONS: ReadonlyArray<{ value: 'draft' | 'scheduled'; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
];

/** Statuses that may be edited (the content can still be changed). */
export const EDITABLE_STATUSES: readonly string[] = ['draft', 'scheduled'];

/** Statuses that may be manually sent now (never `scheduled`: the backend
 *  scheduler owns those, and never `sent` because re-sending is impossible). */
export const MANUAL_SEND_STATUSES: readonly string[] = ['draft', 'failed'];

/** Confirmation copy for the manual send; Retry re-uses the same record. */
export function sendActionConfirmCopy(status: string): string {
  return status === 'failed'
    ? 'Retry delivery for this failed notification? The same record will be sent again — no new notification is created.'
    : 'Send this draft now? It will be delivered immediately instead of waiting for a schedule.';
}

/** The status explanation shown under the status badge on the list page. */
export function statusLine(status: string, scheduledLabel?: string | null): string {
  switch (status) {
    case 'scheduled':
      return scheduledLabel
        ? `Scheduled for ${scheduledLabel} — it will be sent automatically.`
        : 'Scheduled — it will be sent automatically by the backend scheduler.';
    case 'sent':
      return 'Sent — delivery result shown below.';
    case 'failed':
      return 'Failed — Retry or inspect the failure.';
    default:
      return 'Draft — Send Now or schedule it.';
  }
}

/** Whether the list should show the Edit action. */
export function canEdit(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/**
 * Canonical notification as returned by every notifications endpoint. The
 * backend always includes BOTH vocabularies: canonical (channel/segmentId/
 * scheduleAt) plus the legacy UI aliases (type/targetSegment/scheduledFor),
 * with sentAt/sendResult as explicit null until the pipeline writes them.
 */
export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  channel?: string | null;
  type?: string | null;
  segmentId?: string | null;
  targetSegment?: string | null;
  scheduleAt?: string | null;
  scheduledFor?: string | null;
  templateId?: string | null;
  status: string;
  sentAt?: string | null;
  sendResult?: NotificationSendResult | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Response body of POST /notifications/:id/send. */
export interface NotificationSendResponse {
  result: NotificationSendResult;
  notification: NotificationRecord;
}

/** Toast flavour for a send outcome (matches the Toast component types). */
export interface SendOutcomeDisplay {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

/** Canonical schedule value → value for `<input type="datetime-local">`. */
export function toDatetimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Human label for a channel value (`push` → `Push`, `sms` → `SMS`). */
const CHANNEL_LABELS: Record<string, string> = { sms: 'SMS', email: 'Email' };

export function channelLabel(value?: string | null): string {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return CHANNEL_LABELS[text] ?? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Human label for a segment using ONLY labels supplied by
 * GET /notifications/options — never a hard-coded option list. Records
 * without a segment mean the backend default (`all_users`); unknown legacy
 * raw values are displayed verbatim rather than guessed.
 */
export function segmentLabel(options: NotificationOptions | null, value?: string | null): string {
  if (value === undefined || value === null || String(value).trim() === '') {
    const fallback = options?.segments.find((segment) => segment.value === 'all_users');
    return fallback?.label ?? 'All Users';
  }
  const raw = String(value);
  const match = options?.segments.find((segment) => segment.value === raw || segment.label === raw);
  return match?.label ?? raw;
}

/** Status badge modifier for users/page.module.css (`scheduled` is custom). */
export function statusBadgeModifier(status: string): 'active' | 'suspended' | 'inactive' {
  if (status === 'sent') return 'active';
  if (status === 'failed') return 'suspended';
  return 'inactive';
}

/** Backend rule: `sent` is final — no Send action, no status transitions. */
export function isFinalStatus(status: string): boolean {
  return status === 'sent';
}

/**
 * Whether the Send action may be offered: the record's status must be one an
 * admin may trigger manually (`draft` or `failed` — never `scheduled`, which
 * the backend scheduler owns, and never `sent`, which is final) AND its
 * channel is in the backend's `sendableChannels` list (sms has no delivery
 * implementation yet — and legacy email records must never look sendable
 * either).
 * Without options nothing is offered — the capability list is never
 * hard-coded here.
 */
export function canSend(
  notification: { status?: string | null; channel?: string | null; type?: string | null },
  options: NotificationOptions | null
): boolean {
  if (!options) return false;
  if (!notification.status || !MANUAL_SEND_STATUSES.includes(notification.status)) return false;
  const channel = notification.channel ?? notification.type;
  return typeof channel === 'string' && channel !== '' && options.sendableChannels.includes(channel);
}

/**
 * `Send Now` is the optional convenience for an admin who wants a draft
 * delivered immediately instead of scheduling it. Draft only — `failed` uses
 * the distinct Retry action and `scheduled` is delivered by the backend
 * scheduler, so neither ever offers a manual send.
 */
export function canSendNow(status: unknown): boolean {
  return status === 'draft';
}

/**
 * Retry reuses the same record through the same existing send endpoint.
 * Failed only — `draft` uses Send Now and `sent` is final.
 */
export function canRetry(status: unknown): boolean {
  return status === 'failed';
}

/**
 * Status values the edit form may offer, following the backend contract:
 * only `clientEditableStatuses` (draft/scheduled) plus the record's current
 * value — echoing the stored status is an allowed no-op, which is how a
 * `failed` record stays selectable while `sent` can never be chosen.
 */
export function statusSelectValues(current: string, options: NotificationOptions | null): string[] {
  const stored = current || 'draft';
  if (isFinalStatus(stored)) return [stored];
  const base = options?.clientEditableStatuses ?? [stored];
  return base.includes(stored) ? [...base] : [...base, stored];
}

/**
 * Maps POST /notifications/:id/send `result.outcome` to an honest,
 * user-facing message. `no_devices` must NEVER read like a delivery —
 * nothing reached a phone.
 */
export function describeSendOutcome(result: NotificationSendResult | null | undefined): SendOutcomeDisplay {
  if (!result) return { type: 'info', message: 'Send finished without a result.' };
  const targeted = result.targeted ?? 0;
  const successful = result.successful ?? 0;
  const failed = result.failed ?? 0;
  switch (result.outcome) {
    case 'sent':
      return { type: 'success', message: `Delivered to ${successful} of ${targeted} device${targeted === 1 ? '' : 's'}.` };
    case 'partial':
      return { type: 'warning', message: `Delivered ${successful} of ${targeted} devices — ${failed} failed.` };
    case 'no_devices':
      return { type: 'warning', message: 'No active devices are registered — nothing was delivered.' };
    case 'failed':
      return { type: 'error', message: `Delivery failed — none of the ${targeted} targeted devices received it.` };
    default:
      return { type: 'info', message: 'Send finished without a recognisable outcome.' };
  }
}

/**
 * Turns any thrown value into a safe, user-facing message:
 *  - permission failures (403) get a clear notification-specific explanation;
 *  - server errors (>= 500) are replaced with generic text so backend
 *    internals / secrets are never shown;
 *  - backend user-facing messages (400/404/409/401) pass through as-is;
 *  - network failures get a connection hint.
 * Falls back to the caller's generic message for anything unrecognised.
 */
export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const status = (error as Error & { status?: unknown }).status;
    if (typeof status === 'number') {
      if (status === 403) return 'You do not have permission to manage notifications.';
      if (status >= 500) return 'Something went wrong on the server. Please try again.';
      if (error.message) return error.message;
      return fallback;
    }
    if (error instanceof TypeError) {
      return 'Unable to reach the server. Please check your connection and try again.';
    }
    if (error.message) return error.message;
    return fallback;
  }
  return fallback;
}

