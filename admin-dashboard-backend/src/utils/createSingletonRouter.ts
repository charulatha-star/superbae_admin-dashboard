import express from 'express';
import { Model } from 'mongoose';
import { cleanDoc } from './clean';
import { LooseDocument } from '../models/registry';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function createSingletonRouter(ModelClass: Model<LooseDocument>, resourceName: string) {
  const router = express.Router();

  async function getSingleton(): Promise<LooseDocument | null> {
    return ModelClass.findOne({ _singleton: resourceName }).lean<LooseDocument | null>();
  }

  router.get('/', async (_req, res) => {
    try {
      const doc = await getSingleton();
      if (!doc) {
        return res.status(404).json({ message: `${resourceName} not found` });
      }
      const cleaned = cleanDoc(doc);
      delete cleaned._singleton;
      res.json(cleaned);
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const payload = { ...req.body, _singleton: resourceName } as LooseDocument;
      const updated = await ModelClass.findOneAndReplace({ _singleton: resourceName }, payload, {
        new: true,
        upsert: true,
        lean: true,
      });

      const cleaned = cleanDoc(updated as LooseDocument);
      delete cleaned._singleton;
      res.json(cleaned);
    } catch (error) {
      res.status(400).json({ message: errorMessage(error) });
    }
  });

  router.patch('/', async (req, res) => {
    try {
      const updates = { ...(req.body as LooseDocument) };
      delete updates._singleton;
      const updated = await ModelClass.findOneAndUpdate(
        { _singleton: resourceName },
        { $set: updates, $setOnInsert: { _singleton: resourceName } },
        { new: true, upsert: true, lean: true }
      );

      const cleaned = cleanDoc(updated as LooseDocument);
      delete cleaned._singleton;
      res.json(cleaned);
    } catch (error) {
      res.status(400).json({ message: errorMessage(error) });
    }
  });

  return router;
}
