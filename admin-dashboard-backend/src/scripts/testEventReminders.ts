import 'dotenv/config';

import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { processEventReminders, startEventReminderJob, stopEventReminderJob } from '../services/eventReminders';

async function testEventReminders(): Promise<void> {
  await connectDB();

  const suffix = randomUUID();
  const ids = {
    inWindowEnabled: `test_reminder_in_window_${suffix}`,
    disabled: `test_reminder_disabled_${suffix}`,
    outsideWindow: `test_reminder_outside_${suffix}`,
    alreadySent: `test_reminder_sent_${suffix}`,
    pastEvent: `test_reminder_past_${suffix}`,
  };

  try {
    await models.events.create([
      { id: ids.inWindowEnabled, title: 'In Window', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
      { id: ids.disabled, title: 'Disabled', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: false, sendBeforeHours: 24 }, reminderSentAt: null },
      { id: ids.outsideWindow, title: 'Outside', type: 'online', date: new Date(Date.now() + 48 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
      { id: ids.alreadySent, title: 'Sent', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: new Date(Date.now() - 1000) },
      { id: ids.pastEvent, title: 'Past', type: 'online', date: new Date(Date.now() - 12 * 60 * 60 * 1000), status: 'completed', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
    ]);

    const now = new Date();
    const firstRun = await processEventReminders(models, now);
    if (firstRun !== 1) throw new Error(`Expected 1 reminder on first run, got ${firstRun}.`);

    const sentEvent = await models.events.findOne({ id: ids.inWindowEnabled }).lean();
    if (!sentEvent?.reminderSentAt) throw new Error('Expected in-window event to be marked as reminded.');

    const secondRun = await processEventReminders(models, now);
    if (secondRun !== 0) throw new Error(`Expected 0 reminders on second run, got ${secondRun}.`);

    const disabledEvent = await models.events.findOne({ id: ids.disabled }).lean();
    if (disabledEvent?.reminderSentAt) throw new Error('Expected disabled event to remain unmarked.');

    const outsideEvent = await models.events.findOne({ id: ids.outsideWindow }).lean();
    if (outsideEvent?.reminderSentAt) throw new Error('Expected outside-window event to remain unmarked.');

    const pastEvent = await models.events.findOne({ id: ids.pastEvent }).lean();
    if (pastEvent?.reminderSentAt) throw new Error('Expected past event to remain unmarked.');

    const alreadySentEvent = await models.events.findOne({ id: ids.alreadySent }).lean();
    if (!alreadySentEvent?.reminderSentAt) throw new Error('Expected already-sent event to keep its original reminderSentAt.');

    const logs: string[] = [];
    const customRun = await processEventReminders(models, new Date(), (message) => logs.push(message));
    if (customRun !== 0) throw new Error(`Expected 0 reminders on custom-log run, got ${customRun}.`);

    startEventReminderJob(models);
    await new Promise((resolve) => setTimeout(resolve, 100));
    stopEventReminderJob();

    console.log('Event reminders Phase 8 test passed.');
  } finally {
    await Promise.all([
      models.events.deleteMany({ id: { $in: [ids.inWindowEnabled, ids.disabled, ids.outsideWindow, ids.alreadySent, ids.pastEvent] } }),
    ]);
    await mongoose.disconnect();
  }
}

testEventReminders().catch((error: unknown) => {
  console.error('Event reminders Phase 8 test failed:', error);
  process.exitCode = 1;
});
