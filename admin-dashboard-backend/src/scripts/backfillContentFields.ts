import 'dotenv/config';

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';

/**
 * Backfill script for CMS content collections.
 *
 * Ensures all documents in affirmations, zodiac, tips, banners,
 * and journalPrompts have the new shared fields (status, isFeatured,
 * authorId, scheduledAt, publishedAt, createdAt, updatedAt) and
 * the tips subtype field, set to safe defaults.
 *
 * Safe to re-run: only updates documents where a field is missing.
 *
 * Usage: npx tsx src/scripts/backfillContentFields.ts
 * DO NOT import or run automatically
 */

const CONTENT_RESOURCES = ['affirmations', 'zodiac', 'tips', 'banners', 'journalPrompts'] as const;

const STATUS_DEFAULT = 'published';
const FIELD_DEFAULTS: Record<string, unknown> = {
  isFeatured: false,
  authorId: null,
  scheduledAt: null,
  publishedAt: null,
};

/**
 * Decide the subtype for a tips document based on its existing category field.
 * Returns 'relationship' | 'wellness', and whether it was inferrable.
 */
function inferTipSubtype(doc: LooseDocument): { subtype: 'relationship' | 'wellness'; source: 'inferred' | 'default' } {
  const category = typeof doc.category === 'string' ? doc.category.toLowerCase() : '';

  if (category.includes('relationship') || category.includes('romance') || category.includes('partner') || category.includes('date')) {
    return { subtype: 'relationship', source: 'inferred' };
  }

  if (category.includes('wellness') || category.includes('health') || category.includes('fitness') || category.includes('mental')) {
    return { subtype: 'wellness', source: 'inferred' };
  }

  // No category or unrecognized — default to 'wellness' (matches the UI label
  // "Wellness Tips" on the existing Tips page) but flag for manual review.
  return { subtype: 'wellness', source: 'default' };
}

async function backfillResource(resource: string): Promise<void> {
  const collection = models[resource as keyof typeof models];
  if (!collection) {
    console.error(`- No model for resource '${resource}', skipping.`);
    return;
  }

  const docs = await collection.find({}).lean<LooseDocument[]>();
  let updated = 0;
  let skipped = 0;
  let tipsDefaulted = 0;
  let tipsInferred = 0;

  for (const doc of docs) {
    const docId = typeof doc.id === 'string' ? doc.id : String(doc._id || 'unknown');
    const updates: LooseDocument = {};

    // status → 'published' if missing
    if (doc.status == null || doc.status === undefined) {
      updates.status = STATUS_DEFAULT;
    }

    // Default values for optional shared fields
    for (const [field, value] of Object.entries(FIELD_DEFAULTS)) {
      if (doc[field as keyof LooseDocument] === undefined) {
        updates[field as keyof LooseDocument] = value;
      }
    }

    // Timestamps: preserve existing createdAt, set updatedAt to now if missing
    if (doc.createdAt === undefined) {
      updates.createdAt = new Date();
    }
    if (doc.updatedAt === undefined) {
      updates.updatedAt = new Date();
    }

    // Tips subtype
    if (resource === 'tips') {
      if (doc.subtype === undefined) {
        const { subtype, source } = inferTipSubtype(doc);
        updates.subtype = subtype;
        if (source === 'inferred') {
          tipsInferred++;
        } else {
          tipsDefaulted++;
        }
        console.log(`  tips ${docId}: subtype defaulted to '${subtype}' (category='${doc.category || '(none)'}') — REVIEW NEEDED`);
      }
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    await collection.updateOne({ id: docId }, { $set: updates });
    updated++;
    console.log(`  ${resource} ${docId}: backfilled ${Object.keys(updates).join(', ')}`);
  }

  console.log(`  ${resource}: ${updated} updated, ${skipped} already had all fields.`);
  if (resource === 'tips' && tipsDefaulted > 0) {
    console.log(`  NOTE: ${tipsDefaulted} tips had subtype set to 'wellness' by default (category was empty or unrecognizable). Review the logs above for details.`);
  }
  if (resource === 'tips' && tipsInferred > 0) {
    console.log(`  ${tipsInferred} tips had subtype inferred from category field.`);
  }
}

async function backfillContentFields(): Promise<void> {
  await connectDB();

  console.log('Content field backfill starting...');
  console.log(`Target collections: ${CONTENT_RESOURCES.join(', ')}\n`);

  for (const resource of CONTENT_RESOURCES) {
    console.log(`\n--- ${resource} ---`);
    await backfillResource(resource);
  }

  console.log('\n=== Content field backfill complete ===');
  process.exit(0);
}

backfillContentFields()
  .catch((error: unknown) => {
    console.error('Content field backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
