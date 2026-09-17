import 'dotenv/config';

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';

/**
 * Backfill script for banners collection to add the new 'type' field.
 *
 * Ensures all existing banner documents have type: 'banner' set.
 * Safe to re-run: only updates documents where type is missing.
 *
 * Usage: npx tsx src/scripts/backfillBannersType.ts
 * DO NOT import or run automatically
 */

async function backfillBannersType(): Promise<void> {
  await connectDB();

  console.log('Banners type field backfill starting...\n');

  const collection = models.banners;
  if (!collection) {
    console.error('No model for resource "banners", aborting.');
    process.exit(1);
  }

  const docs = await collection.find({}).lean<LooseDocument[]>();
  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const docId = typeof doc.id === 'string' ? doc.id : String(doc._id || 'unknown');

    if (doc.type === undefined) {
      await collection.updateOne({ id: docId }, { $set: { type: 'banner' } });
      updated++;
      console.log(`  banners ${docId}: backfilled type = 'banner'`);
    } else {
      skipped++;
    }
  }

  console.log(`\nBanners: ${updated} updated, ${skipped} already had type field.`);
  console.log('=== Banners type backfill complete ===');

  await mongoose.disconnect();
  process.exit(0);
}

backfillBannersType()
  .catch((error: unknown) => {
    console.error('Banners type backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });