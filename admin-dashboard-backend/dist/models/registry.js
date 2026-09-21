"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKER_CATEGORIES = exports.TRACKER_TYPES = exports.models = exports.SINGLETON_RESOURCES = exports.ARRAY_RESOURCES = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.ARRAY_RESOURCES = [
    'admins',
    'adminSessions',
    'roles',
    'permissions',
    'users',
    'groups',
    'events',
    'trips',
    'support',
    'auditLogs',
    'security',
    'affirmations',
    'zodiac',
    'tips',
    'banners',
    'fortuneCookies',
    'communityGuidelines',
    'appAnnouncements',
    'aiUsage',
    'aiConfig',
    'subscriptions',
    'payments',
    'revenue',
    'analyticsUsers',
    'analyticsFeatures',
    'analyticsRevenue',
    'loginHistory',
    'sessions',
    'userActivity',
    'safetyReports',
    'safetyModeration',
    'anonymousPosts',
    'wardrobe',
    'clothingCategories',
    'clothingAttributes',
    'clothingColors',
    'clothingStyles',
    'clothingOccasions',
    'clothingSeasons',
    'recommendationRules',
    'wardrobeReports',
    'trackers',
    'habitTemplates',
    'moodOptions',
    'symptoms',
    'periodSymptoms',
    'medications',
    'expenseCategories',
    'reminderTemplates',
    'journalPrompts',
    'partners',
    'clubs',
    'notifications',
    'posts',
    'comments',
    'reactions',
    'eventRegistrations',
    'memberships',
    'goals',
    'bucketList',
    'memories',
    'myCircle',
    'lifeTimeline',
    'fits',
    'journalActivity',
    'trackerActivity',
    'featureUsage',
    'partnerConnections',
    'connectionRequests',
    'relationshipUsage',
    'sharedSpaceReports',
    'coupleContent',
    'datePlanner',
    'anniversaryReminders',
];
exports.SINGLETON_RESOURCES = [
    'aiDashboard',
    'settings',
    'appSettings',
    'dashboardStats',
    'dashboardCharts',
    'dashboardTables',
    'measurementUnits',
    'waterUnits',
];
exports.models = {};
function toModelName(resource) {
    return resource.charAt(0).toUpperCase() + resource.slice(1);
}
/**
 * Shared fields applied to every CMS content collection.
 * Each content schema spreads this object to get consistent
 * status, publishing, featuring, audit, and authorship fields.
 */
const contentSharedFields = {
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
    },
    publishedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    isFeatured: { type: Boolean, default: false },
    authorId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
};
/**
 * PHASE 1 — Tracker & Wellness configuration (schemas only, no routes/UI).
 *
 * Lighter shared-fields object for tracker option-list collections
 * (Habit Templates, Mood Options, Symptoms Library, Period Symptoms,
 * Medications, Expense Categories). Deliberately NOT contentSharedFields:
 * option lists use active/inactive + sortOrder semantics, never the
 * CMS draft/published/scheduled publishing lifecycle.
 *
 * Per approved decisions: trackerType discriminator on every option item
 * (same trick as tips.subtype / banners.type in CMS), category stays a
 * simple free-text field (no hierarchy), metric units only, reminder
 * templates are template-side config only (no per-user schedules).
 */
