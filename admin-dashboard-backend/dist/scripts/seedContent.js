"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
/**
 * Seed script for CONTENT tab data
 * Creates placeholder/test data for posts, comments, reactions, and safetyReports
 * for the 5 real users: Alice, Yogesh, Divya, Jane, Ram
 *
 * Usage: Run manually via `ts-node src/scripts/seedContent.ts`
 * DO NOT import or run automatically
 */
const REAL_USER_IDS = {
    alice: 'usr_001',
    yogesh: 'user_919500011980_1788166013011',
    divya: 'user_919790440088_1788166013252',
    jane: 'user_918667556475_1788166013366',
    ram: 'user_919514515152_1788174900911',
};
const REAL_USER_NAMES = {
    [REAL_USER_IDS.alice]: 'Alice Valid',
    [REAL_USER_IDS.yogesh]: 'Yogesh',
    [REAL_USER_IDS.divya]: 'Divya Ashokkumar',
    [REAL_USER_IDS.jane]: 'Jane Doe',
    [REAL_USER_IDS.ram]: 'Ram',
};
// Helper to generate ID
const generateId = (prefix, userId, index) => {
    const shortUser = userId.replace('user_', 'u_').substring(0, 8);
    return `${prefix}_${shortUser}_${String(index).padStart(3, '0')}`;
};
// Generate a date in the past
const pastDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
};
// Generate a future date for scheduled posts
const futureDate = (daysFromNow) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d;
};
// Sample post content
const POST_TITLES = [
    'My first post',
    'Thoughts on today',
    'Important update',
    'Question for the community',
    'Sharing my experience',
    'Weekend plans',
    'Motivation for the day',
    'A quick note',
];
const POST_CONTENTS = [
    'This is a test post created for the content tab demonstration.',
    'Hello everyone! Just checking in with my latest thoughts.',
    'I wanted to share this with all of you. Hope you like it!',
    'Has anyone else experienced this? Would love to hear your thoughts.',
    'Another day, another post. Keeping the content flowing.',
    'This post is currently in draft status for testing purposes.',
    'Scheduled to be published in the future.',
];
const COMMENT_CONTENTS = [
    'Great post!',
    'I agree with this.',
    'Interesting perspective.',
    'Thanks for sharing!',
    'This is helpful.',
    'Well said!',
    'I have a question about this...',
];
const REACTION_TYPES = ['like', 'love', 'laugh', 'angry', 'sad', 'celebrate'];
const REPORT_REASONS = [
    'Spam content',
    'Inappropriate material',
    'Harassment',
    'Misinformation',
    'Offensive language',
];
async function seedContent() {
    await (0, db_1.connectDB)();
    console.log('Seeding CONTENT tab data...\n');
    // Clear existing test data from new collections (posts, comments, reactions)
    // For safetyReports, we'll update existing docs to add userId field if missing
    console.log('Clearing existing placeholder data from posts, comments, reactions...');
    await Promise.all([
        registry_1.models.posts.deleteMany({}),
        registry_1.models.comments.deleteMany({}),
        registry_1.models.reactions.deleteMany({}),
    ]);
    console.log('  Done.\n');
    // Enhance existing safetyReports to have userId field
    console.log('Enhancing safetyReports with userId field...');
    const existingReports = await registry_1.models.safetyReports.find({ userId: { $exists: false } }).lean();
    if (existingReports.length > 0) {
        console.log(`  Found ${existingReports.length} reports without userId field.`);
        // For each report without userId, we need to determine which user it belongs to
        // Since we can't reliably map "Unknown User A" to a userId, we'll skip these
        // and the new seed data will have proper userId fields
        console.log('  Note: Existing reports have reportedUser as names, not IDs.');
        console.log('  New seed data will include proper userId fields.');
    }
    console.log('  Done.\n');
    // Seed data for each real user
    const allUserIds = Object.values(REAL_USER_IDS);
    for (const userId of allUserIds) {
        const userName = REAL_USER_NAMES[userId] || 'Unknown';
        console.log(`Seeding data for ${userName} (${userId})...`);
        // Create 3-5 posts per user
        const postCount = 3 + (Math.floor(Math.random() * 3)); // 3-5 posts
        const userPosts = [];
        for (let i = 0; i < postCount; i++) {
            const statuses = ['published', 'draft', 'scheduled'];
            const status = statuses[i % statuses.length];
            const post = {
                id: generateId('post', userId, i + 1),
                userId,
                title: POST_TITLES[i % POST_TITLES.length] + ` (by ${userName})`,
                content: POST_CONTENTS[i % POST_CONTENTS.length] + ` [Placeholder data for ${userName}]`,
                status,
                createdAt: pastDate(30 - i * 2),
                updatedAt: pastDate(30 - i * 2),
                likes: Math.floor(Math.random() * 50),
                commentsCount: Math.floor(Math.random() * 10),
                isAnonymous: false,
            };
            if (status === 'scheduled') {
                post.scheduledAt = futureDate(7 + i);
            }
            if (status === 'published') {
                post.publishedAt = pastDate(20 - i);
            }
            userPosts.push(post);
        }
        // Insert posts
        if (userPosts.length > 0) {
            await registry_1.models.posts.insertMany(userPosts);
            console.log(`  Created ${userPosts.length} posts`);
        }
        // Create 3-5 comments per user on various posts
        const commentCount = 3 + (Math.floor(Math.random() * 3));
        const userComments = [];
        for (let i = 0; i < commentCount; i++) {
            // Comment on a random post (could be their own or another user's)
            const randomPostIndex = Math.floor(Math.random() * userPosts.length);
            const targetPostId = userPosts[randomPostIndex].id;
            const comment = {
                id: generateId('comment', userId, i + 1),
                userId,
                postId: targetPostId,
                content: COMMENT_CONTENTS[i % COMMENT_CONTENTS.length] + ` [by ${userName}]`,
                status: 'active',
                createdAt: pastDate(15 - i),
                updatedAt: pastDate(15 - i),
            };
            userComments.push(comment);
        }
        // Insert comments
        if (userComments.length > 0) {
            await registry_1.models.comments.insertMany(userComments);
            console.log(`  Created ${userComments.length} comments`);
        }
        // Create 3-5 reactions given by this user
        const reactionsGivenCount = 3 + (Math.floor(Math.random() * 3));
        const userReactionsGiven = [];
        for (let i = 0; i < reactionsGivenCount; i++) {
            // React to a random post (pick from any user's posts that exist)
            // For simplicity, react to own posts in this seed
            const randomPostIndex = Math.floor(Math.random() * userPosts.length);
            const targetPostId = userPosts[randomPostIndex].id;
            // Target user is the author of the post we're reacting to
            // In this seed, we're reacting to our own posts, so targetUserId = userId
            // In real data, this would be different
            const reaction = {
                id: generateId('react', userId, i + 1),
                userId, // The user giving the reaction
                postId: targetPostId,
                commentId: null,
                targetUserId: userId, // Author of the content being reacted to
                type: REACTION_TYPES[i % REACTION_TYPES.length],
                createdAt: pastDate(10 - i),
            };
            userReactionsGiven.push(reaction);
        }
        // Insert reactions given
        if (userReactionsGiven.length > 0) {
            await registry_1.models.reactions.insertMany(userReactionsGiven);
            console.log(`  Created ${userReactionsGiven.length} reactions (given)`);
        }
        // Create 2-3 reports for this user's content (reports about this user)
        // Note: userId in safetyReports is the content author being reported
        const reportCount = 2 + (Math.floor(Math.random() * 2)); // 2-3 reports
        const userReports = [];
        for (let i = 0; i < reportCount; i++) {
            // Find a random reporter (another user)
            const otherUserIds = allUserIds.filter(id => id !== userId);
            const reporterId = otherUserIds[Math.floor(Math.random() * otherUserIds.length)];
            const reporterName = REAL_USER_NAMES[reporterId] || 'Anonymous';
            const report = {
                id: generateId('report', userId, i + 1),
                reportId: `RPT-${userId.substring(0, 4).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
                userId, // The content author being reported (this user)
                reporter: reporterName,
                reportedUser: userName,
                reason: REPORT_REASONS[i % REPORT_REASONS.length],
                description: `Reported content by ${userName}. [Placeholder test data]`,
                status: 'pending',
                severity: 'low',
                createdAt: pastDate(5 - i),
            };
            userReports.push(report);
        }
        // Insert reports
        if (userReports.length > 0) {
            await registry_1.models.safetyReports.insertMany(userReports);
            console.log(`  Created ${userReports.length} reports (content author: ${userName})`);
        }
        console.log('');
    }
    // Verify counts
    console.log('=== VERIFICATION ===');
    const [totalPosts, totalComments, totalReactions, totalReports] = await Promise.all([
        registry_1.models.posts.countDocuments(),
        registry_1.models.comments.countDocuments(),
        registry_1.models.reactions.countDocuments(),
        registry_1.models.safetyReports.countDocuments(),
    ]);
    console.log(`Total posts: ${totalPosts}`);
    console.log(`Total comments: ${totalComments}`);
    console.log(`Total reactions: ${totalReactions}`);
    console.log(`Total safety reports: ${totalReports}`);
    console.log('\n=== SEED COMPLETE ===');
    console.log('All placeholder/test data has been seeded.');
    console.log('This is TEST DATA for the CONTENT tab demonstration only.');
    process.exit(0);
}
seedContent().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
