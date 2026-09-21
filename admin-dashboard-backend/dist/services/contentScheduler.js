"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULER_ACTOR = void 0;
exports.processContentAutoPublish = processContentAutoPublish;
exports.startContentScheduler = startContentScheduler;
exports.stopContentScheduler = stopContentScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const ids_1 = require("../utils/ids");
let autoPublishJob = null;
/** Every CMS content collection that supports scheduled auto-publishing. */
const SCHEDULABLE_RESOURCES = [
    'tips',
    'affirmations',
    'zodiac',
    'banners',
    'journalPrompts',
    'fortuneCookies',
    'communityGuidelines',
    'appAnnouncements',
];
/**
 * Claim marker written ATOMICALLY before an item is published. Same principle
 * as reminderSentAt in eventReminders.ts: once a run has claimed an item, an
 * overlapping run's claim (identical filter) matches nothing, so the same item
 * is never processed twice. The schemas are strict:false, so the marker needs
 * no schema change — mirroring how reminderSentAt lives on event documents.
 */
const CLAIM_FIELD = 'autoPublishClaimAt';
/** Audit attribution for auto-publishes: no human admin is involved. */
exports.SCHEDULER_ACTOR = { id: 'system_scheduler', name: 'Content Scheduler' };
/**
 * Publishes every content item whose scheduledAt has passed while it is still
 * a draft, across all 8 CMS content types.
 *
 * Decisions (documented per spec):
 * - Candidate filter: the CMS status enum is ['draft', 'published', 'archived']
 *   (contentSharedFields in models/registry.ts) — there is no 'scheduled'
 *   status value, so candidates are status:'draft' with a non-null
 *   scheduledAt <= now.
 * - scheduledAt is KEPT as a historical record instead of cleared: the item
 *   leaves the 'draft' filter after publishing, so it can never be picked up
 *   again, and keeping the date preserves when it was meant to go live
 *   (publishedAt records when it actually went live).
 * - Idempotency: atomic findOneAndUpdate claim (CLAIM_FIELD) before publishing.
 *
 * Interval is every 5 minutes — deliberately shorter than the hourly event
 * reminder job, because a scheduled post publishing up to 59 minutes late is
 * poor UX while the scan is 8 cheap indexed queries. It is a separate cron
 * task and does not touch the event reminder or test-DB-sync jobs.
 */
async function processContentAutoPublish(models, now = new Date(), log = console.log) {
    let published = 0;
    for (const resource of SCHEDULABLE_RESOURCES) {
        const model = models[resource];
        const candidates = await model
            .find({ status: 'draft', scheduledAt: { $type: 'date', $lte: now } })
            .lean();
        for (const doc of candidates) {
            // Atomic claim: overlapping runs cannot both match this filter.
            // $type:'date' is required — a bare $ne:null also matches documents
            // where scheduledAt is MISSING entirely, which auto-published an
            // unscheduled malformed draft (tip_005) in the live cron.
            const claimed = await model
                .findOneAndUpdate({
                id: doc.id,
                status: 'draft',
                scheduledAt: { $type: 'date', $lte: now },
                [CLAIM_FIELD]: null,
            }, { $set: { [CLAIM_FIELD]: now } }, { new: true, lean: true })
                .lean();
            if (!claimed)
                continue;
            try {
                const updated = await model
                    .findOneAndUpdate({ id: doc.id, status: 'draft' }, { $set: { status: 'published', publishedAt: now, updatedAt: now } }, { new: true, lean: true })
                    .lean();
                if (!updated)
                    continue;
                await models.auditLogs.create({
                    id: (0, ids_1.createId)('audit'),
                    adminId: exports.SCHEDULER_ACTOR.id,
                    adminName: exports.SCHEDULER_ACTOR.name,
                    action: `${resource}.autoPublished`,
                    target: String(doc.id),
                    description: `Auto-published ${resource} ${String(doc.id)} on its scheduled date.`,
                    createdAt: now,
                    targetType: resource,
                    targetId: String(doc.id),
                    reason: null,
                });
                published += 1;
                log(`[Content Scheduler] Auto-published ${resource} ${String(doc.id)} (scheduled for ${new Date(String(doc.scheduledAt)).toISOString()}).`);
            }
            catch (error) {
                // Release the claim so a later run can retry the failed item.
                await model.updateOne({ id: doc.id, [CLAIM_FIELD]: now }, { $set: { [CLAIM_FIELD]: null } });
                log(`[Content Scheduler] Failed to auto-publish ${resource} ${String(doc.id)}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    return published;
}
/** Start the scheduled auto-publish job independently from the other jobs. */
function startContentScheduler(models) {
    if (autoPublishJob)
        return;
    autoPublishJob = node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            const published = await processContentAutoPublish(models);
            if (published > 0)
                console.log(`[Content Scheduler] Auto-published ${published} scheduled item(s).`);
        }
        catch (error) {
            console.error('[Content Scheduler] Scheduled run failed:', error);
        }
    });
    console.log('[Content Scheduler] Auto-publish job started (every 5 minutes).');
}
function stopContentScheduler() {
    if (!autoPublishJob)
        return;
    autoPublishJob.stop();
    autoPublishJob = null;
    console.log('[Content Scheduler] Auto-publish job stopped.');
}
