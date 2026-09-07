import express, { Request } from 'express';
import { createId } from '../utils/ids';
import { cleanDoc, cleanDocs } from '../utils/clean';
import { LooseDocument, ModelRegistry } from '../models/registry';
import { requireAuth, requirePermission } from '../middleware/auth';
import { applyUserModerationAction, UserModerationAction } from '../services/userModeration';

const PERMISSION = 'COMMUNITY_MODERATE';
const ACTIONS = ['hide', 'remove', 'warn', 'suspend', 'ban', 'restore'] as const;
type PostAction = (typeof ACTIONS)[number];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function queryNumber(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function buildReportFilter(postId: string): LooseDocument {
  return { $or: [{ contentId: postId }, { postId }, { anonymousPostId: postId }] };
}

function actorName(req: Request): string {
  return typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin';
}

async function writeAudit(
  models: ModelRegistry,
  req: Request,
  action: string,
  targetType: string,
  targetId: string,
  reason: string | null,
): Promise<LooseDocument> {
  const adminId = typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown';
  const adminName = actorName(req);
  return models.auditLogs.create({
    id: createId('audit'),
    adminId,
    adminName,
    action,
    target: targetId,
    description: `${action} ${targetType} ${targetId}${reason ? `: ${reason}` : ''}`,
    createdAt: new Date(),
    targetType,
    targetId,
    reason,
  }).then((doc) => cleanDoc(doc));
}

export function createAnonymousModerationRouter(models: ModelRegistry) {
  const router = express.Router();
  const permission = [requireAuth, requirePermission(PERMISSION)];

  router.get('/anonymousPosts', ...permission, async (req, res) => {
    try {
      const filter: LooseDocument = {};
      const queue = String(req.query.filter || 'all');
      const search = String(req.query.search || '').trim();
      if (queue === 'reported') filter.reportCount = { $gt: 0 };
      if (queue === 'flagged') filter.status = { $in: ['flagged', 'pending'] };
      if (queue === 'removed') filter.status = 'removed';
      if (queue === 'hidden') filter.status = 'hidden';
      if (search) filter.content = { $regex: search, $options: 'i' };

      const page = queryNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const limit = queryNumber(req.query.limit, 25, 100);
      const skip = (page - 1) * limit;
      const [posts, total] = await Promise.all([
        models.anonymousPosts.find(filter).sort({ riskScore: -1, createdAt: -1 }).skip(skip).limit(limit).lean<LooseDocument[]>(),
        models.anonymousPosts.countDocuments(filter),
      ]);
      res.json({ data: cleanDocs(posts), total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/anonymousPosts/:id', ...permission, async (req, res) => {
    try {
      const postId = String(req.params.id);
      const post = await models.anonymousPosts.findOne({ id: postId }).lean<LooseDocument | null>();
      if (!post) return res.status(404).json({ message: 'anonymousPosts not found' });
      const authorId = typeof post.realAuthorId === 'string' ? post.realAuthorId : '';
      const [reports, aiFlags, author, moderationLog] = await Promise.all([
        models.safetyReports.find(buildReportFilter(postId)).sort({ createdAt: -1 }).lean<LooseDocument[]>(),
        models.safetyModeration.find({ $or: [{ contentId: postId }, { postId }] }).sort({ createdAt: -1 }).lean<LooseDocument[]>(),
        authorId ? models.users.findOne({ id: authorId }).lean<LooseDocument | null>() : null,
        models.auditLogs.find({ targetType: 'anonymousPost', targetId: postId }).sort({ createdAt: -1 }).lean<LooseDocument[]>(),
      ]);
      const authorActions = authorId
        ? await models.auditLogs.find({ targetType: 'user', targetId: authorId, action: { $in: ['warn', 'suspend', 'ban'] } }).lean<LooseDocument[]>()
        : [];
      res.json({
        post: cleanDoc(post),
        reports: cleanDocs(reports),
        aiFlags: cleanDocs(aiFlags),
        authorAbuseSummary: author ? { userId: authorId, strikeCount: authorActions.length, status: author.status } : null,
        moderationLog: cleanDocs(moderationLog),
      });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.post('/anonymousPosts/:id/action', ...permission, async (req, res) => {
    try {
      const postId = String(req.params.id);
      const action = String(req.body?.action || '') as PostAction;
      const reason = req.body?.reason == null ? null : String(req.body.reason).trim();
      if (!ACTIONS.includes(action)) return res.status(400).json({ message: 'Invalid moderation action.' });
      if (!reason && ['remove', 'suspend', 'ban'].includes(action)) {
        return res.status(400).json({ message: 'reason is required for this action.' });
      }
      const post = await models.anonymousPosts.findOne({ id: postId }).lean<LooseDocument | null>();
      if (!post) return res.status(404).json({ message: 'anonymousPosts not found' });
      const statusByAction: Record<PostAction, string> = {
        hide: 'hidden', remove: 'removed', restore: 'approved', warn: 'warned', suspend: 'removed', ban: 'removed',
      };
      const updatedPost = await models.anonymousPosts.findOneAndUpdate(
        { id: postId },
        { $set: { status: statusByAction[action], updatedAt: new Date() } },
        { new: true, lean: true },
      ).lean<LooseDocument | null>();
      const authorId = typeof post.realAuthorId === 'string' ? post.realAuthorId : '';
      if (['warn', 'suspend', 'ban'].includes(action)) {
        if (!authorId) return res.status(400).json({ message: 'This post has no realAuthorId.' });
        const user = await applyUserModerationAction(models, authorId, action as UserModerationAction);
        if (!user) return res.status(404).json({ message: 'Author not found.' });
        await writeAudit(models, req, action, 'user', authorId, reason);
      }
      const audit = await writeAudit(models, req, action, 'anonymousPost', postId, reason);
      res.json({ post: cleanDoc(updatedPost), audit });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/anonymousModerationHistory', ...permission, async (req, res) => {
    try {
      const filter: LooseDocument = { targetType: 'anonymousPost' };
      for (const key of ['action', 'targetId', 'adminId']) {
        if (req.query[key]) filter[key] = String(req.query[key]);
      }
      const page = queryNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const limit = queryNumber(req.query.limit, 25, 100);
      const [logs, total] = await Promise.all([
        models.auditLogs.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<LooseDocument[]>(),
        models.auditLogs.countDocuments(filter),
      ]);
      res.json({ data: cleanDocs(logs), total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  router.get('/users/:id/abuse-history', ...permission, async (req, res) => {
    try {
      const actions = await models.auditLogs.find({ targetType: 'user', targetId: req.params.id, action: { $in: ['warn', 'suspend', 'ban'] } }).sort({ createdAt: -1 }).lean<LooseDocument[]>();
      res.json({ userId: req.params.id, strikeCount: actions.length, actions: cleanDocs(actions) });
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  });

  return router;
}