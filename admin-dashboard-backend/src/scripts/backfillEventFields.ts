import 'dotenv/config';

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';

const DEFAULT_CAPACITY = 100;
const CAPACITY_BUFFER = 10;

function positiveNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function backfillEventFields(): Promise<void> {
  await connectDB();

  const events = await models.events.find({}).lean<LooseDocument[]>();
  let updated = 0;

  for (const event of events) {
    const eventId = typeof event.id === 'string' ? event.id : '';
    if (!eventId) continue;

    const updates: LooseDocument = {};
    const currentCapacity = positiveNumber(event.capacity);
    if (currentCapacity === null) {
      const attendees = positiveNumber(event.attendees) || 0;
      updates.capacity = Math.max(DEFAULT_CAPACITY, Math.floor(attendees) + CAPACITY_BUFFER);
    }

    const attendedCount = await models.eventRegistrations.countDocuments({ eventId, status: 'attended' });
    const activeRegistrationCount = await models.eventRegistrations.countDocuments({ eventId, status: { $ne: 'cancelled' } });
    const existingCheckedInCount = typeof event.checkedInCount === 'number' && Number.isInteger(event.checkedInCount)
      ? event.checkedInCount
      : null;
    if (existingCheckedInCount !== attendedCount) updates.checkedInCount = attendedCount;

    if (event.reminderSentAt !== null && !(event.reminderSentAt instanceof Date) && event.reminderSentAt !== undefined) {
      updates.reminderSentAt = null;
    }

    const existingRegisteredCount = typeof event.registeredCount === 'number' && Number.isInteger(event.registeredCount)
      ? event.registeredCount
      : null;
    if (existingRegisteredCount !== activeRegistrationCount) updates.registeredCount = activeRegistrationCount;

    const reminderConfig = event.reminderConfig;
    if (!reminderConfig || typeof reminderConfig !== 'object') {
      updates.reminderConfig = { enabled: false, sendBeforeHours: 24 };
    } else {
      const config = reminderConfig as Record<string, unknown>;
      const reminderUpdates: LooseDocument = {};
      if (typeof config.enabled !== 'boolean') reminderUpdates.enabled = false;
      if (positiveNumber(config.sendBeforeHours) === null) reminderUpdates.sendBeforeHours = 24;
      if (Object.keys(reminderUpdates).length > 0) updates.reminderConfig = { ...config, ...reminderUpdates };
    }

    if (Object.keys(updates).length === 0) continue;

    await models.events.updateOne({ id: eventId }, { $set: updates });
    updated++;
    console.log(`Backfilled event ${eventId}: ${Object.keys(updates).join(', ')}`);
  }

  console.log(`Event field backfill complete. Updated ${updated} of ${events.length} events.`);
}

backfillEventFields()
  .catch((error: unknown) => {
    console.error('Event field backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
