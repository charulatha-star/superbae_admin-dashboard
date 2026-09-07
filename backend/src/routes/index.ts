import express, { Express } from 'express';
import { models, ARRAY_RESOURCES, SINGLETON_RESOURCES } from '../models/registry';
import { createCrudRouter } from '../utils/createCrudRouter';
import { createSingletonRouter } from '../utils/createSingletonRouter';
import { cleanDoc } from '../utils/clean';
import { createAuthRouter } from './auth';
import { requireAuth } from '../middleware/auth';

export function registerRoutes(app: Express): void {
  app.use('/auth', createAuthRouter(models));

  // Register health endpoint FIRST (public, no auth required)
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/users/:id/subscription', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;

      // 1. Get main subscription
      const subscription = await models.subscriptions
        .findOne({ userId })
        .lean();

      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      // 2. Get payment history for this user
      const payments = await models.payments
        .find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      // 3. Build response with payment history only
      const response = {
        ...cleanDoc(subscription),
        paymentHistory: payments.length > 0 ? payments : null,
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ message });
    }
  });

  // GET /users/:id/overview - User Profile Overview tab
  app.get('/users/:id/overview', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;

      // 1. Get user from users collection
      const user = await models.users.findOne({ id: userId }).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 2. Get recent activity (last 5 entries, sorted newest first)
      const recentActivity = await models.userActivity
        .find({ userId })
        .sort({ occurredAt: -1 })
        .limit(5)
        .lean();

      // 3. Calculate quick actions based on status
      const status = String(user.status || 'active').toLowerCase();
      const quickActions = {
        canSuspend: status !== 'suspended',
        canBan: status !== 'suspended',
        canActivate: status === 'suspended' || status === 'inactive',
      };

      // 4. Build response
      const response = {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          status: user.status,
          joinedAt: user.joinedAt,
          lastSeen: user.lastSeen,
          plan: user.plan,
        },
        activitySummary: {
          posts: user.posts || 0,
          events: 0, // Placeholder as per requirements
          groups: user.groups || 0,
        },
        recentActivity: recentActivity.map((activity) => ({
          id: activity.id,
          userId: activity.userId,
          action: activity.action,
          occurredAt: activity.occurredAt,
        })),
        quickActions,
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /users/:id/security - User Profile Security tab
  app.get('/users/:id/security', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;

      // 1. Get user from users collection to determine account actions
      const user = await models.users.findOne({ id: userId }).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 2. Get all devices/sessions for this user, sorted by lastActiveAt DESC
      const devices = await models.sessions
        .find({ userId })
        .sort({ lastActiveAt: -1 })
        .lean();

      // 3. Get login history (last 10 entries, sorted by loginAt DESC)
      const loginHistory = await models.loginHistory
        .find({ userId })
        .sort({ loginAt: -1 })
        .limit(10)
        .lean();

      // 4. Build response
      const response = {
        success: true,
        devices: devices.map((session) => ({
          id: session.id,
          userId: session.userId,
          device: session.device,
          ipAddress: session.ipAddress,
          lastActiveAt: session.lastActiveAt,
        })),
        loginHistory: loginHistory.map((login) => ({
          id: login.id,
          userId: login.userId,
          loginAt: login.loginAt,
          device: login.device,
          ipAddress: login.ipAddress,
        })),
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /users/:id/profile - User Profile Profile tab
  app.get('/users/:id/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;

      // Get user from users collection
      const user = await models.users.findOne({ id: userId }).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate profile completion based on About Me fields only
      // Fields: bio, interests, thingsILove, zodiac (4 total)
      const totalFields = 4;
      let filledCount = 0;

      // Count filled fields (non-null for bio/zodiac, non-empty array for interests/thingsILove)
      if (user.bio != null) filledCount++;
      if (Array.isArray(user.interests) && user.interests.length > 0) filledCount++;
      if (Array.isArray(user.thingsILove) && user.thingsILove.length > 0) filledCount++;
      if (user.zodiac != null) filledCount++;

      const profileCompletion = Math.round((filledCount / totalFields) * 100);

      // Build response
      const response = {
        success: true,
        basic: {
          name: user.name,
          phone: user.phone,
          status: user.status,
          joinedAt: user.joinedAt,
        },
        about: {
          bio: user.bio,
          interests: user.interests || [],
          thingsILove: user.thingsILove || [],
          zodiac: user.zodiac,
        },
        profileCompletion,
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  /*
  // GET /users/:id/content - User Profile Content tab
  app.get('/users/:id/content', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
      }

      // Fetch all content in parallel
      const [
        posts,
        comments,
        reports
      ] = await Promise.all([
        // Posts by this user
        models.posts
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        // Comments by this user
        models.comments
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        // Reports where this user is the content author (userId)
        models.safetyReports
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      // Filtered views from posts
      const drafts = posts.filter(p => p.status === 'draft');

      // Get total counts for pagination metadata
      const [
        totalPosts,
        totalComments,
        totalReports
      ] = await Promise.all([
        models.posts.countDocuments({ userId }),
        models.comments.countDocuments({ userId }),
        models.safetyReports.countDocuments({ userId }),
      ]);

      // Clean documents
      const clean = (doc: any) => {
        if (!doc) return null;
        const cleaned: Record<string, unknown> = { ...doc };
        delete cleaned._id;
        delete cleaned.__v;
        return cleaned;
      };

      const response = {
        success: true,
        pagination: {
          page,
          limit,
          skip,
        },
        posts: {
          data: posts.map(clean),
          total: totalPosts,
          pages: Math.ceil(totalPosts / limit),
        },
        comments: {
          data: comments.map(clean),
          total: totalComments,
          pages: Math.ceil(totalComments / limit),
        },
        drafts: {
          data: drafts.map(clean),
          total: drafts.length,
          pages: 1, // Filtered from posts, so no additional pagination needed
        },
        reports: {
          data: reports.map(clean),
          total: totalReports,
          pages: Math.ceil(totalReports / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });
  */

  // GET /users/:id/events - User Profile Events tab
  app.get('/users/:id/events', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
      }

      // Fetch user's event registrations with populated event data
      const registrations: any[] = await models.eventRegistrations
        .find({ userId })
        .sort({ registrationDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Get all event IDs for this user's registrations
      const eventIds: string[] = registrations.map((r: any) => r.eventId as string).filter(Boolean);

      // Fetch corresponding events
      const events: any[] = await models.events
        .find({ id: { $in: eventIds } })
        .lean();

      // Create a map for quick lookup
      const eventMap: Record<string, any> = {};
      events.forEach(e => {
        eventMap[e.id as string] = e;
      });

      // Get all registrations for count (without pagination)
      const allRegistrations: any[] = await models.eventRegistrations
        .find({ userId })
        .lean();

      // Get event payments for this user
      const eventPayments = await models.payments
        .find({ userId, paymentType: 'event' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalEventPayments = await models.payments.countDocuments({ userId, paymentType: 'event' });

      // Clean documents
      const clean = (doc: any) => {
        if (!doc) return null;
        const cleaned: Record<string, unknown> = { ...doc };
        delete cleaned._id;
        delete cleaned.__v;
        return cleaned;
      };

      // Categorize registrations
      const attended: any[] = [];

      allRegistrations.forEach((reg: any) => {
        const eventId = reg.eventId as string;
        const event = eventMap[eventId];
        if (!event) return;

        const regWithEvent = { ...clean(reg), event: clean(event) };

        if (reg.status === 'attended') {
          attended.push(regWithEvent);
        }
      });

      // For paginated response, add event data to each registration
      const registrationsWithEvents = registrations.map((reg: any) => {
        const eventId = reg.eventId as string;
        return { ...clean(reg), event: clean(eventMap[eventId]) };
      });

      const response = {
        success: true,
        pagination: {
          page,
          limit,
          skip,
        },
        registered: {
          data: registrationsWithEvents,
          total: allRegistrations.length,
          pages: Math.ceil(allRegistrations.length / limit),
        },
        attended: {
          data: attended.slice(0, limit),
          total: attended.length,
          pages: Math.ceil(attended.length / limit),
        },
        payments: {
          data: eventPayments.map(clean),
          total: totalEventPayments,
          pages: Math.ceil(totalEventPayments / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /users/:id/community - User Profile Community tab
  app.get('/users/:id/community', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
      }

      // Clean documents helper
      const clean = (doc: any) => {
        if (!doc) return null;
        const cleaned: Record<string, unknown> = { ...doc };
        delete cleaned._id;
        delete cleaned.__v;
        return cleaned;
      };

      // 1. Get user's groups (memberships with groupId)
      const groupMemberships: any[] = await models.memberships
        .find({ userId, groupId: { $ne: null } })
        .sort({ joinedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalGroupMemberships = await models.memberships.countDocuments({ userId, groupId: { $ne: null } });

      // Get group details for these memberships
      const groupIdsFromMemberships = groupMemberships.map(m => m.groupId as string).filter(Boolean);
      const groups = await models.groups.find({ id: { $in: groupIdsFromMemberships } }).lean();
      const groupMap: Record<string, any> = {};
      groups.forEach(g => { groupMap[g.id as string] = g; });

      const groupsData = groupMemberships.map(m => {
        const group = clean(groupMap[m.groupId as string]);
        return {
          id: m.id,
          name: group?.name ?? null,
          description: group?.description ?? null,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          groupId: m.groupId,
        };
      });

      // 2. Get user's clubs (memberships with clubId)
      const clubMemberships: any[] = await models.memberships
        .find({ userId, clubId: { $ne: null } })
        .sort({ joinedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalClubMemberships = await models.memberships.countDocuments({ userId, clubId: { $ne: null } });

      // Get club details for these memberships
      const clubIdsFromMemberships = clubMemberships.map(m => m.clubId as string).filter(Boolean);
      const clubs = await models.clubs.find({ id: { $in: clubIdsFromMemberships } }).lean();
      const clubMap: Record<string, any> = {};
      clubs.forEach(c => { clubMap[c.id as string] = c; });

      const clubsData = clubMemberships.map(m => {
        const club = clean(clubMap[m.clubId as string]);
        return {
          id: m.id,
          name: club?.name ?? null,
          description: club?.description ?? null,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          clubId: m.clubId,
        };
      });

      const response = {
        success: true,
        pagination: {
          page,
          limit,
          skip,
        },
        groups: {
          data: groupsData,
          total: totalGroupMemberships,
          pages: Math.ceil(totalGroupMemberships / limit),
        },
        clubs: {
          data: clubsData,
          total: totalClubMemberships,
          pages: Math.ceil(totalClubMemberships / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /users/:id/personal - User Profile Personal tab
  app.get('/users/:id/personal', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
      }

      // Clean documents helper
      const clean = (doc: any) => {
        if (!doc) return null;
        const cleaned: Record<string, unknown> = { ...doc };
        delete cleaned._id;
        delete cleaned.__v;
        return cleaned;
      };

      // Fetch all personal data in parallel
      const [
        goals,
        bucketList,
        memories,
        myCircle,
        lifeTimeline,
        fits,
      ] = await Promise.all([
        models.goals
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.bucketList
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.memories
          .find({ userId })
          .sort({ date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.myCircle
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.lifeTimeline
          .find({ userId })
          .sort({ eventDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.fits
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      // Get total counts for pagination
      const [
        totalGoals,
        totalBucketList,
        totalMemories,
        totalMyCircle,
        totalLifeTimeline,
        totalFits,
      ] = await Promise.all([
        models.goals.countDocuments({ userId }),
        models.bucketList.countDocuments({ userId }),
        models.memories.countDocuments({ userId }),
        models.myCircle.countDocuments({ userId }),
        models.lifeTimeline.countDocuments({ userId }),
        models.fits.countDocuments({ userId }),
      ]);

      const response = {
        success: true,
        pagination: {
          page,
          limit,
          skip,
        },
        goals: {
          data: goals.map(clean),
          total: totalGoals,
          pages: Math.ceil(totalGoals / limit),
        },
        bucketList: {
          data: bucketList.map(clean),
          total: totalBucketList,
          pages: Math.ceil(totalBucketList / limit),
        },
        memories: {
          data: memories.map(clean),
          total: totalMemories,
          pages: Math.ceil(totalMemories / limit),
        },
        myCircle: {
          data: myCircle.map(clean),
          total: totalMyCircle,
          pages: Math.ceil(totalMyCircle / limit),
        },
        lifeTimeline: {
          data: lifeTimeline.map(clean),
          total: totalLifeTimeline,
          pages: Math.ceil(totalLifeTimeline / limit),
        },
        fits: {
          data: fits.map(clean),
          total: totalFits,
          pages: Math.ceil(totalFits / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /users/:id/activity - User Profile Activity tab
  app.get('/users/:id/activity', requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
      }

      // Clean documents helper
      const clean = (doc: any) => {
        if (!doc) return null;
        const cleaned: Record<string, unknown> = { ...doc };
        delete cleaned._id;
        delete cleaned.__v;
        return cleaned;
      };

      // 1. allActivity: reuse userActivity (full paginated list)
      const [allActivity, totalAllActivity] = await Promise.all([
        models.userActivity
          .find({ userId })
          .sort({ occurredAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.userActivity.countDocuments({ userId }),
      ]);

      // 2. timeline: reuse lifeTimeline (from Personal tab)
      const [timeline, totalTimeline] = await Promise.all([
        models.lifeTimeline
          .find({ userId })
          .sort({ eventDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.lifeTimeline.countDocuments({ userId }),
      ]);

      // 3. goalActivity: filter userActivity by goal-related actions
      const goalRelatedActions = [
        'goal_created',
        'goal_updated',
        'goal_deleted',
        'goal_completed',
        'goal_abandoned',
        'goal_progress_updated',
      ];

      const [goalActivity, totalGoalActivity] = await Promise.all([
        models.userActivity
          .find({ userId, action: { $in: goalRelatedActions } })
          .sort({ occurredAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.userActivity.countDocuments({ userId, action: { $in: goalRelatedActions } }),
      ]);

      // 4. journalActivity: new placeholder collection
      const [journalActivity, totalJournalActivity] = await Promise.all([
        models.journalActivity
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.journalActivity.countDocuments({ userId }),
      ]);

      // 5. trackerActivity: new placeholder collection
      const [trackerActivity, totalTrackerActivity] = await Promise.all([
        models.trackerActivity
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.trackerActivity.countDocuments({ userId }),
      ]);

      // 6. featureUsage: new placeholder collection
      const [featureUsage, totalFeatureUsage] = await Promise.all([
        models.featureUsage
          .find({ userId })
          .sort({ lastUsedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        models.featureUsage.countDocuments({ userId }),
      ]);

      const response = {
        success: true,
        pagination: {
          page,
          limit,
          skip,
        },
        allActivity: {
          data: allActivity.map(clean),
          total: totalAllActivity,
          pages: Math.ceil(totalAllActivity / limit),
        },
        timeline: {
          data: timeline.map(clean),
          total: totalTimeline,
          pages: Math.ceil(totalTimeline / limit),
        },
        goalActivity: {
          data: goalActivity.map(clean),
          total: totalGoalActivity,
          pages: Math.ceil(totalGoalActivity / limit),
        },
        journalActivity: {
          data: journalActivity.map(clean),
          total: totalJournalActivity,
          pages: Math.ceil(totalJournalActivity / limit),
        },
        trackerActivity: {
          data: trackerActivity.map(clean),
          total: totalTrackerActivity,
          pages: Math.ceil(totalTrackerActivity / limit),
        },
        featureUsage: {
          data: featureUsage.map(clean),
          total: totalFeatureUsage,
          pages: Math.ceil(totalFeatureUsage / limit),
        },
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // GET /community/stats - Community Dashboard Statistics
  app.get('/community/stats', requireAuth, async (req, res) => {
    try {
      const [
        totalPosts,
        totalComments,
        reportedPosts,
        reportedComments,
        anonymousPosts,
        activeGroups,
        moderationQueue,
        blockedUsers,
      ] = await Promise.all([
        models.posts.countDocuments({ status: { $ne: 'archived' } }),
        models.comments.countDocuments({ status: 'active' }),
        models.safetyReports.countDocuments({ status: 'pending', reportId: { $regex: /^post_/ } }),
        models.safetyReports.countDocuments({ status: 'pending', reportId: { $regex: /^comment_/ } }),
        models.posts.countDocuments({ isAnonymous: true }),
        models.groups.countDocuments({ status: 'active' }),
        models.safetyModeration.countDocuments({ status: 'pending' }),
        models.users.countDocuments({ status: 'suspended' }),
      ]);

      res.json({
        success: true,
        stats: {
          totalPosts,
          totalComments,
          reportedPosts,
          reportedComments,
          anonymousPosts,
          activeGroups,
          moderationQueue,
          blockedUsers,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  // POST /community/moderate - Moderation actions
  app.post('/community/moderate', requireAuth, async (req, res) => {
    try {
      const { type, id, action, reason } = req.body;
      
      if (!type || !id || !action) {
        return res.status(400).json({ message: 'Missing required fields: type, id, action' });
      }

      // Handle Posts Moderation
      if (type === 'post') {
        const post = await models.posts.findOne({ id });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        
        let newStatus = post.status;
        if (action === 'approve') newStatus = 'published';
        if (action === 'hide') newStatus = 'draft';
        if (action === 'remove') newStatus = 'archived';
        if (action === 'restore') newStatus = 'published';
        
        await models.posts.findOneAndUpdate({ id }, { status: newStatus });
      }
      
      // Handle Comments Moderation
      else if (type === 'comment') {
        const comment = await models.comments.findOne({ id });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });
        
        let newStatus = comment.status;
        if (action === 'approve' || action === 'restore') newStatus = 'active';
        if (action === 'hide' || action === 'remove') newStatus = 'deleted';
        
        await models.comments.findOneAndUpdate({ id }, { status: newStatus });
      }
      
      // Handle User Moderation
      else if (type === 'user') {
        const user = await models.users.findOne({ id });
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        let newStatus = user.status;
        if (action === 'suspend' || action === 'ban') newStatus = 'suspended';
        if (action === 'restore') newStatus = 'active';
        
        await models.users.findOneAndUpdate({ id }, { status: newStatus });
      }
      
      // Log moderation action
      await models.userActivity.create({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: req.body.adminId || 'admin',
        action: `moderation_${type}_${action}`,
        occurredAt: new Date(),
      });

      res.json({ success: true, message: `Action ${action} applied to ${type} ${id}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      res.status(500).json({ success: false, message });
    }
  });

  for (const resource of ARRAY_RESOURCES) {
    app.use(`/${resource}`, requireAuth, createCrudRouter(models[resource], resource));
  }

  for (const resource of SINGLETON_RESOURCES) {
    app.use(`/${resource}`, requireAuth, createSingletonRouter(models[resource], resource));
  }
}
