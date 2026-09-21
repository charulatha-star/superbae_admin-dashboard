import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';

/**
 * Additive, idempotent permission seeding (same safety model as seedTrackers.ts).
 *
 * Guarantees:
 *  - creates TRACKER_CONFIG_MANAGE only when the id is absent (never overwrites);
 *  - never deletes anything (no deleteMany / deleteOne anywhere);
 *  - does not touch any other permission document or any tracker data;
 *  - roles holding the '*' wildcard (including role_super_admin) are left
 *    exactly as they are, because '*' already grants every permission.
 *
 * Mirrors the injection block in seed.ts (lines 138-199) but WITHOUT the
 * destructive wipe/reinsert flow that seed.ts performs.
 */

const TRACKER_CONFIG_MANAGE: LooseDocument = {
  id: 'TRACKER_CONFIG_MANAGE',
  module: 'trackers',
  resource: 'trackers',
  action: 'manage',
};

async function seedPermissions(): Promise<void> {
  await connectDB();
  console.log('Seeding permissions (idempotent, add-only)...');

  // -- 1. Permission document ------------------------------------------------
  const existing = await models.permissions
    .findOne({ id: TRACKER_CONFIG_MANAGE.id })
    .lean<LooseDocument | null>();

  if (existing) {
    console.log(`${String(TRACKER_CONFIG_MANAGE.id)}: already present, skipping (no overwrite).`);
  } else {
    try {
      await models.permissions.create(TRACKER_CONFIG_MANAGE);
      console.log(`${String(TRACKER_CONFIG_MANAGE.id)}: created.`);
    } catch (err: unknown) {
      // 11000 = duplicate key: another run created it concurrently. Safe to ignore.
      if ((err as { code?: number })?.code === 11000) {
        console.log(`${String(TRACKER_CONFIG_MANAGE.id)}: already present (duplicate key), skipping.`);
      } else {
        throw err;
      }
    }
  }

  // -- 2. Roles: only grant where the permission model expects it ------------
  // Same condition as seed.ts: a role qualifies when it is the super admin role
  // or already carries '*'. Roles that already hold '*' are skipped so the
  // wildcard behaviour is completely unchanged.
  const roles = await models.roles.find({}).lean<LooseDocument[]>();
  let granted = 0;
  let wildcardUntouched = 0;
  for (const role of roles) {
    const isSuperAdmin = role.id === 'role_super_admin';
    const permissions = Array.isArray(role.permissions) ? role.permissions.map(String) : [];
    const qualifies = isSuperAdmin || permissions.includes('*');
    if (!qualifies) continue;
    if (permissions.includes('*')) {
      wildcardUntouched++;
      continue; // '*' already grants the new permission — do not write.
    }
    if (permissions.includes(String(TRACKER_CONFIG_MANAGE.id))) {
      console.log(`role ${String(role.id)}: permission already present, skipping.`);
      continue;
    }
    // $addToSet is idempotent and cannot duplicate an existing entry.
    await models.roles.updateOne(
      { id: role.id },
      { $addToSet: { permissions: String(TRACKER_CONFIG_MANAGE.id) } }
    );
    granted++;
    console.log(`role ${String(role.id)}: granted ${String(TRACKER_CONFIG_MANAGE.id)}.`);
  }
  console.log(`roles: ${granted} updated, ${wildcardUntouched} left unchanged ('*' wildcard).`);

  // -- 3. Verification ------------------------------------------------------
  const permCount = await models.permissions
    .countDocuments({ id: TRACKER_CONFIG_MANAGE.id });
  console.log(`VERIFY ${String(TRACKER_CONFIG_MANAGE.id)} exists: ${permCount === 1 ? 'yes' : 'NO'}`);
  console.log(`VERIFY duplicate permission documents: ${permCount > 1 ? permCount : 0}`);
  const trackerCount = await models.trackers.countDocuments();
  console.log(`VERIFY trackers untouched: ${trackerCount} document(s).`);
  console.log('=== Permission seeding complete ===');

  await mongoose.disconnect();
}

seedPermissions().catch((error: unknown) => {
  console.error('Permission seed failed:', error);
  process.exit(1);
});
