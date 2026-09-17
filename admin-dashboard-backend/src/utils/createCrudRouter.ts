import express, { Request } from 'express';
import { Model } from 'mongoose';
import { cleanDoc, cleanDocs } from './clean';
import { createId } from './ids';
import { LooseDocument } from '../models/registry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function buildFilter(query: Request['query']): LooseDocument {
  const filter: LooseDocument = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (['_limit', '_page', '_sort', '_order', '_embed', '_expand'].includes(key)) {
      continue;
    }
    filter[key] = value;
  }

  return filter;
}

export function createCrudRouter(ModelClass: Model<LooseDocument>, resourceName: string) {
  const router = express.Router();
  const shouldHidePasswords = resourceName === 'admins';

  function sanitize<T extends LooseDocument | null>(doc: T): T {
    const cleaned = cleanDoc(doc);
    if (shouldHidePasswords && cleaned) {
      delete cleaned.password;
    }
    return cleaned;
  }

  function sanitizeMany<T extends LooseDocument>(docs: T[]): T[] {
    return docs.map(sanitize);
  }

  // Updated GET handler with pagination and sorting
router.get('/', async (req, res) => {
  try {
    // Build filter excluding special params
    const filter = buildFilter(req.query);

    // Pagination parameters
    const limit = parseInt(req.query._limit as string) || 0;
    const page = parseInt(req.query._page as string) || 1;
    const skip = limit && page > 1 ? (page - 1) * limit : 0;

    // Sorting parameters
    const sortKey = req.query._sort as string | undefined;
    const sortOrder = req.query._order === 'desc' ? -1 : 1;

    let query = ModelClass.find(filter).lean<LooseDocument[]>();
    if (sortKey) {
      // @ts-ignore dynamic sort object
      query = query.sort({ [sortKey]: sortOrder });
    }
    if (limit) {
      query = query.skip(skip).limit(limit);
    }
    const docs = await query;
    res.json(shouldHidePasswords ? sanitizeMany(docs) : cleanDocs(docs));
  } catch (error) {
    res.status(500).json({ message: errorMessage(error) });
  }
});

  router.get('/:id', async (req, res) => {
    try {
      const doc = await ModelClass.findOne({ id: req.params.id }).lean<LooseDocument | null>();
      if (!doc) {
        return res.status(404).json({ message: `${resourceName} not found` });
      }
      res.json(sanitize(doc));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const payload = { ...req.body } as LooseDocument;
      if (!payload.id) {
        payload.id = createId(resourceName.replace(/s$/, ''));
      }

      const created = await ModelClass.create(payload);
      res.status(201).json(sanitize(cleanDoc(created)));
    } catch (error) {
      res.status(400).json({ message: errorMessage(error) });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const payload = { ...req.body, id: req.params.id } as LooseDocument;

      const updated = await ModelClass.findOneAndReplace({ id: req.params.id }, payload, {
        new: true,
        upsert: false,
        lean: true,
      });

      if (!updated) {
        return res.status(404).json({ message: `${resourceName} not found` });
      }

      res.json(sanitize(updated as LooseDocument));
    } catch (error) {
      res.status(400).json({ message: errorMessage(error) });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const updates = { ...(req.body as LooseDocument) };
      delete updates.id;

      const updated = await ModelClass.findOneAndUpdate(
        { id: req.params.id },
        { $set: updates },
        { new: true, lean: true }
      );

      if (!updated) {
        return res.status(404).json({ message: `${resourceName} not found` });
      }

      res.json(sanitize(updated as LooseDocument));
    } catch (error) {
      res.status(400).json({ message: errorMessage(error) });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const deleted = await ModelClass.findOneAndDelete({ id: req.params.id }).lean<LooseDocument | null>();
      if (!deleted) {
        return res.status(404).json({ message: `${resourceName} not found` });
      }
      res.status(200).json(sanitize(deleted));
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  return router;
}
