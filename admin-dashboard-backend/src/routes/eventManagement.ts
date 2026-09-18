import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { cleanDoc } from '../utils/clean';
import { createId } from '../utils/ids';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { requireAuth, requirePermission } from '../middleware/auth';
import { eventImageUpload, eventImageUrl } from '../services/eventImageStorage';
import {
  EventConflictError,
  EventInputError,
  EventNotFoundError,
  EVENTS_MANAGE_PERMISSION,
  cancelEventRegistration,
  checkInEventRegistration,
  getEventAnalytics,
  getEventAnalyticsSummary,
  registerForEvent,
  validateCreateEvent,
  validateEventUpdates,
  writeEventAudit,
} from '../services/eventManagement';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function statusCode(error: unknown): number {
  return error instanceof EventInputError || error instanceof EventConflictError || error instanceof EventNotFoundError
    ? error.statusCode
    : 500;
}

export function createEventCrudRouter(models: ModelRegistry) {
  const router = express.Router();
  const permission = [requireAuth, requirePermission(EVENTS_MANAGE_PERMISSION)];

  router.post('/upload-image', ...permission, eventImageUpload.single('file'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ message: 'An image file is required.' });
    res.status(201).json({ imageUrl: eventImageUrl(req, req.file.filename) });
  });

  router.post('/', ...permission, async (req, res) => {
    try {
      const payload = validateCreateEvent(req.body as LooseDocument);
      payload.id = createId('event');
      const event = await models.events.create(payload);
      const cleaned = cleanDoc(event);
      await writeEventAudit(models, req, 'event.created', String(payload.id), `Created event ${payload.id}.`);
      res.status(201).json(cleaned);
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.get('/:id', ...permission, async (req, res) => {
    try {
      const eventId = String(req.params.id);
      const event = await models.events.findOne({ id: eventId }).lean<LooseDocument | null>();
      if (!event) return res.status(404).json({ message: 'events not found' });
      res.json(cleanDoc(event));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.patch('/:id', ...permission, async (req, res) => {
    try {
      const eventId = String(req.params.id);
      const existing = await models.events.findOne({ id: eventId }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'events not found' });
      const updates = validateEventUpdates(req.body as LooseDocument);
      if (updates.capacity !== undefined) {
        const activeRegistrations = await models.eventRegistrations.countDocuments({ eventId, status: { $ne: 'cancelled' } });
        if (Number(updates.capacity) < activeRegistrations) {
          throw new EventConflictError(`capacity cannot be lower than ${activeRegistrations} active registrations.`);
        }
      }
      updates.updatedAt = new Date();
      const updated = await models.events.findOneAndUpdate({ id: eventId }, { $set: updates }, { new: true, runValidators: true, lean: true }).lean<LooseDocument | null>();
      if (!updated) return res.status(404).json({ message: 'events not found' });
      await writeEventAudit(models, req, 'event.updated', eventId, `Updated event ${eventId}: ${Object.keys(updates).join(', ')}.`);
      res.json(cleanDoc(updated));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.delete('/:id', ...permission, async (req, res) => {
    try {
      const eventId = String(req.params.id);
      const existing = await models.events.findOne({ id: eventId }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'events not found' });

      // Write audit log BEFORE deletion - capture enough detail since event will be gone
      const eventTitle = String(existing.title || 'Unknown Event');
      await writeEventAudit(models, req, 'event.deleted', eventId, `Deleted event ${eventId} (${eventTitle}). All registrations cascade deleted. Image file removed if existed. Payments preserved.`);

      // Cascade delete all eventRegistrations tied to this eventId
      await models.eventRegistrations.deleteMany({ eventId });

      // Delete the event's uploaded image file from disk if one exists
      const imageUrl = String(existing.imageUrl || '');
      if (imageUrl) {
        // Extract filename from URL like /uploads/events/<filename>
        const match = imageUrl.match(/\/uploads\/events\/([^/?#]+)/);
        if (match) {
          const filename = match[1];
          const filePath = path.resolve(process.cwd(), 'uploads', 'events', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      // Delete the event itself
      await models.events.deleteOne({ id: eventId });

      // NOTE: We do NOT delete records from the payments collection.
      // Payment/revenue history must survive event deletion for financial audit trail.
      // This is intentional - payments are linked by eventId/registrationId but represent
      // completed financial transactions that should not be erased.

      res.status(204).send();
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  return router;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createEventRegistrationRouter(models: ModelRegistry) {
  const router = express.Router();
  const permission = [requireAuth, requirePermission(EVENTS_MANAGE_PERMISSION)];

  router.post('/:id/registrations', requireAuth, async (req, res) => {
    try {
      const registration = await registerForEvent(models, String(req.params.id), req.body as LooseDocument);
      res.status(201).json(registration);
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.patch('/:eventId/registrations/:registrationId', requireAuth, async (req, res) => {
    try {
      if (String(req.body?.status || '') !== 'cancelled') {
        throw new EventInputError('Only cancellation is supported by this endpoint.');
      }
      const registration = await cancelEventRegistration(models, String(req.params.eventId), String(req.params.registrationId));
      res.json(registration);
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.get('/:id/registrations', ...permission, async (req, res) => {
    try {
      const eventId = String(req.params.id);
      const event = await models.events.findOne({ id: eventId }).lean<LooseDocument | null>();
      if (!event) return res.status(404).json({ message: 'events not found' });
      const search = String(req.query.search || '').trim();
      const registrationQuery: LooseDocument = { eventId };
      if (search) {
        const escaped = escapeRegExp(search);
        const matchingUsers = await models.users.find({ name: { $regex: escaped, $options: 'i' } }).lean<LooseDocument[]>();
        const matchingUserIds = matchingUsers.map((user) => String(user.id)).filter(Boolean);
        registrationQuery.$or = [
          { id: { $regex: escaped, $options: 'i' } },
          { ticketCode: { $regex: escaped, $options: 'i' } },
          { userId: { $in: matchingUserIds } },
        ];
      }
      const registrations = await models.eventRegistrations.find(registrationQuery).sort({ registrationDate: -1 }).lean<LooseDocument[]>();
      const userIds = registrations.map((registration) => String(registration.userId || '')).filter(Boolean);
      const users = await models.users.find({ id: { $in: userIds } }).lean<LooseDocument[]>();
      const userMap = new Map(users.map((user) => [String(user.id), user]));
      const data: LooseDocument[] = registrations.map((registration): LooseDocument => {
        const user = userMap.get(String(registration.userId));
        const cleanedRegistration = cleanDoc(registration) as LooseDocument;
        return {
          ...cleanedRegistration,
          user: user ? { id: user.id, name: user.name } : null,
        };
      });
      res.json({ event: cleanDoc(event), data, total: data.length });
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.post('/:id/checkin', ...permission, async (req, res) => {
    try {
      const identifier = String(req.body?.registrationId || req.body?.ticketCode || '');
      const registration = await checkInEventRegistration(models, String(req.params.id), identifier);
      const audit = await writeEventAudit(
        models,
        req,
        'event.checkin',
        String(req.params.id),
        `Checked in registration ${registration.id} for event ${req.params.id}.`,
      );
      res.json({ registration, audit });
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  return router;
}

export function createEventAnalyticsRouter(models: ModelRegistry) {
  const router = express.Router();
  const permission = [requireAuth, requirePermission(EVENTS_MANAGE_PERMISSION)];

  router.get('/analytics/summary', ...permission, async (_req, res) => {
    try {
      res.json(await getEventAnalyticsSummary(models));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.get('/:id/analytics', ...permission, async (req, res) => {
    try {
      res.json(await getEventAnalytics(models, String(req.params.id)));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  return router;
}

export function createEventManagementRouter(_models: ModelRegistry) {
  const router = express.Router();
  const permission = [requireAuth, requirePermission(EVENTS_MANAGE_PERMISSION)];

  router.get('/', ...permission, (_req, res) => {
    res.json({ ready: true, permission: EVENTS_MANAGE_PERMISSION });
  });

  return router;
}
