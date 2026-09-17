"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEventReminders = processEventReminders;
exports.startEventReminderJob = startEventReminderJob;
exports.stopEventReminderJob = stopEventReminderJob;
const node_cron_1 = __importDefault(require("node-cron"));
let reminderJob = null;
/**
 * Reminders are tracked per event because delivery is currently a log-only
 * stub and the notifications collection has no established write contract.
 */
async function processEventReminders(models, now = new Date(), log = console.log) {
    const candidates = await models.events.find({
        'reminderConfig.enabled': true,
        reminderSentAt: null,
    }).lean();
    let claimed = 0;
    for (const event of candidates) {
        const eventDate = new Date(String(event.date));
        const sendBeforeHours = Number(event.reminderConfig?.sendBeforeHours);
        if (Number.isNaN(eventDate.getTime()) || !Number.isFinite(sendBeforeHours) || sendBeforeHours <= 0)
            continue;
        const windowEnd = new Date(now.getTime() + sendBeforeHours * 60 * 60 * 1000);
        if (eventDate < now || eventDate > windowEnd)
            continue;
        const claimedEvent = await models.events.findOneAndUpdate({
            id: event.id,
            'reminderConfig.enabled': true,
            reminderSentAt: null,
        }, { $set: { reminderSentAt: now } }, { new: true, lean: true }).lean();
        if (!claimedEvent)
            continue;
        claimed++;
        // TODO: connect real delivery (email, push, or notification provider).
        log(`[Event Reminders] Would send reminder for event ${event.id} scheduled at ${eventDate.toISOString()}.`);
    }
    return claimed;
}
/** Start the event reminder job independently from the test DB sync job. */
function startEventReminderJob(models) {
    if (reminderJob)
        return;
    reminderJob = node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const claimed = await processEventReminders(models);
            console.log(`[Event Reminders] Processed ${claimed} reminder(s).`);
        }
        catch (error) {
            console.error('[Event Reminders] Scheduled run failed:', error);
        }
    });
    console.log('[Event Reminders] Hourly reminder job started.');
}
function stopEventReminderJob() {
    if (!reminderJob)
        return;
    reminderJob.stop();
    reminderJob = null;
    console.log('[Event Reminders] Hourly reminder job stopped.');
}
