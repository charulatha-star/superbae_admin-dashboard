"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnonymousModerationRouter = createAnonymousModerationRouter;
const express_1 = __importDefault(require("express"));
const ids_1 = require("../utils/ids");
const clean_1 = require("../utils/clean");
const auth_1 = require("../middleware/auth");
const userModeration_1 = require("../services/userModeration");
const PERMISSION = 'COMMUNITY_MODERATE';
const ACTIONS = ['hide', 'remove', 'warn', 'suspend', 'ban', 'restore'];
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Unexpected error';
}
function queryNumber(value, fallback, maximum) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}
function buildReportFilter(postId) {
    return { $or: [{ contentId: postId }, { postId }, { anonymousPostId: postId }] };
}
function actorName(req) {
    return typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin';
}
async function writeAudit(models, req, action, targetType, targetId, reason) {
    const adminId = typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown';
    const adminName = actorName(req);
    return models.auditLogs.create({
        id: (0, ids_1.createId)('audit'),
        adminId,
        adminName,
        action,
        target: targetId,
        description: `${action} ${targetType} ${targetId}${reason ? `: ${reason}` : ''}`,
        createdAt: new Date(),
        targetType,
        targetId,
        reason,
    }).then((doc) => (0, clean_1.cleanDoc)(doc));
}
function createAnonymousModerationRouter(models) {
    const router = express_1.default.Router();
    const permission = [auth_1.requireAuth, (0, auth_1.requirePermission)(PERMISSION)];
    router.get('/anonymousPosts', ...permission, async (req, res) => {
        try {
            const filter = {};
            const queue = String(req.query.filter || 'all');
            const search = String(req.query.search || '').trim();
            if (queue === 'reported')
                filter.reportCount = { $gt: 0 };
            if (queue === 'flagged')
                filter.status = { $in: ['flagged', 'pending'] };
            if (queue === 'removed')
                filter.status = 'removed';
            if (queue === 'hidden')
                filter.status = 'hidden';
            if (search)
                filter.content = { $regex: search, $options: 'i' };
            const page = queryNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
            const limit = queryNumber(req.query.limit, 25, 100);
            const skip = (page - 1) * limit;
            const [posts, total] = await Promise.all([
                models.anonymousPosts.find(filter).sort({ riskScore: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
                models.anonymousPosts.countDocuments(filter),
            ]);
            res.json({ data: (0, clean_1.cleanDocs)(posts), total, page, limit, pages: Math.ceil(total / limit) });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.get('/anonymousPosts/:id', ...permission, async (req, res) => {
        try {
            const postId = String(req.params.id);
            const post = await models.anonymousPosts.findOne({ id: postId }).lean();
            if (!post)
                return res.status(404).json({ message: 'anonymousPosts not found' });
            const authorId = typeof post.realAuthorId === 'string' ? post.realAuthorId : '';
            const [reports, aiFlags, author, moderationLog] = await Promise.all([
                models.safetyReports.find(buildReportFilter(postId)).sort({ createdAt: -1 }).lean(),
                models.safetyModeration.find({ $or: [{ contentId: postId }, { postId }] }).sort({ createdAt: -1 }).lean(),
                authorId ? models.users.findOne({ id: authorId }).lean() : null,
                models.auditLogs.find({ targetType: 'anonymousPost', targetId: postId }).sort({ createdAt: -1 }).lean(),
            ]);
            const authorActions = authorId
                ? await models.auditLogs.find({ targetType: 'user', targetId: authorId, action: { $in: ['warn', 'suspend', 'ban'] } }).lean()
                : [];
            res.json({
                post: (0, clean_1.cleanDoc)(post),
                reports: (0, clean_1.cleanDocs)(reports),
                aiFlags: (0, clean_1.cleanDocs)(aiFlags),
                authorAbuseSummary: author ? { userId: authorId, strikeCount: authorActions.length, status: author.status } : null,
                moderationLog: (0, clean_1.cleanDocs)(moderationLog),
            });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.post('/anonymousPosts/:id/action', ...permission, async (req, res) => {
        try {
            const postId = String(req.params.id);
            const action = String(req.body?.action || '');
            const reason = req.body?.reason == null ? null : String(req.body.reason).trim();
            if (!ACTIONS.includes(action))
                return res.status(400).json({ message: 'Invalid moderation action.' });
            if (!reason && ['remove', 'suspend', 'ban'].includes(action)) {
                return res.status(400).json({ message: 'reason is required for this action.' });
            }
            const post = await models.anonymousPosts.findOne({ id: postId }).lean();
            if (!post)
                return res.status(404).json({ message: 'anonymousPosts not found' });
            const statusByAction = {
                hide: 'hidden', remove: 'removed', restore: 'approved', warn: 'warned', suspend: 'removed', ban: 'removed',
            };
            const updatedPost = await models.anonymousPosts.findOneAndUpdate({ id: postId }, { $set: { status: statusByAction[action], updatedAt: new Date() } }, { new: true, lean: true }).lean();
            const authorId = typeof post.realAuthorId === 'string' ? post.realAuthorId : '';
            if (['warn', 'suspend', 'ban'].includes(action)) {
                if (!authorId)
                    return res.status(400).json({ message: 'This post has no realAuthorId.' });
                const user = await (0, userModeration_1.applyUserModerationAction)(models, authorId, action);
                if (!user)
                    return res.status(404).json({ message: 'Author not found.' });
                await writeAudit(models, req, action, 'user', authorId, reason);
            }
            const audit = await writeAudit(models, req, action, 'anonymousPost', postId, reason);
            res.json({ post: (0, clean_1.cleanDoc)(updatedPost), audit });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.get('/anonymousModerationHistory', ...permission, async (req, res) => {
        try {
            const filter = { targetType: 'anonymousPost' };
            for (const key of ['action', 'targetId', 'adminId']) {
                if (req.query[key])
                    filter[key] = String(req.query[key]);
            }
            const page = queryNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
            const limit = queryNumber(req.query.limit, 25, 100);
            const [logs, total] = await Promise.all([
                models.auditLogs.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
                models.auditLogs.countDocuments(filter),
            ]);
            res.json({ data: (0, clean_1.cleanDocs)(logs), total, page, limit, pages: Math.ceil(total / limit) });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    router.get('/users/:id/abuse-history', ...permission, async (req, res) => {
        try {
            const actions = await models.auditLogs.find({ targetType: 'user', targetId: req.params.id, action: { $in: ['warn', 'suspend', 'ban'] } }).sort({ createdAt: -1 }).lean();
            res.json({ userId: req.params.id, strikeCount: actions.length, actions: (0, clean_1.cleanDocs)(actions) });
        }
        catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    });
    return router;
}
