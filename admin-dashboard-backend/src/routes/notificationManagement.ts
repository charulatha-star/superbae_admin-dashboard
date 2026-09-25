// src/routes/notificationManagement.ts
import express from 'express';
import { createId } from '../utils/ids';
import { cleanDoc, cleanDocs } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  CLIENT_EDITABLE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MANAGE_PERMISSION,
  NOTIFICATION_STATUSES,
  NotificationConflictError,
  NotificationInputError,
  NotificationNotFoundError,
  SENDABLE_CHANNELS,
  validateNotificationCreate,
  validateNotificationUpdates,
  writeNotificationAudit,
} from '../services/notificationManagement';
import { sendNotification, SendDeps } from '../services/notificationSender';
import { canonicalizeSegmentId, SEGMENT_LABELS, SUPPORTED_SEGMENTS } from '../services/notificationSegments';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function statusCode(error: unknown): number {
  return error instanceof NotificationInputError
    || error instanceof NotificationConflictError
    || error instanceof NotificationNotFoundError
    ? error.statusCode
    : 500;
}

/**
 * Internal-only fields that must never appear in an API response:
 * `scheduledClaimedAt` is the dispatcher's transient claim/backoff marker.
 */
const INTERNAL_RESPONSE_FIELDS = ['scheduledClaimedAt'] as const;

/**
 * Non-throwing canonical projection helpers used only on the read path: a
 * legacy-only record gains the canonical fields when a faithful mapping
 * exists, and `null` when it does not (nothing is invented).
 */
function channelDisplay(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(text) ? text : null;
}

function scheduleDisplay(value: unknown): Date | string | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Read-side projection. Every response carries BOTH vocabularies so the shape
 * is predictable for every record:
 *
 *  - canonical: channel / segmentId / scheduleAt (stored value, or a faithful
 *    projection from a legacy field, or null — never fabricated)
 *  - legacy aliases: type / targetSegment / scheduledFor (stored value kept
 *    verbatim on legacy records; otherwise projected from the canonical field)
 *
 * Internal dispatcher bookkeeping is stripped. Nothing here is ever persisted.
 */
function withUiFields(doc: LooseDocument): LooseDocument {
  const clean = cleanDoc(doc);
  for (const field of INTERNAL_RESPONSE_FIELDS) delete clean[field];
  // Canonical projections for legacy-only records.
  if (clean.channel === undefined) clean.channel = channelDisplay(clean.type);
  if (clean.segmentId === undefined || clean.segmentId === null) {
    clean.segmentId = canonicalizeSegmentId(clean.targetSegment);
  }
  if (clean.scheduleAt === undefined) clean.scheduleAt = scheduleDisplay(clean.scheduledFor);
  // Delivery bookkeeping is exposed as an explicit null when it was never
  // written, so the response shape is identical for every record.
  if (clean.sentAt === undefined) clean.sentAt = null;
  if (clean.sendResult === undefined) clean.sendResult = null;
  if (clean.templateId === undefined) clean.templateId = null;
  // Legacy aliases for canonical records (the existing UI's vocabulary).
  if (clean.type === undefined) clean.type = clean.channel;
  if (clean.targetSegment === undefined) clean.targetSegment = clean.segmentId ?? null;
  if (clean.scheduledFor === undefined) clean.scheduledFor = clean.scheduleAt ?? null;
  return clean;
}

/**
 * Dedicated, permission-gated notifications management router.
 *
 * Replaces the previous auth-only generic CRUD mount for /notifications
 * (which any authenticated admin could hit). Reads require authentication;
 * every write requires NOTIFICATION_MANAGE and is audited. Sending uses
 * POST /notifications/:id/send and is likewise permission-gated; it is
 * implemented here (not in the generic CRUD loop) and 'notifications' is
 * skipped from the generic loop, so there is no unpermissioned alternative
 * path for sending.
 *
 * API compatibility with the former generic CRUD is preserved:
 *   GET    /notifications               -> list (filter/sort/pagination params)
 *   GET    /notifications/options       -> supported channel/status/segment contract
 *   GET    /notifications/:id           -> doc or 404
 *   POST   /notifications               -> 201 created doc (server-side id)
 *   PUT    /notifications/:id           -> full replace, 404 when missing
 *   PATCH  /notifications/:id           -> partial update, 404 when missing
 *   DELETE /notifications/:id           -> 200 with the deleted doc, 404 when missing
 *   POST   /notifications/:id/send      -> structured send result (Step 5),
 *                                         targeting resolved by segment (Step 7)
 *
 * Compatibility shims for the UI's field vocabulary (type / targetSegment /
 * scheduledFor) are input-only on write and read-only aliases on responses;
 * nothing extra is persisted and the canonical fields stay authoritative.
 *
 * Status contract (Step 8): a client may set 'draft' | 'scheduled' only.
 * 'sent' and 'failed' are written exclusively by the delivery pipeline, 'sent'
 * is final in both directions, and PUT keeps an existing 'sent' status when the
 * body omits status (a full replace must not resurrect a delivered record).
 *
 * The router does NOT register device-token registration endpoints (those
 * wait for mobile-user authentication) and never exposes Firebase credentials.
 */