exports.TRACKER_TYPES = [
    'habit',
    'mood',
    'water',
    'sleep',
    'expense',
    'sickness',
    'measure',
    'period',
    'intimacy',
    'bmi',
];
exports.TRACKER_CATEGORIES = ['Wellness', 'Health', 'Finance'];
const trackerOptionSharedFields = {
    trackerType: { type: String, enum: [...exports.TRACKER_TYPES], required: true, index: true },
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
};
for (const resource of exports.ARRAY_RESOURCES) {
    const schema = resource === 'users'
        ? new mongoose_1.default.Schema({
            id: { type: String, required: true, unique: true, index: true },
            name: { type: String, required: true },
            status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
            plan: { type: String, enum: ['free', 'premium'], default: 'free' },
            joinedAt: { type: Date, default: Date.now },
            lastSeen: { type: Date, default: Date.now },
            posts: { type: Number, default: 0 },
            groups: { type: Number, default: 0 },
            // Profile tab fields (optional)
            bio: { type: String, default: null },
            interests: { type: [String], default: [] },
            thingsILove: { type: [String], default: [] },
            zodiac: { type: String, default: null },
        }, { strict: false, versionKey: false, id: false, collection: resource })
        : resource === 'adminSessions'
            ? new mongoose_1.default.Schema({
                id: { type: String, required: true, unique: true, index: true },
                adminId: { type: String, required: true, index: true },
                token: { type: String, required: true, unique: true, index: true },
                createdAt: { type: Date, required: true, default: Date.now },
                expiresAt: { type: Date, required: true, index: true },
                revokedAt: { type: Date, default: null },
            }, { strict: false, versionKey: false, id: false, collection: resource })
            : resource === 'loginHistory'
                ? new mongoose_1.default.Schema({
                    id: { type: String, required: true, unique: true, index: true },
                    userId: { type: String, required: true, index: true },
                    loginAt: { type: Date, required: true },
                    device: { type: String, required: true },
                    ipAddress: { type: String, required: true },
                }, { strict: false, versionKey: false, id: false, collection: resource })
                : resource === 'sessions'
                    ? new mongoose_1.default.Schema({
                        id: { type: String, required: true, unique: true, index: true },
                        userId: { type: String, required: true, index: true },
                        device: { type: String, required: true },
                        ipAddress: { type: String, required: true },
                        lastActiveAt: { type: Date, required: true },
                    }, { strict: false, versionKey: false, id: false, collection: resource })
                    : resource === 'userActivity'
                        ? new mongoose_1.default.Schema({
                            id: { type: String, required: true, unique: true, index: true },
                            userId: { type: String, required: true, index: true },
                            action: { type: String, required: true },
                            occurredAt: { type: Date, required: true },
                        }, { strict: false, versionKey: false, id: false, collection: resource })
                        : resource === 'groups'
                            ? new mongoose_1.default.Schema({
                                id: { type: String, required: true, unique: true, index: true },
                                name: { type: String, default: null },
                                description: { type: String, default: null },
                                category: { type: String, default: null },
                                memberCount: { type: Number, default: 0 },
                                status: { type: String, default: null },
                                createdAt: { type: Date, default: null },
                                owner: { type: String, default: null },
                                organizerId: { type: String, default: null, index: true },
                            }, { strict: false, versionKey: false, id: false, collection: resource })
                            : resource === 'clubs'
                                ? new mongoose_1.default.Schema({
                                    id: { type: String, required: true, unique: true, index: true },
                                    name: { type: String, default: null },
                                    description: { type: String, default: null },
                                    category: { type: String, default: null },
                                    memberCount: { type: Number, default: 0 },
                                    status: { type: String, default: null },
                                    createdAt: { type: Date, default: null },
                                    owner: { type: String, default: null },
                                    organizerId: { type: String, default: null, index: true },
                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                : resource === 'events'
                                    ? new mongoose_1.default.Schema({
                                        id: { type: String, required: true, unique: true, index: true },
                                        title: { type: String, required: true, trim: true },
                                        type: { type: String, required: true, trim: true },
                                        date: { type: Date, required: true },
                                        status: { type: String, default: null },
                                        attendees: { type: Number, default: 0 },
                                        capacity: { type: Number, required: true, min: 1 },
                                        registeredCount: { type: Number, default: 0, min: 0 },
                                        checkedInCount: { type: Number, default: 0, min: 0 },
                                        host: { type: String, default: null },
                                        category: { type: String, required: true, trim: true },
                                        organizerId: { type: String, default: null, index: true },
                                        imageUrl: { type: String, default: null, trim: true },
                                        description: { type: String, default: null, trim: true },
                                        location: { type: String, default: null, trim: true },
                                        reminderSentAt: { type: Date, default: null },
                                        reminderConfig: {
                                            enabled: { type: Boolean, default: false },
                                            sendBeforeHours: {
                                                type: Number,
                                                default: 24,
                                                min: 1,
                                                validate: {
                                                    validator(value) {
                                                        return this.enabled !== true || Number.isFinite(value) && value > 0;
                                                    },
                                                    message: 'sendBeforeHours must be greater than 0 when reminders are enabled.',
                                                },
                                            },
                                        },
                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                    : resource === 'payments'
                                        ? new mongoose_1.default.Schema({
                                            id: { type: String, required: true, unique: true, index: true },
                                            userId: { type: String, default: null, index: true },
                                            amount: { type: Number, default: null },
                                            currency: { type: String, default: null },
                                            status: { type: String, default: null },
                                            paymentMethod: { type: String, default: null },
                                            createdAt: { type: Date, default: Date.now },
                                            paymentType: { type: String, enum: ['subscription', 'event'], default: 'subscription' },
                                            eventId: { type: String, default: null, index: true },
                                            registrationId: { type: String, default: null, index: true },
                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                        : resource === 'eventRegistrations'
                                            ? new mongoose_1.default.Schema({
                                                id: { type: String, required: true, unique: true, index: true },
                                                userId: { type: String, required: true, index: true },
                                                eventId: { type: String, required: true, index: true },
                                                status: { type: String, enum: ['registered', 'attended', 'cancelled', 'no-show'], default: 'registered' },
                                                registrationDate: { type: Date, default: Date.now },
                                                checkInDate: { type: Date, default: null },
                                                ticketType: { type: String, default: null },
                                                price: { type: Number, default: null },
                                                ticketCode: { type: String, default: null },
                                                createdAt: { type: Date, default: Date.now },
                                                updatedAt: { type: Date, default: Date.now },
                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                            : resource === 'memberships'
                                                ? new mongoose_1.default.Schema({
                                                    id: { type: String, required: true, unique: true, index: true },
                                                    userId: { type: String, required: true, index: true },
                                                    groupId: { type: String, default: null, index: true },
                                                    clubId: { type: String, default: null, index: true },
                                                    role: { type: String, enum: ['member', 'admin', 'owner'], default: 'member' },
                                                    joinedAt: { type: Date, default: Date.now },
                                                    status: { type: String, enum: ['active', 'suspended', 'left'], default: 'active' },
                                                    createdAt: { type: Date, default: Date.now },
                                                    updatedAt: { type: Date, default: Date.now },
                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                : resource === 'goals'
                                                    ? new mongoose_1.default.Schema({
                                                        id: { type: String, required: true, unique: true, index: true },
                                                        userId: { type: String, required: true, index: true },
                                                        title: { type: String, required: true },
                                                        description: { type: String, default: null },
                                                        category: { type: String, default: null },
                                                        targetDate: { type: Date, default: null },
                                                        status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
                                                        progress: { type: Number, default: 0 },
                                                        createdAt: { type: Date, default: Date.now },
                                                        updatedAt: { type: Date, default: Date.now },
                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                    : resource === 'bucketList'
                                                        ? new mongoose_1.default.Schema({
                                                            id: { type: String, required: true, unique: true, index: true },
                                                            userId: { type: String, required: true, index: true },
                                                            title: { type: String, required: true },
                                                            description: { type: String, default: null },
                                                            category: { type: String, default: null },
                                                            completed: { type: Boolean, default: false },
                                                            completedAt: { type: Date, default: null },
                                                            priority: { type: Number, default: 3 },
                                                            createdAt: { type: Date, default: Date.now },
                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                        : resource === 'memories'
                                                            ? new mongoose_1.default.Schema({
                                                                id: { type: String, required: true, unique: true, index: true },
                                                                userId: { type: String, required: true, index: true },
                                                                title: { type: String, default: null },
                                                                content: { type: String, required: true },
                                                                date: { type: Date, default: null },
                                                                location: { type: String, default: null },
                                                                tags: { type: [String], default: [] },
                                                                mood: { type: String, default: null },
                                                                createdAt: { type: Date, default: Date.now },
                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                            : resource === 'myCircle'
                                                                ? new mongoose_1.default.Schema({
                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                    userId: { type: String, required: true, index: true },
                                                                    connectionId: { type: String, required: true, index: true },
                                                                    connectionName: { type: String, default: null },
                                                                    relationship: { type: String, default: null },
                                                                    notes: { type: String, default: null },
                                                                    isClose: { type: Boolean, default: true },
                                                                    createdAt: { type: Date, default: Date.now },
                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                : resource === 'lifeTimeline'
                                                                    ? new mongoose_1.default.Schema({
                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                        userId: { type: String, required: true, index: true },
                                                                        title: { type: String, required: true },
                                                                        description: { type: String, default: null },
                                                                        eventDate: { type: Date, default: null },
                                                                        category: { type: String, default: null },
                                                                        location: { type: String, default: null },
                                                                        images: { type: [String], default: [] },
                                                                        createdAt: { type: Date, default: Date.now },
                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                    : resource === 'fits'
                                                                        ? new mongoose_1.default.Schema({
                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                            userId: { type: String, required: true, index: true },
                                                                            name: { type: String, default: null },
                                                                            items: { type: [String], default: [] },
                                                                            description: { type: String, default: null },
                                                                            rating: { type: Number, default: null },
                                                                            lastWorn: { type: Date, default: null },
                                                                            tags: { type: [String], default: [] },
                                                                            image: { type: String, default: null },
                                                                            createdAt: { type: Date, default: Date.now },
                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                        : resource === 'journalActivity'
                                                                            ? new mongoose_1.default.Schema({
                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                userId: { type: String, required: true, index: true },
                                                                                title: { type: String, default: null },
                                                                                content: { type: String, default: null },
                                                                                mood: { type: String, default: null },
                                                                                tags: { type: [String], default: [] },
                                                                                createdAt: { type: Date, default: Date.now },
                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                            : resource === 'trackerActivity'
                                                                                ? new mongoose_1.default.Schema({
                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                    userId: { type: String, required: true, index: true },
                                                                                    trackerType: { type: String, default: null },
                                                                                    value: { type: Number, default: null },
                                                                                    unit: { type: String, default: null },
                                                                                    note: { type: String, default: null },
                                                                                    createdAt: { type: Date, default: Date.now },
                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                : resource === 'featureUsage'
                                                                                    ? new mongoose_1.default.Schema({
                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                        userId: { type: String, required: true, index: true },
                                                                                        featureName: { type: String, required: true },
                                                                                        usageCount: { type: Number, default: 1 },
                                                                                        lastUsedAt: { type: Date, default: Date.now },
                                                                                        createdAt: { type: Date, default: Date.now },
                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                    : resource === 'safetyReports'
                                                                                        ? new mongoose_1.default.Schema({
                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                            reportId: { type: String, default: null },
                                                                                            reporter: { type: String, default: null },
                                                                                            userId: { type: String, required: true, index: true },
                                                                                            reportedUser: { type: String, default: null },
                                                                                            reason: { type: String, default: null },
                                                                                            description: { type: String, default: null },
                                                                                            status: { type: String, default: null },
                                                                                            severity: { type: String, default: null },
                                                                                            createdAt: { type: Date, default: Date.now },
                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                        : resource === 'auditLogs'
                                                                                            ? new mongoose_1.default.Schema({
                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                adminId: { type: String, required: true, index: true },
                                                                                                adminName: { type: String, required: true },
                                                                                                action: { type: String, required: true, index: true },
                                                                                                target: { type: String, default: null },
                                                                                                description: { type: String, required: true },
                                                                                                createdAt: { type: Date, required: true, default: Date.now, index: true },
                                                                                                targetType: { type: String, default: null, index: true },
                                                                                                targetId: { type: String, default: null, index: true },
                                                                                                reason: { type: String, default: null },
                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                            : resource === 'anonymousPosts'
                                                                                                ? new mongoose_1.default.Schema({
                                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                                    content: { type: String, required: true },
                                                                                                    status: { type: String, default: 'pending', index: true },
                                                                                                    reportCount: { type: Number, default: 0 },
                                                                                                    realAuthorId: { type: String, default: null, index: true },
                                                                                                    riskScore: { type: Number, default: 0, index: true },
                                                                                                    createdAt: { type: Date, default: Date.now, index: true },
                                                                                                    updatedAt: { type: Date, default: Date.now },
                                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                : resource === 'safetyModeration'
                                                                                                    ? new mongoose_1.default.Schema({
                                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                                        contentType: { type: String, default: null, index: true },
                                                                                                        content: { type: String, default: null },
                                                                                                        contentId: { type: String, default: null, index: true },
                                                                                                        reportedBy: { type: String, default: null },
                                                                                                        reason: { type: String, default: null },
                                                                                                        status: { type: String, default: 'pending', index: true },
                                                                                                        riskScore: { type: Number, default: 0, index: true },
                                                                                                        createdAt: { type: Date, default: Date.now, index: true },
                                                                                                        resolvedAt: { type: Date, default: null },
                                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                    : resource === 'posts'
                                                                                                        ? new mongoose_1.default.Schema({
                                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                                            userId: { type: String, required: true, index: true },
                                                                                                            content: { type: String, required: true },
                                                                                                            title: { type: String, default: null },
                                                                                                            status: { type: String, enum: ['draft', 'published', 'scheduled', 'archived'], default: 'draft' },
                                                                                                            scheduledAt: { type: Date, default: null },
                                                                                                            publishedAt: { type: Date, default: null },
                                                                                                            createdAt: { type: Date, default: Date.now },
                                                                                                            updatedAt: { type: Date, default: Date.now },
                                                                                                            likes: { type: Number, default: 0 },
                                                                                                            commentsCount: { type: Number, default: 0 },
                                                                                                            isAnonymous: { type: Boolean, default: false },
                                                                                                            groupId: { type: String, default: null, index: true },
                                                                                                            clubId: { type: String, default: null, index: true },
                                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                        : resource === 'comments'
                                                                                                            ? new mongoose_1.default.Schema({
                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                userId: { type: String, required: true, index: true },
                                                                                                                postId: { type: String, required: true, index: true },
                                                                                                                content: { type: String, required: true },
                                                                                                                createdAt: { type: Date, default: Date.now },
                                                                                                                updatedAt: { type: Date, default: Date.now },
                                                                                                                status: { type: String, enum: ['active', 'deleted', 'flagged'], default: 'active' },
                                                                                                                groupId: { type: String, default: null, index: true },
                                                                                                                clubId: { type: String, default: null, index: true },
                                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                            : resource === 'reactions'
                                                                                                                ? new mongoose_1.default.Schema({
                                                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                                                    userId: { type: String, required: true, index: true },
                                                                                                                    postId: { type: String, default: null, index: true },
                                                                                                                    commentId: { type: String, default: null, index: true },
                                                                                                                    targetUserId: { type: String, required: true, index: true },
                                                                                                                    type: { type: String, required: true },
                                                                                                                    createdAt: { type: Date, default: Date.now },
                                                                                                                    groupId: { type: String, default: null, index: true },
                                                                                                                    clubId: { type: String, default: null, index: true },
                                                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                : resource === 'affirmations'
                                                                                                                    ? new mongoose_1.default.Schema({
                                                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                                                        ...contentSharedFields,
                                                                                                                        text: { type: String, required: true },
                                                                                                                        category: { type: String, default: null },
                                                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                    : resource === 'zodiac'
                                                                                                                        ? new mongoose_1.default.Schema({
                                                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                                                            ...contentSharedFields,
                                                                                                                            sign: { type: String, required: true },
                                                                                                                            date: { type: Date, required: true },
                                                                                                                            horoscope: { type: String, default: null },
                                                                                                                            love: { type: String, default: null },
                                                                                                                            career: { type: String, default: null },
                                                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                        : resource === 'tips'
                                                                                                                            ? new mongoose_1.default.Schema({
                                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                                ...contentSharedFields,
                                                                                                                                title: { type: String, required: true },
                                                                                                                                body: { type: String, required: true },
                                                                                                                                category: { type: String, default: null },
                                                                                                                                subtype: { type: String, enum: ['relationship', 'wellness'], required: true },
                                                                                                                                views: { type: Number, default: 0 },
                                                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                            : resource === 'banners'
                                                                                                                                ? new mongoose_1.default.Schema({
                                                                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                                                                    ...contentSharedFields,
                                                                                                                                    title: { type: String, required: true },
                                                                                                                                    type: { type: String, enum: ['banner', 'promotional'], default: 'banner' },
                                                                                                                                    placement: { type: String, default: null },
                                                                                                                                    startDate: { type: Date, default: null },
                                                                                                                                    endDate: { type: Date, default: null },
                                                                                                                                    clicks: { type: Number, default: 0 },
                                                                                                                                    impressions: { type: Number, default: 0 },
                                                                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                : resource === 'journalPrompts'
                                                                                                                                    ? new mongoose_1.default.Schema({
                                                                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                                                                        ...contentSharedFields,
                                                                                                                                        text: { type: String, required: true },
                                                                                                                                        category: { type: String, default: null },
                                                                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                    : resource === 'fortuneCookies'
                                                                                                                                        ? new mongoose_1.default.Schema({
                                                                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                                                                            ...contentSharedFields,
                                                                                                                                            text: { type: String, required: true },
                                                                                                                                            category: { type: String, default: null },
                                                                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                        : resource === 'communityGuidelines'
                                                                                                                                            ? new mongoose_1.default.Schema({
                                                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                ...contentSharedFields,
                                                                                                                                                title: { type: String, required: true },
                                                                                                                                                body: { type: String, required: true },
                                                                                                                                                order: { type: Number, default: 0 },
                                                                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                            : resource === 'appAnnouncements'
                                                                                                                                                ? new mongoose_1.default.Schema({
                                                                                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                    ...contentSharedFields,
                                                                                                                                                    title: { type: String, required: true },
                                                                                                                                                    body: { type: String, required: true },
                                                                                                                                                    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
                                                                                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                // ── PHASE 1: Tracker & Wellness configuration ──────────────
                                                                                                                                                // Available Trackers: the one true parent registry (10 types).
                                                                                                                                                // category is a simple free-text field (decision: no hierarchy).
                                                                                                                                                // Sleep/Expense/Period/Intimacy/BMI keep bespoke per-tracker
                                                                                                                                                // config in `config` (strict:false) — NOT forced into the
                                                                                                                                                // generic option-list shape.
                                                                                                                                                : resource === 'trackers'
                                                                                                                                                    ? new mongoose_1.default.Schema({
                                                                                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                        trackerType: { type: String, enum: [...exports.TRACKER_TYPES], required: true, unique: true, index: true },
                                                                                                                                                        name: { type: String, required: true, trim: true },
                                                                                                                                                        description: { type: String, default: null },
                                                                                                                                                        category: { type: String, default: null },
                                                                                                                                                        isEnabled: { type: Boolean, default: true, index: true },
                                                                                                                                                        sortOrder: { type: Number, default: 0, min: 0 },
                                                                                                                                                        config: { type: mongoose_1.default.Schema.Types.Mixed, default: null },
                                                                                                                                                        createdAt: { type: Date, default: Date.now },
                                                                                                                                                        updatedAt: { type: Date, default: Date.now },
                                                                                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                    // Habit Templates: pre-built starting points (label,
                                                                                                                                                    // default target+unit, default repeat cycle).
                                                                                                                                                    : resource === 'habitTemplates'
                                                                                                                                                        ? new mongoose_1.default.Schema({
                                                                                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                            ...trackerOptionSharedFields,
                                                                                                                                                            defaultTarget: { type: Number, default: null, min: 0 },
                                                                                                                                                            defaultUnit: { type: String, default: null },
                                                                                                                                                            defaultRepeatCycle: {
                                                                                                                                                                type: String,
                                                                                                                                                                enum: ['daily', 'weekly', 'monthly', 'yearly'],
                                                                                                                                                                default: null,
                                                                                                                                                            },
                                                                                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                        // Mood Options: shared shape + emoji (the mood's visual identity).
                                                                                                                                                        : resource === 'moodOptions'
                                                                                                                                                            ? new mongoose_1.default.Schema({
                                                                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                ...trackerOptionSharedFields,
                                                                                                                                                                emoji: { type: String, default: null },
                                                                                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                            // Symptoms Library / Period Symptoms: shared shape + allowed
                                                                                                                                                            // severity scale observed in mockups (Low/Moderate/Extreme).
                                                                                                                                                            // Period Symptoms is a SEPARATE list (decision Q2).
                                                                                                                                                            : resource === 'symptoms' || resource === 'periodSymptoms'
                                                                                                                                                                ? new mongoose_1.default.Schema({
                                                                                                                                                                    id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                    ...trackerOptionSharedFields,
                                                                                                                                                                    severityLevels: { type: [String], default: ['Low', 'Moderate', 'Extreme'] },
                                                                                                                                                                }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                                // Medications: IN SCOPE (decision Q3), alongside Symptoms.
                                                                                                                                                                : resource === 'medications'
                                                                                                                                                                    ? new mongoose_1.default.Schema({
                                                                                                                                                                        id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                        ...trackerOptionSharedFields,
                                                                                                                                                                        dosage: { type: String, default: null },
                                                                                                                                                                    }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                                    // Expense Categories: shared shape + expenseType discriminator
                                                                                                                                                                    // (banners.type pattern — one collection, NOT two).
                                                                                                                                                                    // Budgets OUT OF SCOPE (decision Q8): no budget fields.
                                                                                                                                                                    : resource === 'expenseCategories'
                                                                                                                                                                        ? new mongoose_1.default.Schema({
                                                                                                                                                                            id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                            ...trackerOptionSharedFields,
                                                                                                                                                                            expenseType: { type: String, enum: ['expense', 'income'], required: true, index: true },
                                                                                                                                                                        }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                                        // Reminder Templates: TEMPLATE side only. One default message
                                                                                                                                                                        // per tracker type (decision Q6); no per-user schedules.
                                                                                                                                                                        : resource === 'reminderTemplates'
                                                                                                                                                                            ? new mongoose_1.default.Schema({
                                                                                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                                trackerType: { type: String, enum: [...exports.TRACKER_TYPES], required: true, unique: true, index: true },
                                                                                                                                                                                defaultMessage: { type: String, required: true, trim: true },
                                                                                                                                                                                defaultCadence: { type: String, enum: ['daily', 'weekly', 'custom'], default: 'daily' },
                                                                                                                                                                                enabledByDefault: { type: Boolean, default: false },
                                                                                                                                                                                createdAt: { type: Date, default: Date.now },
                                                                                                                                                                                updatedAt: { type: Date, default: Date.now },
                                                                                                                                                                            }, { strict: false, versionKey: false, id: false, collection: resource })
                                                                                                                                                                            : new mongoose_1.default.Schema({
                                                                                                                                                                                id: { type: String, required: true, unique: true, index: true },
                                                                                                                                                                            }, {
                                                                                                                                                                                strict: false,
                                                                                                                                                                                versionKey: false,
                                                                                                                                                                                id: false,
                                                                                                                                                                                collection: resource,
                                                                                                                                                                            });
    exports.models[resource] = mongoose_1.default.model(toModelName(resource), schema);
}
for (const resource of exports.SINGLETON_RESOURCES) {
    const schema = new mongoose_1.default.Schema({
        _singleton: { type: String, default: resource, unique: true },
    }, {
        strict: false,
        versionKey: false,
        id: false,
        collection: resource,
    });
    exports.models[resource] = mongoose_1.default.model(toModelName(resource), schema);
}
