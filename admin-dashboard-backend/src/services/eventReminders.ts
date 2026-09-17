import cron from 'node-cron';
import { ModelRegistry, LooseDocument } from '../models/registry';

let reminderJob: cron.ScheduledTask | null = null;

/**
 * Reminders are tracked per event because delivery is currently a log-only
 * stub and the notifications collection has no established write contract.
 */
export async function processEventReminders(
  models: ModelRegistry,
  now = new Date(),
  log: (message: string) => void = console.log,
): Promise<number> {
  const candidates = await models.events.find({
    'reminderConfig.enabled': true,
    reminderSentAt: null,
  }).lean<LooseDocument[]>();
  let claimed = 0;

  for (const event of candidates) {
    const eventDate = new Date(String(event.date));
    const sendBeforeHours = Number((event.reminderConfig as LooseDocument | undefined)?.sendBeforeHours);
    if (Number.isNaN(eventDate.getTime()) || !Number.isFinite(sendBeforeHours) || sendBeforeHours <= 0) continue;

    const windowEnd = new Date(now.getTime() + sendBeforeHours * 60 * 60 * 1000);
    if (eventDate < now || eventDate > windowEnd) continue;

    const claimedEvent = await models.events.findOneAndUpdate(
      {
        id: event.id,
        'reminderConfig.enabled': true,
        reminderSentAt: null,
      },
      { $set: { reminderSentAt: now } },
      { new: true, lean: true },
    ).lean<LooseDocument | null>();
    if (!claimedEvent) continue;

    claimed++;
    // TODO: connect real delivery (email, push, or notification provider).
    log(`[Event Reminders] Would send reminder for event ${event.id} scheduled at ${eventDate.toISOString()}.`);
  }

  return claimed;
}

/** Start the event reminder job independently from the test DB sync job. */
export function startEventReminderJob(models: ModelRegistry): void {
  if (reminderJob) return;
  reminderJob = cron.schedule('0 * * * *', async () => {
    try {
      const claimed = await processEventReminders(models);
      console.log(`[Event Reminders] Processed ${claimed} reminder(s).`);
    } catch (error) {
      console.error('[Event Reminders] Scheduled run failed:', error);
    }
  });
  console.log('[Event Reminders] Hourly reminder job started.');
}

export function stopEventReminderJob(): void {
  if (!reminderJob) return;
  reminderJob.stop();
  reminderJob = null;
  console.log('[Event Reminders] Hourly reminder job stopped.');
}