export function createNotificationManagementRouter(
  models: ModelRegistry,
  sendDeps: SendDeps = {}
) {
  const router = express.Router();
  const managePermission = [requireAuth, requirePermission(NOTIFICATION_MANAGE_PERMISSION)];
  const readPermission = [requireAuth];

  function listQuery(req: { query: Record<string, unknown> }): { filter: LooseDocument; limit: number; page: number; sortKey?: string; sortDir: 1 | -1 } {
    const filter: LooseDocument = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (value === undefined || value === null || value === '') continue;
      if (['_limit', '_page', '_sort', '_order', '_embed', '_expand', 'page', 'limit', 'search'].includes(key)) continue;
      filter[key] = value;
    }
    const limit = parseInt(String(req.query._limit ?? req.query.limit ?? '0'), 10) || 0;
    const page = parseInt(String(req.query._page ?? req.query.page ?? '1'), 10) || 1;
    const sortKey = typeof req.query._sort === 'string' ? req.query._sort : undefined;
    const sortDir = req.query._order === 'desc' ? -1 : 1;
    return { filter, limit, page, sortKey, sortDir };
  }

  /**
   * Read-only contract endpoint (Step 8): the supported values the frontend
   * may use, derived from the same constants the validators enforce. Exposes
   * only supported segments (no Firebase-based segments yet) and never any
   * credential material.
   */
  router.get('/notifications/options', ...readPermission, (_req, res) => {
    res.json({
      channels: [...NOTIFICATION_CHANNELS],
      sendableChannels: [...SENDABLE_CHANNELS],
      statuses: [...NOTIFICATION_STATUSES],
      clientEditableStatuses: [...CLIENT_EDITABLE_STATUSES],
      segments: SUPPORTED_SEGMENTS.map((value) => ({ value, label: SEGMENT_LABELS[value] })),
      uiFieldAliases: { type: 'channel', targetSegment: 'segmentId', scheduledFor: 'scheduleAt' },
    });
  });

  router.get('/notifications', ...readPermission, async (req, res) => {
    try {
      const { filter, limit, page, sortKey, sortDir } = listQuery(req as { query: Record<string, unknown> });
      let query = models.notifications.find(filter).lean<LooseDocument[]>();
      if (sortKey) query = query.sort({ [sortKey]: sortDir } as Record<string, 1 | -1>);
      if (limit) query = query.skip(limit && page > 1 ? (page - 1) * limit : 0).limit(limit);
      res.json(cleanDocs(await query).map((doc) => withUiFields(doc)));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/notifications/:id', ...readPermission, async (req, res) => {
    try {
      const doc = await models.notifications.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!doc) return res.status(404).json({ message: 'notifications not found' });
      res.json(withUiFields(doc));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.post('/notifications', ...managePermission, async (req, res) => {
    try {
      const payload = validateNotificationCreate(req.body as LooseDocument);
      payload.id = createId('notification');
      payload.createdAt = new Date();
      payload.updatedAt = new Date();
      // Server-owned delivery bookkeeping starts as an explicit null (the
      // documented field type is `| null`), so the stored record matches the
      // contract from creation. Only the delivery pipeline ever writes these.
      payload.sentAt = null;
      payload.sendResult = null;
      const created = await models.notifications.create(payload);
      await writeNotificationAudit(models, req, 'notifications.created', 'notifications', String(payload.id), `Created notification ${payload.id}: ${payload.title}.`);
      res.status(201).json(withUiFields(created));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.put('/notifications/:id', ...managePermission, async (req, res) => {
    try {
      const existing = await models.notifications.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'notifications not found' });
      const payload = validateNotificationCreate(req.body as LooseDocument, existing);
      payload.updatedAt = new Date();
      const updated = await models.notifications
        .findOneAndUpdate({ id: req.params.id }, { $set: payload }, { new: true, runValidators: true, lean: true })
        .lean<LooseDocument | null>();
      if (!updated) return res.status(404).json({ message: 'notifications not found' });
      await writeNotificationAudit(models, req, 'notifications.updated', 'notifications', String(req.params.id), `Replaced notification ${String(req.params.id)}.`);
      res.json(withUiFields(updated));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.patch('/notifications/:id', ...managePermission, async (req, res) => {
    try {
      const existing = await models.notifications.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'notifications not found' });
      const updates = validateNotificationUpdates(req.body as LooseDocument, existing);
      updates.updatedAt = new Date();
      const updated = await models.notifications
        .findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true, runValidators: true, lean: true })
        .lean<LooseDocument | null>();
      if (!updated) return res.status(404).json({ message: 'notifications not found' });
      await writeNotificationAudit(models, req, 'notifications.updated', 'notifications', String(req.params.id), `Updated notification ${String(req.params.id)}: ${Object.keys(updates).join(', ')}.`);
      res.json(withUiFields(updated));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.delete('/notifications/:id', ...managePermission, async (req, res) => {
    try {
      const existing = await models.notifications.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'notifications not found' });
      await writeNotificationAudit(models, req, 'notifications.deleted', 'notifications', String(req.params.id), `Deleted notification ${String(req.params.id)} (${String(existing.title)}).`);
      await models.notifications.deleteOne({ id: req.params.id });
      res.status(200).json(withUiFields(existing));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.post('/notifications/:id/send', ...managePermission, async (req, res) => {
    try {
      const { result, notification } = await sendNotification(
        models,
        req,
        String(req.params.id),
        sendDeps
      );
      res.status(200).json({ result, notification: withUiFields(notification) });
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  return router;
}
