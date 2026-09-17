"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
/**
 * Seed script for COMMUNITY tab data
 * 1. Adds organizerId to existing group (grp_001 -> usr_001)
 * 2. Creates memberships for 5 real users across groups/clubs
 * 3. Creates 2-3 clubPosts/comments/reactions per user with groupId/clubId
 *
 * Usage: Run manually via `npx ts-node src/scripts/seedCommunity.ts`
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
// Sample content for community posts/comments
const COMMUNITY_POST_TITLES = [
    'Group Discussion',
    'Club Announcement',
    'Member Introduction',
    'Event Planning',
    'Weekly Topic',
    'Important Update',
    'Question for Members',
];
const COMMUNITY_POST_CONTENTS = [
    'Hello everyone in the group! Let us discuss...',
    'Important announcement for all club members.',
    'Hi, I am a new member here.',
    'We should plan our next meetup.',
    'This week we will focus on...',
    'Please note the following updates.',
    'Does anyone have experience with...?',
];
const COMMUNITY_COMMENT_CONTENTS = [
    'Great point!',
    'I agree with this.',
    'Thanks for sharing!',
    'This is very helpful.',
    'I have a question about...',
    'Well said!',
    'Looking forward to it!',
];
const REACTION_TYPES = ['like', 'love', 'laugh', 'angry', 'sad', 'celebrate'];
async function seedCommunity() {
    await (0, db_1.connectDB)();
    console.log('Seeding COMMUNITY tab data...\n');
    // Step 1: Update existing group to add organizerId
    console.log('Step 1: Updating existing group...');
    const existingGroup = await registry_1.models.groups.findOne({ id: 'grp_001' }).lean();
    if (existingGroup) {
        console.log(`  Found group: ${existingGroup.name}`);
        await registry_1.models.groups.updateOne({ id: 'grp_001' }, { $set: { organizerId: REAL_USER_IDS.alice } });
        console.log(`  Added organizerId: ${REAL_USER_IDS.alice} (Alice Valid)\n`);
    }
    else {
        console.log('  No existing group found, will create one.\n');
    }
    // Step 2: Ensure we have at least 1 group and 1 club
    console.log('Step 2: Creating groups and clubs if needed...');
    const groupsCount = await registry_1.models.groups.countDocuments();
    const clubsCount = await registry_1.models.clubs.countDocuments();
    if (groupsCount === 0) {
        await registry_1.models.groups.create({
            id: 'grp_001',
            name: 'Mindfulness Circle',
            category: 'Wellness',
            memberCount: 0,
            status: 'active',
            createdAt: pastDate(30),
            owner: 'Alice Valid',
            organizerId: REAL_USER_IDS.alice,
        });
        console.log('  Created group: Mindfulness Circle');
    }
    if (clubsCount === 0) {
        await registry_1.models.clubs.create({
            id: 'club_001',
            name: 'Super Bae Social Club',
            category: 'Social',
            memberCount: 0,
            status: 'active',
            createdAt: pastDate(25),
            owner: 'Alice Valid',
            organizerId: REAL_USER_IDS.alice,
        });
        console.log('  Created club: Super Bae Social Club');
    }
    // Create a second group and club
    const group2Exists = await registry_1.models.groups.countDocuments({ id: 'grp_002' });
    if (group2Exists === 0) {
        await registry_1.models.groups.create({
            id: 'grp_002',
            name: 'Fitness Enthusiasts',
            description: 'A community for sharing workouts, goals, and healthy habits.',
            category: 'Fitness',
            memberCount: 0,
            status: 'active',
            createdAt: pastDate(20),
            owner: 'Yogesh',
            organizerId: REAL_USER_IDS.yogesh,
        });
        console.log('  Created group: Fitness Enthusiasts');
    }
    else {
        await registry_1.models.groups.updateOne({ id: 'grp_002', description: { $in: [null, ''] } }, { $set: { description: 'A community for sharing workouts, goals, and healthy habits.' } });
    }
    const club2Exists = await registry_1.models.clubs.countDocuments({ id: 'club_002' });
    if (club2Exists === 0) {
        await registry_1.models.clubs.create({
            id: 'club_002',
            name: 'Book Lovers Club',
            description: 'A space for discovering books and sharing thoughtful conversations.',
            category: 'Hobbies',
            memberCount: 0,
            status: 'active',
            createdAt: pastDate(15),
            owner: 'Divya Ashokkumar',
            organizerId: REAL_USER_IDS.divya,
        });
        console.log('  Created club: Book Lovers Club');
    }
    else {
        await registry_1.models.clubs.updateOne({ id: 'club_002', description: { $in: [null, ''] } }, { $set: { description: 'A space for discovering books and sharing thoughtful conversations.' } });
    }
    console.log('');
    // Step 3: Clear existing memberships, community posts/comments/reactions
    console.log('Step 3: Clearing existing community data...');
    await Promise.all([
        registry_1.models.memberships.deleteMany({}),
        registry_1.models.posts.deleteMany({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
        registry_1.models.comments.deleteMany({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
        registry_1.models.reactions.deleteMany({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
    ]);
    console.log('  Done.\n');
    // Step 4: Get all groups and clubs
    const allGroups = await registry_1.models.groups.find({}).lean();
    const allClubs = await registry_1.models.clubs.find({}).lean();
    console.log(`Available groups: ${allGroups.length}, clubs: ${allClubs.length}\n`);
    // Step 5: Create memberships for each real user
    const allUserIds = Object.values(REAL_USER_IDS);
    for (const userId of allUserIds) {
        const userName = REAL_USER_NAMES[userId] || 'Unknown';
        console.log(`Seeding memberships for ${userName} (${userId})...`);
        // Assign memberships to random groups and clubs
        // Each user gets 1-2 group memberships and 1-2 club memberships
        const groupMembershipCount = 1 + Math.floor(Math.random() * 2); // 1-2
        const clubMembershipCount = 1 + Math.floor(Math.random() * 2); // 1-2
        // Create group memberships
        for (let i = 0; i < groupMembershipCount; i++) {
            const group = allGroups[Math.floor(Math.random() * allGroups.length)];
            const role = (group.organizerId === userId) ? 'owner' : 'member';
            await registry_1.models.memberships.create({
                id: generateId('mem', userId, i + 1),
                userId,
                groupId: group.id,
                clubId: null,
                role,
                joinedAt: pastDate(10 - i),
                status: 'active',
                createdAt: pastDate(10 - i),
                updatedAt: pastDate(10 - i),
            });
            console.log(`  Group membership: ${group.name} (role: ${role})`);
        }
        // Create club memberships
        for (let i = 0; i < clubMembershipCount; i++) {
            const club = allClubs[Math.floor(Math.random() * allClubs.length)];
            const role = (club.organizerId === userId) ? 'owner' : 'member';
            await registry_1.models.memberships.create({
                id: generateId('mem', userId, i + 100),
                userId,
                groupId: null,
                clubId: club.id,
                role,
                joinedAt: pastDate(10 - i),
                status: 'active',
                createdAt: pastDate(10 - i),
                updatedAt: pastDate(10 - i),
            });
            console.log(`  Club membership: ${club.name} (role: ${role})`);
        }
        console.log('');
    }
    // Step 6: Create club posts, comments, and reactions
    console.log('Step 4: Creating community posts, comments, and reactions...\n');
    // Get all groups and clubs again (in case we created new ones)
    const finalGroups = await registry_1.models.groups.find({}).lean();
    const finalClubs = await registry_1.models.clubs.find({}).lean();
    const allCommunities = [...finalGroups, ...finalClubs];
    for (const userId of allUserIds) {
        const userName = REAL_USER_NAMES[userId] || 'Unknown';
        console.log(`Creating community content for ${userName}...`);
        // Create 2-3 club posts
        const postCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < postCount; i++) {
            // Randomly choose a group or club
            const community = allCommunities[Math.floor(Math.random() * allCommunities.length)];
            const isGroup = 'group' in community && community.group !== undefined;
            // Actually, check if it's from groups or clubs
            const isGroupDoc = allCommunities.slice(0, finalGroups.length).some(g => g.id === community.id);
            const post = {
                id: generateId('cpost', userId, i + 1),
                userId,
                content: COMMUNITY_POST_CONTENTS[i % COMMUNITY_POST_CONTENTS.length] + ` [by ${userName}]`,
                title: COMMUNITY_POST_TITLES[i % COMMUNITY_POST_TITLES.length],
                status: 'published',
                createdAt: pastDate(5 - i),
                updatedAt: pastDate(5 - i),
                likes: Math.floor(Math.random() * 20),
                commentsCount: Math.floor(Math.random() * 5),
                isAnonymous: false,
                groupId: isGroupDoc ? community.id : null,
                clubId: isGroupDoc ? null : community.id,
            };
            await registry_1.models.posts.create(post);
            console.log(`  Post ${i + 1}: ${post.title} in ${isGroupDoc ? 'group' : 'club'} ${community.name}`);
        }
        // Create 2-3 club comments on club posts
        const commentCount = 2 + Math.floor(Math.random() * 2);
        // Get some club posts to comment on (could be user's own or others')
        const allClubPosts = await registry_1.models.posts.find({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }).lean();
        for (let i = 0; i < commentCount; i++) {
            if (allClubPosts.length === 0) {
                console.log('  No club posts available to comment on');
                break;
            }
            const randomPost = allClubPosts[Math.floor(Math.random() * allClubPosts.length)];
            const comment = {
                id: generateId('ccomment', userId, i + 1),
                userId,
                postId: randomPost.id,
                content: COMMUNITY_COMMENT_CONTENTS[i % COMMUNITY_COMMENT_CONTENTS.length] + ` [by ${userName}]`,
                status: 'active',
                createdAt: pastDate(3 - i),
                updatedAt: pastDate(3 - i),
                groupId: randomPost.groupId,
                clubId: randomPost.clubId,
            };
            await registry_1.models.comments.create(comment);
            console.log(`  Comment ${i + 1}: on post ${randomPost.id}`);
        }
        // Create 2-3 club reactions
        const reactionCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < reactionCount; i++) {
            if (allClubPosts.length === 0) {
                console.log('  No club posts available to react to');
                break;
            }
            const randomPost = allClubPosts[Math.floor(Math.random() * allClubPosts.length)];
            const reaction = {
                id: generateId('creact', userId, i + 1),
                userId,
                postId: randomPost.id,
                commentId: null,
                targetUserId: randomPost.userId,
                type: REACTION_TYPES[i % REACTION_TYPES.length],
                createdAt: pastDate(2 - i),
                groupId: randomPost.groupId,
                clubId: randomPost.clubId,
            };
            await registry_1.models.reactions.create(reaction);
            console.log(`  Reaction ${i + 1}: ${reaction.type} on post ${randomPost.id}`);
        }
        console.log('');
    }
    // Verify counts
    console.log('=== VERIFICATION ===');
    const [totalGroups, totalClubs, totalMemberships, totalClubPosts, totalClubComments, totalClubReactions] = await Promise.all([
        registry_1.models.groups.countDocuments(),
        registry_1.models.clubs.countDocuments(),
        registry_1.models.memberships.countDocuments(),
        registry_1.models.posts.countDocuments({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
        registry_1.models.comments.countDocuments({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
        registry_1.models.reactions.countDocuments({ $or: [{ groupId: { $ne: null } }, { clubId: { $ne: null } }] }),
    ]);
    console.log(`Groups: ${totalGroups}`);
    console.log(`Clubs: ${totalClubs}`);
    console.log(`Memberships: ${totalMemberships}`);
    console.log(`Club Posts: ${totalClubPosts}`);
    console.log(`Club Comments: ${totalClubComments}`);
    console.log(`Club Reactions: ${totalClubReactions}`);
    // Check existing group has organizerId
    const updatedGroup = await registry_1.models.groups.findOne({ id: 'grp_001' }).lean();
    if (updatedGroup && updatedGroup.organizerId) {
        console.log(`\nExisting group (grp_001) has organizerId: ${updatedGroup.organizerId}`);
    }
    console.log('\n=== SEED COMPLETE ===');
    console.log('All placeholder/test data has been seeded.');
    console.log('This is TEST DATA for the COMMUNITY tab demonstration only.');
    process.exit(0);
}
seedCommunity().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
});
