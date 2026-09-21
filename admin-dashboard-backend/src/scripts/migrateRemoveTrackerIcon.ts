/**
 * One-off migration: remove the obsolete `icon` field from Tracker Configuration
 * documents.
 *
 * Background: the Icon field was removed from the Tracker Configuration module
 * (schemas, validation, seed data, admin UI) as an unused field. Documents created
 * before that change still carry a stored `icon` key — schemas are strict:false, so
 * the key is tolerated but is dead data. This script unsets it.
 *
 * Safety:
 *  - Dry-run by default; pass --confirm to apply.
 *  - Touches ONLY the tracker configuration collections listed below, and ONLY
 *    documents that actually contain an `icon` key.
 *  - Uses $unset (field removal) via updateMany — never deletes documents,
 *    never uses deleteMany, never recreates records.
 *  - Idempotent: re-running matches 0 documents.
 *  - Writes one best-effort audit entry (legacy shape) when applied.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';

const COLLECTIONS = [
  'trackers',
  'habitTemplates',
  'moodOptions',
  'symptoms',
  'periodSymptoms',
  'medications',
  'expenseCategories',
] as const;

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection failed');

  console.log(`Tracker icon cleanup — mode: ${CONFIRM ? 'APPLY (--confirm)' : 'DRY RUN'}`);

  const filter = { icon: { $exists: true } };
  const matched: Record<string, number> = {};
  let total = 0;
  for (const name of COLLECTIONS) {
    matched[name] = await db.collection(name).countDocuments(filter);
    total += matched[name];
    console.log(`  ${name.padEnd(20)} documents_with_icon=${matched[name]}`);
  }
  console.log(`TOTAL documents with stored icon: ${total}`);

  if (!CONFIRM) {
    console.log('Dry run only — no changes made. Re-run with --confirm to apply.');
    await mongoose.disconnect();
    return;
  }
  if (total === 0) {
    console.log('Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  let unsetTotal = 0;
  for (const name of COLLECTIONS) {
    if (matched[name] === 0) continue;
    const res = await db.collection(name).updateMany(filter, { $unset: { icon: '' } });
    unsetTotal += res.modifiedCount;
    console.log(`  ${name.padEnd(20)} icon unset on ${res.modifiedCount} document(s)`);
  }

  let remaining = 0;
  for (const name of COLLECTIONS) remaining += await db.collection(name).countDocuments(filter);
  console.log(`VERIFY remaining documents with icon: ${remaining}`);

  try {
    await db.collection('auditLogs').insertOne({
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      adminId: 'system_migration',
      adminName: 'Icon Cleanup Migration (one-off)',
      action: 'trackers.iconFieldRemoved',
      target: 'tracker-configuration',
      targetType: 'trackers',
      targetId: 'tracker-configuration',
      description: `Removed obsolete icon field from ${unsetTotal} tracker configuration document(s).`,
      reason: null,
      createdAt: new Date(),
    });
    console.log('AUDIT: trackers.iconFieldRemoved written');
  } catch (e) {
    console.log(`AUDIT: skipped (${(e as Error).message})`);
  }

  if (remaining !== 0) {
    console.error('VERIFICATION FAILED');
    process.exitCode = 1;
  } else {
    console.log('VERIFICATION PASSED');
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
