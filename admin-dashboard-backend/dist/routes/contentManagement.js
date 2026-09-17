"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_PUBLISH_PERMISSION = exports.CONTENT_MANAGE_PERMISSION = void 0;
exports.createContentManagementRouter = createContentManagementRouter;
const express_1 = __importDefault(require("express"));
const ids_1 = require("../utils/ids");
const clean_1 = require("../utils/clean");
const auth_1 = require("../middleware/auth");
exports.CONTENT_MANAGE_PERMISSION = 'CONTENT_MANAGE';
exports.CONTENT_PUBLISH_PERMISSION = 'CONTENT_PUBLISH';
const CONTENT_RESOURCES = [
    'tips',
    'affirmations',
    'zodiac',
    'banners',
    'journalPrompts',
    'fortuneCookies',
    'communityGuidelines',
    'appAnnouncements',
];
const REQUIRED_FIELDS = {
    tips: ['title', 'body', 'subtype'],
    affirmations: ['text'],
    zodiac: ['sign', 'date'],
    banners: ['title'],
    journalPrompts: ['text'],
    fortuneCookies: ['text'],
    communityGuidelines: ['title', 'body'],
    appAnnouncements: ['title', 'body'],
};
const STATUS_ENUM = ['draft', 'published', 'archived'];
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Unexpected error';
}
const STATUS_FIELD = 'status';
const DEFAULT_CREATE_STATUS = 'draft';
/**
 * Publishing state is owned by CONTENT_PUBLISH, which is deliberately a
 * different permission from CONTENT_MANAGE. This guard rejects requests that
 * try to set `status` without CONTENT_PUBLISH with an explicit 403 (never a
 * silent field drop, so the caller knows the field was refused).
 *
 * `allowDefaultStatus` is used by the create route: creating with the default
 * `draft` status is ordinary content management, while creating something that
 * is already published/archived is a publishing action.
 */
