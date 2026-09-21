import express from 'express';
import { createId } from '../utils/ids';
import { cleanDoc, cleanDocs } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  TRACKER_CONFIG_MANAGE_PERMISSION,
  TRACKER_ARRAY_RESOURCES,
  TrackerConflictError,
  TrackerInputError,
  TrackerNotFoundError,
  TrackerOptionResource,
  validateMeasurementUnits,
  validateOptionCreate,
  validateOptionUpdates,
  validateTrackerCreate,
  validateTrackerUpdates,
  validateWaterUnits,
  writeTrackerAudit,
} from '../services/trackerConfig';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function statusCode(error: unknown): number {
  return error instanceof TrackerInputError || error instanceof TrackerConflictError || error instanceof TrackerNotFoundError
    ? error.statusCode
    : 500;
}

export function createTrackerConfigRouter(models: ModelRegistry) {
  const router = express.Router();
  const managePermission = [requireAuth, requirePermission(TRACKER_CONFIG_MANAGE_PERMISSION)];
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

  // -- /trackers: parent registry, one document per trackerType ----------
  router.post('/trackers', ...managePermission, async (req, res) => {
    try {
      const payload = validateTrackerCreate(req.body as LooseDocument);
      const clash = await models.trackers.findOne({ trackerType: payload.trackerType }).lean<LooseDocument | null>();
      if (clash) throw new TrackerConflictError(`trackerType '${payload.trackerType}' already exists.`);
      payload.id = createId('tracker');
      payload.createdAt = new Date();
      payload.updatedAt = new Date();
      const created = await models.trackers.create(payload);
      await writeTrackerAudit(models, req, 'trackers.created', 'trackers', String(payload.id), `Created tracker ${payload.id} (${payload.trackerType}).`);
      res.status(201).json(cleanDoc(created));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.get('/trackers', ...readPermission, async (req, res) => {
    try {
      const { filter, limit, page, sortKey, sortDir } = listQuery(req as { query: Record<string, unknown> });
      let query = models.trackers.find(filter).lean<LooseDocument[]>();
      if (sortKey) query = query.sort({ [sortKey]: sortDir } as Record<string, 1 | -1>);
      if (limit) query = query.skip(limit && page > 1 ? (page - 1) * limit : 0).limit(limit);
      res.json(cleanDocs(await query));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/trackers/:id', ...readPermission, async (req, res) => {
    try {
      const doc = await models.trackers.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!doc) return res.status(404).json({ message: 'trackers not found' });
      res.json(cleanDoc(doc));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.patch('/trackers/:id', ...managePermission, async (req, res) => {
    try {
      const existing = await models.trackers.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'trackers not found' });
      const updates = validateTrackerUpdates(req.body as LooseDocument);
      if (updates.trackerType !== undefined && updates.trackerType !== existing.trackerType) {
        const clash = await models.trackers.findOne({ trackerType: updates.trackerType }).lean<LooseDocument | null>();
        if (clash) throw new TrackerConflictError(`trackerType '${updates.trackerType}' already exists.`);
      }
      updates.updatedAt = new Date();
      const updated = await models.trackers
        .findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true, runValidators: true, lean: true })
        .lean<LooseDocument | null>();
      if (!updated) return res.status(404).json({ message: 'trackers not found' });
      await writeTrackerAudit(models, req, 'trackers.updated', 'trackers', String(req.params.id), `Updated tracker ${String(req.params.id)}: ${Object.keys(updates).join(', ')}.`);
      res.json(cleanDoc(updated));
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  router.delete('/trackers/:id', ...managePermission, async (req, res) => {
    try {
      const existing = await models.trackers.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!existing) return res.status(404).json({ message: 'trackers not found' });
      await writeTrackerAudit(models, req, 'trackers.deleted', 'trackers', String(req.params.id), `Deleted tracker ${String(req.params.id)} (${String(existing.trackerType)}).`);
      await models.trackers.deleteOne({ id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(statusCode(error)).json({ message: errorMessage(error) });
    }
  });

  // -- Option lists: habit/mood/symptoms/meds/expense/reminders ----------
  for (const resource of TRACKER_ARRAY_RESOURCES) {
    const model = () => models[resource as keyof ModelRegistry];

    router.post(`/${resource}`, ...managePermission, async (req, res) => {
      try {
        const payload = validateOptionCreate(resource as TrackerOptionResource, req.body as LooseDocument);
        if (resource === 'reminderTemplates') {
          const clash = await model().findOne({ trackerType: payload.trackerType }).lean<LooseDocument | null>();
          if (clash) throw new TrackerConflictError(`reminder template for '${payload.trackerType}' already exists.`);
        }
        payload.id = createId(resource.replace(/s$/, ''));
        payload.createdAt = new Date();
        payload.updatedAt = new Date();
        const created = await model().create(payload);
        await writeTrackerAudit(models, req, `${resource}.created`, resource, String(payload.id), `Created ${resource} ${payload.id}.`);
        res.status(201).json(cleanDoc(created));
      } catch (error) {
        res.status(statusCode(error)).json({ message: errorMessage(error) });
      }
    });

    router.get(`/${resource}`, ...readPermission, async (req, res) => {
      try {
        const { filter, limit, page, sortKey, sortDir } = listQuery(req as { query: Record<string, unknown> });
        let query = model().find(filter).lean<LooseDocument[]>();
        if (sortKey) query = query.sort({ [sortKey]: sortDir } as Record<string, 1 | -1>);
        if (limit) query = query.skip(limit && page > 1 ? (page - 1) * limit : 0).limit(limit);
        res.json(cleanDocs(await query));
      } catch (error) {
        res.status(500).json({ message: errorMessage(error) });
      }
    });

    router.get(`/${resource}/:id`, ...readPermission, async (req, res) => {
      try {
        const doc = await model().findOne({ id: req.params.id }).lean<LooseDocument | null>();
        if (!doc) return res.status(404).json({ message: `${resource} not found` });
        res.json(cleanDoc(doc));
      } catch (error) {
        res.status(500).json({ message: errorMessage(error) });
      }
    });

    router.patch(`/${resource}/:id`, ...managePermission, async (req, res) => {
      try {
        const existing = await model().findOne({ id: req.params.id }).lean<LooseDocument | null>();
        if (!existing) return res.status(404).json({ message: `${resource} not found` });
        const updates = validateOptionUpdates(resource as TrackerOptionResource, req.body as LooseDocument);
        if (resource === 'reminderTemplates' && updates.trackerType !== undefined && updates.trackerType !== existing.trackerType) {
          const clash = await model().findOne({ trackerType: updates.trackerType }).lean<LooseDocument | null>();
          if (clash) throw new TrackerConflictError(`reminder template for '${updates.trackerType}' already exists.`);
        }
        updates.updatedAt = new Date();
        const updated = await model()
          .findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true, runValidators: true, lean: true })
          .lean<LooseDocument | null>();
        if (!updated) return res.status(404).json({ message: `${resource} not found` });
        await writeTrackerAudit(models, req, `${resource}.updated`, resource, String(req.params.id), `Updated ${resource} ${String(req.params.id)}: ${Object.keys(updates).join(', ')}.`);
        res.json(cleanDoc(updated));
      } catch (error) {
        res.status(statusCode(error)).json({ message: errorMessage(error) });
      }
    });

    router.delete(`/${resource}/:id`, ...managePermission, async (req, res) => {
      try {
        const existing = await model().findOne({ id: req.params.id }).lean<LooseDocument | null>();
        if (!existing) return res.status(404).json({ message: `${resource} not found` });
        await writeTrackerAudit(models, req, `${resource}.deleted`, resource, String(req.params.id), `Deleted ${resource} ${String(req.params.id)}.`);
        await model().deleteOne({ id: req.params.id });
        res.status(204).send();
      } catch (error) {
        res.status(statusCode(error)).json({ message: errorMessage(error) });
      }
    });
  }

  // -- Singleton units (metric-only, never multi-doc CRUD) ---------------
  const singletons = [
    { name: 'measurementUnits', validate: validateMeasurementUnits },
    { name: 'waterUnits', validate: validateWaterUnits },
  ] as const;

  for (const { name, validate } of singletons) {
    router.get(`/${name}`, ...readPermission, async (_req, res) => {
      try {
        const doc = await models[name].findOne({ _singleton: name }).lean<LooseDocument | null>();
        if (!doc) return res.status(404).json({ message: `${name} not found` });
        const cleaned = cleanDoc(doc);
        delete cleaned._singleton;
        res.json(cleaned);
      } catch (error) {
        res.status(500).json({ message: errorMessage(error) });
      }
    });

    const upsert = async (req: { body: unknown }, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
      try {
        const updates = validate(req.body as LooseDocument);
        const updated = await models[name].findOneAndUpdate(
          { _singleton: name },
          { $set: updates, $setOnInsert: { _singleton: name } },
          { new: true, upsert: true, runValidators: true, lean: true },
        );
        const cleaned = cleanDoc(updated as LooseDocument);
        delete cleaned._singleton;
        await writeTrackerAudit(models, req as never, `${name}.updated`, name, name, `Updated ${name}: ${Object.keys(updates).join(', ')}.`);
        res.status(200).json(cleaned);
      } catch (error) {
        res.status(statusCode(error)).json({ message: errorMessage(error) });
      }
    };

    router.put(`/${name}`, ...managePermission, upsert);
    router.patch(`/${name}`, ...managePermission, upsert);
  }

  return router;
}



