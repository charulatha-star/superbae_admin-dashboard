"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const registry_1 = require("../models/registry");
const createCrudRouter_1 = require("../utils/createCrudRouter");
const createSingletonRouter_1 = require("../utils/createSingletonRouter");
const clean_1 = require("../utils/clean");
const auth_1 = require("./auth");
const anonymousModeration_1 = require("./anonymousModeration");
const auth_2 = require("../middleware/auth");
function registerRoutes(app) {
    app.use('/auth', (0, auth_1.createAuthRouter)(registry_1.models));
    // Register health endpoint FIRST (public, no auth required)
    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });
    app.use((0, anonymousModeration_1.createAnonymousModerationRouter)(registry_1.models));
    app.get('/users/:id/subscription', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            // 1. Get main subscription
            const subscription = await registry_1.models.subscriptions
                .findOne({ userId })
                .lean();
            if (!subscription) {
                return res.status(404).json({ message: 'Subscription not found' });
            }
            // 2. Get payment history for this user
            const payments = await registry_1.models.payments
                .find({ userId })
                .sort({ createdAt: -1 })
                .lean();
            // 3. Build response with payment history only
            const response = {
                ...(0, clean_1.cleanDoc)(subscription),
                paymentHistory: payments.length > 0 ? payments : null,
            };
            res.json(response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ message });
        }
    });
    // GET /users/:id/overview - User Profile Overview tab
    app.get('/users/:id/overview', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            // 1. Get user from users collection
            const user = await registry_1.models.users.findOne({ id: userId }).lean();
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // 2. Get recent activity (last 5 entries, sorted newest first)
            const recentActivity = await registry_1.models.userActivity
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    // GET /users/:id/security - User Profile Security tab
    app.get('/users/:id/security', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            // 1. Get user from users collection to determine account actions
            const user = await registry_1.models.users.findOne({ id: userId }).lean();
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // 2. Get all devices/sessions for this user, sorted by lastActiveAt DESC
            const devices = await registry_1.models.sessions
                .find({ userId })
                .sort({ lastActiveAt: -1 })
                .lean();
            // 3. Get login history (last 10 entries, sorted by loginAt DESC)
            const loginHistory = await registry_1.models.loginHistory
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    // GET /users/:id/profile - User Profile Profile tab
    app.get('/users/:id/profile', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            // Get user from users collection
            const user = await registry_1.models.users.findOne({ id: userId }).lean();
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // Calculate profile completion based on About Me fields only
            // Fields: bio, interests, thingsILove, zodiac (4 total)
            const totalFields = 4;
            let filledCount = 0;
            // Count filled fields (non-null for bio/zodiac, non-empty array for interests/thingsILove)
            if (user.bio != null)
                filledCount++;
            if (Array.isArray(user.interests) && user.interests.length > 0)
                filledCount++;
            if (Array.isArray(user.thingsILove) && user.thingsILove.length > 0)
                filledCount++;
            if (user.zodiac != null)
                filledCount++;
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
        }
        catch (error) {
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
    app.get('/users/:id/events', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            // Validate pagination params
            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
            }
            // Fetch user's event registrations with populated event data
            const registrations = await registry_1.models.eventRegistrations
                .find({ userId })
                .sort({ registrationDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            // Get all event IDs for this user's registrations
            const eventIds = registrations.map((r) => r.eventId).filter(Boolean);
            // Fetch corresponding events
            const events = await registry_1.models.events
                .find({ id: { $in: eventIds } })
                .lean();
            // Create a map for quick lookup
            const eventMap = {};
            events.forEach(e => {
                eventMap[e.id] = e;
            });
            // Get all registrations for count (without pagination)
            const allRegistrations = await registry_1.models.eventRegistrations
                .find({ userId })
                .lean();
            // Get event payments for this user
            const eventPayments = await registry_1.models.payments
                .find({ userId, paymentType: 'event' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            const totalEventPayments = await registry_1.models.payments.countDocuments({ userId, paymentType: 'event' });
            // Clean documents
            const clean = (doc) => {
                if (!doc)
                    return null;
                const cleaned = { ...doc };
                delete cleaned._id;
                delete cleaned.__v;
                return cleaned;
            };
            // Categorize registrations
            const attended = [];
            allRegistrations.forEach((reg) => {
                const eventId = reg.eventId;
                const event = eventMap[eventId];
                if (!event)
                    return;
                const regWithEvent = { ...clean(reg), event: clean(event) };
                if (reg.status === 'attended') {
                    attended.push(regWithEvent);
                }
            });
            // For paginated response, add event data to each registration
            const registrationsWithEvents = registrations.map((reg) => {
                const eventId = reg.eventId;
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    // GET /users/:id/community - User Profile Community tab
    app.get('/users/:id/community', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            // Validate pagination params
            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
            }
            // Clean documents helper
            const clean = (doc) => {
                if (!doc)
                    return null;
                const cleaned = { ...doc };
                delete cleaned._id;
                delete cleaned.__v;
                return cleaned;
            };
            // 1. Get user's groups (memberships with groupId)
            const groupMemberships = await registry_1.models.memberships
                .find({ userId, groupId: { $ne: null } })
                .sort({ joinedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            const totalGroupMemberships = await registry_1.models.memberships.countDocuments({ userId, groupId: { $ne: null } });
            // Get group details for these memberships
            const groupIdsFromMemberships = groupMemberships.map(m => m.groupId).filter(Boolean);
            const groups = await registry_1.models.groups.find({ id: { $in: groupIdsFromMemberships } }).lean();
            const groupMap = {};
            groups.forEach(g => { groupMap[g.id] = g; });
            const groupsData = groupMemberships.map(m => {
                const group = clean(groupMap[m.groupId]);
                return {
                    id: m.id,
                    name: group?.name ?? null,
                    description: group?.description ?? null,
                    role: m.role,
                    status: m.status,
                    joinedAt: m.joinedAt,
                };
            });
            // 2. Get user's clubs (memberships with clubId)
            const clubMemberships = await registry_1.models.memberships
                .find({ userId, clubId: { $ne: null } })
                .sort({ joinedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            const totalClubMemberships = await registry_1.models.memberships.countDocuments({ userId, clubId: { $ne: null } });
            // Get club details for these memberships
            const clubIdsFromMemberships = clubMemberships.map(m => m.clubId).filter(Boolean);
            const clubs = await registry_1.models.clubs.find({ id: { $in: clubIdsFromMemberships } }).lean();
            const clubMap = {};
            clubs.forEach(c => { clubMap[c.id] = c; });
            const clubsData = clubMemberships.map(m => {
                const club = clean(clubMap[m.clubId]);
                return {
                    id: m.id,
                    name: club?.name ?? null,
                    description: club?.description ?? null,
                    role: m.role,
                    status: m.status,
                    joinedAt: m.joinedAt,
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    // GET /users/:id/personal - User Profile Personal tab
    app.get('/users/:id/personal', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            // Validate pagination params
            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
            }
            // Fetch all personal data in parallel
            const [goals, bucketList, memories, myCircle, lifeTimeline, fits,] = await Promise.all([
                registry_1.models.goals
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.bucketList
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.memories
                    .find({ userId })
                    .sort({ date: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.myCircle
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.lifeTimeline
                    .find({ userId })
                    .sort({ eventDate: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.fits
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
            ]);
            // Get total counts for pagination
            const [totalGoals, totalBucketList, totalMemories, totalMyCircle, totalLifeTimeline, totalFits,] = await Promise.all([
                registry_1.models.goals.countDocuments({ userId }),
                registry_1.models.bucketList.countDocuments({ userId }),
                registry_1.models.memories.countDocuments({ userId }),
                registry_1.models.myCircle.countDocuments({ userId }),
                registry_1.models.lifeTimeline.countDocuments({ userId }),
                registry_1.models.fits.countDocuments({ userId }),
            ]);
            const response = {
                success: true,
                pagination: {
                    page,
                    limit,
                    skip,
                },
                goals: {
                    data: goals.map(goal => ({
                        id: goal.id,
                        title: goal.title,
                        status: goal.status,
                        progress: goal.progress,
                        targetDate: goal.targetDate ?? null,
                    })),
                    total: totalGoals,
                    pages: Math.ceil(totalGoals / limit),
                },
                bucketList: {
                    data: bucketList.map(item => ({
                        id: item.id,
                        title: item.title,
                        priority: item.priority,
                        status: item.completed ? 'completed' : 'pending',
                    })),
                    total: totalBucketList,
                    pages: Math.ceil(totalBucketList / limit),
                },
                memories: {
                    data: memories.map(memory => ({
                        id: memory.id,
                        title: memory.title,
                        date: memory.date ?? null,
                        location: memory.location ?? null,
                        images: Array.isArray(memory.images) ? memory.images : [],
                    })),
                    total: totalMemories,
                    pages: Math.ceil(totalMemories / limit),
                },
                myCircle: {
                    data: myCircle.map(member => ({
                        id: member.id,
                        name: member.connectionName ?? null,
                        relationship: member.relationship ?? null,
                    })),
                    total: totalMyCircle,
                    pages: Math.ceil(totalMyCircle / limit),
                },
                lifeTimeline: {
                    data: lifeTimeline.map(event => ({
                        id: event.id,
                        event: event.title,
                        category: event.category ?? null,
                        date: event.eventDate ?? null,
                    })),
                    total: totalLifeTimeline,
                    pages: Math.ceil(totalLifeTimeline / limit),
                },
                fits: {
                    data: fits.map(fit => ({
                        id: fit.id,
                        name: fit.name,
                        tags: fit.tags ?? [],
                        rating: fit.rating ?? null,
                    })),
                    total: totalFits,
                    pages: Math.ceil(totalFits / limit),
                },
            };
            res.json(response);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    // GET /users/:id/activity - User Profile Activity tab
    app.get('/users/:id/activity', auth_2.requireAuth, async (req, res) => {
        try {
            const userId = req.params.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            // Validate pagination params
            if (page < 1 || limit < 1 || limit > 100) {
                return res.status(400).json({ message: 'Invalid pagination parameters. page >= 1, 1 <= limit <= 100' });
            }
            // Clean documents helper
            const clean = (doc) => {
                if (!doc)
                    return null;
                const cleaned = { ...doc };
                delete cleaned._id;
                delete cleaned.__v;
                return cleaned;
            };
            // 1. allActivity: reuse userActivity (full paginated list)
            const [allActivity, totalAllActivity] = await Promise.all([
                registry_1.models.userActivity
                    .find({ userId })
                    .sort({ occurredAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.userActivity.countDocuments({ userId }),
            ]);
            // 2. timeline: reuse lifeTimeline (from Personal tab)
            const [timeline, totalTimeline] = await Promise.all([
                registry_1.models.lifeTimeline
                    .find({ userId })
                    .sort({ eventDate: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.lifeTimeline.countDocuments({ userId }),
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
                registry_1.models.userActivity
                    .find({ userId, action: { $in: goalRelatedActions } })
                    .sort({ occurredAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.userActivity.countDocuments({ userId, action: { $in: goalRelatedActions } }),
            ]);
            // 4. journalActivity: new placeholder collection
            const [journalActivity, totalJournalActivity] = await Promise.all([
                registry_1.models.journalActivity
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.journalActivity.countDocuments({ userId }),
            ]);
            // 5. trackerActivity: new placeholder collection
            const [trackerActivity, totalTrackerActivity] = await Promise.all([
                registry_1.models.trackerActivity
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.trackerActivity.countDocuments({ userId }),
            ]);
            // 6. featureUsage: new placeholder collection
            const [featureUsage, totalFeatureUsage] = await Promise.all([
                registry_1.models.featureUsage
                    .find({ userId })
                    .sort({ lastUsedAt: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                registry_1.models.featureUsage.countDocuments({ userId }),
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            res.status(500).json({ success: false, message });
        }
    });
    const CONTENT_RESOURCES_TO_SKIP = new Set([
        'tips',
        'affirmations',
        'zodiac',
        'banners',
        'journalPrompts',
        'fortuneCookies',
        'communityGuidelines',
        'appAnnouncements',
    ]);
    for (const resource of registry_1.ARRAY_RESOURCES) {
        if (resource === 'anonymousPosts')
            continue;
        if (CONTENT_RESOURCES_TO_SKIP.has(resource))
            continue;
        app.use(`/${resource}`, auth_2.requireAuth, (0, createCrudRouter_1.createCrudRouter)(registry_1.models[resource], resource));
    }
    for (const resource of registry_1.SINGLETON_RESOURCES) {
        app.use(`/${resource}`, auth_2.requireAuth, (0, createSingletonRouter_1.createSingletonRouter)(registry_1.models[resource], resource));
    }
}