function requirePublishForStatusChange(options = {}) {
    return async (req, res, next) => {
        try {
            const body = (req.body ?? {});
            if (!Object.prototype.hasOwnProperty.call(body, STATUS_FIELD)) {
                next();
                return;
            }
            if (options.allowDefaultStatus) {
                const requested = String(body[STATUS_FIELD] ?? '').trim().toLowerCase();
                if (!requested || requested === DEFAULT_CREATE_STATUS) {
                    next();
                    return;
                }
            }
            if (await (0, auth_1.hasPermission)(req, exports.CONTENT_PUBLISH_PERMISSION)) {
                next();
                return;
            }
            res.status(403).json({
                message: `Forbidden: ${exports.CONTENT_PUBLISH_PERMISSION} permission required to change status.`,
            });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    };
}
function validateRequiredFields(resource, payload) {
    const required = REQUIRED_FIELDS[resource];
    for (const field of required) {
        const value = payload[field];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
            throw new Error(`${field} is required for ${resource}.`);
        }
    }
}
function validateStatus(status) {
    const s = String(status ?? '').trim().toLowerCase();
    if (!STATUS_ENUM.includes(s)) {
        throw new Error(`Invalid status: must be one of ${STATUS_ENUM.join(', ')}.`);
    }
    return s;
}
function validateSubtype(resource, subtype) {
    if (resource === 'tips') {
        const s = String(subtype ?? '').trim().toLowerCase();
        if (!['relationship', 'wellness'].includes(s)) {
            throw new Error(`tips subtype must be 'relationship' or 'wellness'.`);
        }
        return s;
    }
    return null;
}
function validateSeverity(severity) {
    if (severity === undefined || severity === null)
        return 'info';
    const s = String(severity).trim().toLowerCase();
    if (!['info', 'warning', 'critical'].includes(s)) {
        throw new Error(`severity must be one of: info, warning, critical.`);
    }
    return s;
}
function validateOrder(order) {
    if (order === undefined || order === null)
        return 0;
    const n = Number(order);
    if (!Number.isInteger(n) || n < 0) {
        throw new Error('order must be a non-negative integer.');
    }
    return n;
}
async function writeContentAudit(models, req, action, resource, contentId, description) {
    const adminId = typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown';
    const adminName = typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin';
    try {
        const result = await models.auditLogs.create({
            id: (0, ids_1.createId)('audit'),
            adminId,
            adminName,
            action,
            target: contentId,
            description,
            createdAt: new Date(),
            targetType: resource,
            targetId: contentId,
            reason: null,
        });
        return (0, clean_1.cleanDoc)(result);
    }
    catch (e) {
        console.error(`[CONTENT AUDIT] Failed to write audit entry for ${action}:`, e);
        throw e;
    }
}
function buildCreatePayload(resource, input) {
    const payload = { ...input };
    payload.id = (0, ids_1.createId)(resource.replace(/s$/, ''));
    if (!payload.status)
        payload.status = 'draft';
    if (!payload.isFeatured)
        payload.isFeatured = false;
    if (!payload.authorId)
        payload.authorId = null;
    if (!payload.scheduledAt)
        payload.scheduledAt = null;
    if (!payload.publishedAt)
        payload.publishedAt = null;
    payload.createdAt = new Date();
    payload.updatedAt = new Date();
    // Resource-specific defaults
    if (resource === 'tips') {
        if (!payload.views)
            payload.views = 0;
        if (!payload.category)
            payload.category = null;
    }
    if (resource === 'affirmations') {
        if (!payload.category)
            payload.category = null;
    }
    if (resource === 'zodiac') {
        if (!payload.horoscope)
            payload.horoscope = null;
        if (!payload.love)
            payload.love = null;
        if (!payload.career)
            payload.career = null;
    }
    if (resource === 'banners') {
        if (!payload.type)
            payload.type = 'banner';
        if (!payload.placement)
            payload.placement = null;
        if (!payload.startDate)
            payload.startDate = null;
        if (!payload.endDate)
            payload.endDate = null;
        if (!payload.clicks)
            payload.clicks = 0;
        if (!payload.impressions)
            payload.impressions = 0;
    }
    if (resource === 'journalPrompts') {
        if (!payload.category)
            payload.category = null;
    }
    if (resource === 'fortuneCookies') {
        if (!payload.category)
            payload.category = null;
    }
    if (resource === 'communityGuidelines') {
        payload.order = validateOrder(payload.order);
    }
    if (resource === 'appAnnouncements') {
        payload.severity = validateSeverity(payload.severity);
    }
    return payload;
}
function buildUpdatePayload(resource, input) {
    const updates = { ...input };
    delete updates.id;
    delete updates.createdAt;
    updates.updatedAt = new Date();
    if (resource === 'tips' && updates.subtype !== undefined) {
        validateSubtype(resource, updates.subtype);
    }
    if (resource === 'communityGuidelines' && updates.order !== undefined) {
        updates.order = validateOrder(updates.order);
    }
    if (resource === 'appAnnouncements' && updates.severity !== undefined) {
        updates.severity = validateSeverity(updates.severity);
    }
    return updates;
}
function createContentManagementRouter(models) {
    const router = express_1.default.Router();
    const managePermission = [auth_1.requireAuth, (0, auth_1.requirePermission)(exports.CONTENT_MANAGE_PERMISSION)];
    const publishPermission = [auth_1.requireAuth, (0, auth_1.requirePermission)(exports.CONTENT_PUBLISH_PERMISSION)];
    const readPermission = [auth_1.requireAuth];
    // POST /{resource} - Create content
    for (const resource of CONTENT_RESOURCES) {
        router.post(`/${resource}`, ...managePermission, requirePublishForStatusChange({ allowDefaultStatus: true }), async (req, res) => {
            try {
                validateRequiredFields(resource, req.body);
                if (resource === 'tips' && req.body.subtype !== undefined) {
                    validateSubtype(resource, req.body.subtype);
                }
                if (resource === 'communityGuidelines' && req.body.order !== undefined) {
                    validateOrder(req.body.order);
                }
                if (resource === 'appAnnouncements' && req.body.severity !== undefined) {
                    validateSeverity(req.body.severity);
                }
                const payload = buildCreatePayload(resource, req.body);
                const model = models[resource];
                const created = await model.create(payload);
                await writeContentAudit(models, req, `${resource}.created`, resource, String(payload.id), `Created ${resource} ${payload.id}.`);
                res.status(201).json((0, clean_1.cleanDoc)(created));
            }
            catch (error) {
                res.status(400).json({ message: errorMessage(error) });
            }
        });
        // GET /{resource} - List (read-only, requireAuth only)
        router.get(`/${resource}`, ...readPermission, async (req, res) => {
            try {
                const filter = {};
                for (const [key, value] of Object.entries(req.query)) {
                    if (value === undefined || value === null || value === '')
                        continue;
                    if (['_limit', '_page', '_sort', '_order', '_embed', '_expand', 'page', 'limit', 'search'].includes(key)) {
                        continue;
                    }
                    filter[key] = value;
                }
                const limit = parseInt(req.query._limit) || parseInt(req.query.limit) || 0;
                const page = parseInt(req.query._page) || parseInt(req.query.page) || 1;
                const skip = limit && page > 1 ? (page - 1) * limit : 0;
                const sortKey = req.query._sort;
                const sortOrder = req.query._order === 'desc' ? -1 : 1;
                const model = models[resource];
                let query = model.find(filter).lean();
                if (sortKey) {
                    // @ts-ignore dynamic sort object
                    query = query.sort({ [sortKey]: sortOrder });
                }
                if (limit) {
                    query = query.skip(skip).limit(limit);
                }
                const docs = await query;
                res.json((0, clean_1.cleanDocs)(docs));
            }
            catch (error) {
                res.status(500).json({ message: errorMessage(error) });
            }
        });
        // GET /{resource}/:id - Detail (read-only, requireAuth only)
        router.get(`/${resource}/:id`, ...readPermission, async (req, res) => {
            try {
                const model = models[resource];
                const doc = await model.findOne({ id: req.params.id }).lean();
                if (!doc) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                res.json((0, clean_1.cleanDoc)(doc));
            }
            catch (error) {
                res.status(500).json({ message: errorMessage(error) });
            }
        });
        // PATCH /{resource}/:id - Edit content
        // Setting `status` here requires CONTENT_PUBLISH; without it the request is
        // refused with 403 instead of having the field silently ignored.
        router.patch(`/${resource}/:id`, ...managePermission, requirePublishForStatusChange(), async (req, res) => {
            try {
                const model = models[resource];
                const existing = await model.findOne({ id: req.params.id }).lean();
                if (!existing) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                const updates = buildUpdatePayload(resource, req.body);
                if (Object.keys(updates).length === 0) {
                    return res.status(400).json({ message: 'At least one field is required to update.' });
                }
                const updated = await model.findOneAndUpdate({ id: req.params.id }, { $set: updates }, { new: true, runValidators: true, lean: true }).lean();
                if (!updated) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                await writeContentAudit(models, req, `${resource}.updated`, resource, String(req.params.id), `Updated ${resource} ${String(req.params.id)}: ${Object.keys(updates).join(', ')}.`);
                res.json((0, clean_1.cleanDoc)(updated));
            }
            catch (error) {
                res.status(400).json({ message: errorMessage(error) });
            }
        });
        // DELETE /{resource}/:id - Delete content
        router.delete(`/${resource}/:id`, ...managePermission, async (req, res) => {
            try {
                const model = models[resource];
                const existing = await model.findOne({ id: req.params.id }).lean();
                if (!existing) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                // Write audit log BEFORE deletion
                const title = String(existing.title || existing.text || 'Untitled');
                await writeContentAudit(models, req, `${resource}.deleted`, resource, String(req.params.id), `Deleted ${resource} ${String(req.params.id)} (${title}).`);
                await model.deleteOne({ id: req.params.id });
                res.status(204).send();
            }
            catch (error) {
                res.status(500).json({ message: errorMessage(error) });
            }
        });
        // POST /{resource}/:id/publish - Publish content
        router.post(`/${resource}/:id/publish`, ...publishPermission, async (req, res) => {
            try {
                const model = models[resource];
                const existing = await model.findOne({ id: req.params.id }).lean();
                if (!existing) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                const currentStatus = String(existing.status || 'draft');
                if (currentStatus === 'published') {
                    return res.status(400).json({ message: 'Already published.' });
                }
                const publishedAt = new Date();
                const updated = await model.findOneAndUpdate({ id: req.params.id }, { $set: { status: 'published', publishedAt, updatedAt: publishedAt } }, { new: true, lean: true }).lean();
                if (!updated) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                await writeContentAudit(models, req, `${resource}.published`, resource, String(req.params.id), `Published ${resource} ${String(req.params.id)}.`);
                res.json((0, clean_1.cleanDoc)(updated));
            }
            catch (error) {
                res.status(400).json({ message: errorMessage(error) });
            }
        });
        // POST /{resource}/:id/unpublish - Unpublish content (sets to 'archived')
        router.post(`/${resource}/:id/unpublish`, ...publishPermission, async (req, res) => {
            try {
                const model = models[resource];
                const existing = await model.findOne({ id: req.params.id }).lean();
                if (!existing) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                const currentStatus = String(existing.status || 'draft');
                if (currentStatus === 'archived') {
                    return res.status(400).json({ message: 'Already archived.' });
                }
                const unpublishedAt = new Date();
                const updated = await model.findOneAndUpdate({ id: req.params.id }, { $set: { status: 'archived', updatedAt: unpublishedAt } }, { new: true, lean: true }).lean();
                if (!updated) {
                    return res.status(404).json({ message: `${resource} not found` });
                }
                await writeContentAudit(models, req, `${resource}.unpublished`, resource, String(req.params.id), `Unpublished ${resource} ${String(req.params.id)} (status -> archived).`);
                res.json((0, clean_1.cleanDoc)(updated));
            }
            catch (error) {
                res.status(400).json({ message: errorMessage(error) });
            }
        });
    }
    return router;
}
