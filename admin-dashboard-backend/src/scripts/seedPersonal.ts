import 'dotenv/config';

import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { LooseDocument } from '../models/registry';

/**
 * Seed script for PERSONAL tab data
 * Creates 2-3 items per section (goals, bucketList, memories, myCircle, 
 * lifeTimeline, fits) for each of the 5 real users.
 * 
 * Usage: Run manually via `npx ts-node src/scripts/seedPersonal.ts`
 * DO NOT import or run automatically
 */

const REAL_USER_IDS = {
  alice: 'usr_001',
  yogesh: 'user_919500011980_1788166013011',
  divya: 'user_919790440088_1788166013252',
  jane: 'user_918667556475_1788166013366',
  ram: 'user_919514515152_1788174900911',
};

const REAL_USER_NAMES: Record<string, string> = {
  [REAL_USER_IDS.alice]: 'Alice Valid',
  [REAL_USER_IDS.yogesh]: 'Yogesh',
  [REAL_USER_IDS.divya]: 'Divya Ashokkumar',
  [REAL_USER_IDS.jane]: 'Jane Doe',
  [REAL_USER_IDS.ram]: 'Ram',
};

// Helper to generate ID
const generateId = (prefix: string, userId: string, index: number): string => {
  const shortUser = userId.replace('user_', 'u_').substring(0, 8);
  return `${prefix}_${shortUser}_${String(index).padStart(3, '0')}`;
};

// Generate a date in the past
const pastDate = (daysAgo: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
};

// Future date for goals
const futureDate = (daysFromNow: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
};

// Sample data for personal tab
const GOAL_TITLES = [
  'Lose 10 pounds',
  'Read 12 books this year',
  'Learn a new language',
  'Run a 5K',
  'Meditate daily',
  'Save for vacation',
  'Get a promotion',
];

const GOAL_DESCRIPTIONS = [
  'Focus on fitness and health',
  'Expand my knowledge through reading',
  'Become fluent in Spanish',
  'Train for and complete a 5K race',
  'Practice mindfulness every day',
  'Save money for a dream vacation',
  'Advance my career',
];

const BUCKET_LIST_TITLES = [
  'Visit Paris',
  'Skydiving',
  'Learn to play guitar',
  'Write a book',
  'Go on a safari',
  'Climb Mount Everest',
  'See the Northern Lights',
];

const MEMORY_TITLES = [
  'My first day at work',
  'Graduation day',
  'Family vacation',
  'My wedding day',
  'Birth of my child',
  'First time traveling abroad',
  'My 30th birthday party',
];

const MEMORY_CONTENTS = [
  'Today was an exciting new beginning. I started my dream job and met amazing colleagues.',
  'After years of hard work, I finally graduated. A day I will never forget.',
  'We spent two wonderful weeks exploring the beaches and mountains. Pure bliss.',
  'The happiest day of my life. Everything was perfect.',
  'A life-changing experience that brought so much joy.',
  'Stepping into a new country for the first time was exhilarating.',
  'Celebrated with all my closest friends and family. What a memorable day!',
];

const MOODS = ['happy', 'joyful', 'reflective', 'nostalgic', 'grateful', 'excited', 'peaceful'];

const CIRCLE_NAMES = [
  'John Smith',
  'Sarah Johnson',
  'Michael Brown',
  'Emily Davis',
  'David Wilson',
  'Lisa Taylor',
  'Robert Anderson',
  'Jennifer Martinez',
];

const RELATIONSHIPS = ['friend', 'family', 'colleague', 'mentor', 'neighbor'];

const TIMELINE_TITLES = [
  'Born',
  'Graduated High School',
  'First Job',
  'Got Married',
  'Bought First House',
  'Started New Career',
  'Had First Child',
];

const TIMELINE_CATEGORIES = ['birth', 'education', 'career', 'family', 'milestone', 'achievement'];

const FIT_NAMES = [
  'Casual Friday',
  'Date Night',
  'Work Outfit',
  'Weekend Brunch',
  'Vacation Look',
  'Party Outfit',
];

const FIT_TAGS = [
  ['casual', 'comfortable'],
  ['elegant', 'night-out'],
  ['professional', 'work'],
  ['relaxed', 'weekend'],
  ['summer', 'beach'],
  ['fancy', 'celebration'],
];

async function seedPersonal(): Promise<void> {
  await connectDB();

  console.log('Seeding PERSONAL tab data...\n');

  // Clear existing personal data
  console.log('Clearing existing personal data...');
  await Promise.all([
    models.goals.deleteMany({}),
    models.bucketList.deleteMany({}),
    models.memories.deleteMany({}),
    models.myCircle.deleteMany({}),
    models.lifeTimeline.deleteMany({}),
    models.fits.deleteMany({}),
  ]);
  console.log('  Done.\n');

  // Seed data for each real user
  const allUserIds = Object.values(REAL_USER_IDS);

  for (const userId of allUserIds) {
    const userName = REAL_USER_NAMES[userId] || 'Unknown';
    console.log(`Seeding personal data for ${userName} (${userId})...`);

    // 1. Create 2-3 goals
    const goalCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < goalCount; i++) {
      const progress = Math.floor(Math.random() * 101);
      const status = progress >= 100 ? 'completed' : (Math.random() > 0.5 ? 'active' : 'abandoned');
      const targetDate = status === 'completed' ? pastDate(30 - i * 10) : futureDate(30 + i * 10);

      await models.goals.create({
        id: generateId('goal', userId, i + 1),
        userId,
        title: GOAL_TITLES[i % GOAL_TITLES.length],
        description: GOAL_DESCRIPTIONS[i % GOAL_DESCRIPTIONS.length] + ` [${userName}]`,
        category: 'personal',
        targetDate,
        status,
        progress,
        createdAt: pastDate(15 - i),
        updatedAt: pastDate(15 - i),
      });
      console.log(`  Goal ${i + 1}: ${GOAL_TITLES[i % GOAL_TITLES.length]}`);
    }

    // 2. Create 2-3 bucket list items
    const bucketCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < bucketCount; i++) {
      const completed = Math.random() > 0.7;
      const completedAt = completed ? pastDate(20 - i * 5) : null;

      await models.bucketList.create({
        id: generateId('bl', userId, i + 1),
        userId,
        title: BUCKET_LIST_TITLES[i % BUCKET_LIST_TITLES.length],
        description: `A dream I hope to achieve someday. [${userName}]`,
        category: 'travel',
        completed,
        completedAt,
        priority: 1 + Math.floor(Math.random() * 5),
        createdAt: pastDate(10 - i),
      });
      console.log(`  Bucket List ${i + 1}: ${BUCKET_LIST_TITLES[i % BUCKET_LIST_TITLES.length]} (${completed ? 'completed' : 'pending'})`);
    }

    // 3. Create 2-3 memories
    const memoryCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < memoryCount; i++) {
      const daysAgo = 10 + Math.floor(Math.random() * 100);

      await models.memories.create({
        id: generateId('mem', userId, i + 1),
        userId,
        title: MEMORY_TITLES[i % MEMORY_TITLES.length],
        content: MEMORY_CONTENTS[i % MEMORY_CONTENTS.length] + ` [${userName}]`,
        date: pastDate(daysAgo),
        location: 'New York',
        tags: ['memory', 'personal', '2026'],
        mood: MOODS[i % MOODS.length],
        createdAt: pastDate(5 - i),
      });
      console.log(`  Memory ${i + 1}: ${MEMORY_TITLES[i % MEMORY_TITLES.length]}`);
    }

    // 4. Create 2-3 myCircle entries
    const circleCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < circleCount; i++) {
      const connectionIndex = Math.floor(Math.random() * CIRCLE_NAMES.length);

      await models.myCircle.create({
        id: generateId('circle', userId, i + 1),
        userId,
        connectionId: `conn_${connectionIndex + 1}`,
        connectionName: CIRCLE_NAMES[connectionIndex],
        relationship: RELATIONSHIPS[i % RELATIONSHIPS.length],
        notes: `Met through mutual friends. [${userName}]`,
        isClose: Math.random() > 0.3,
        createdAt: pastDate(5 - i),
      });
      console.log(`  My Circle ${i + 1}: ${CIRCLE_NAMES[connectionIndex]} (${RELATIONSHIPS[i % RELATIONSHIPS.length]})`);
    }

    // 5. Create 2-3 life timeline entries
    const timelineCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < timelineCount; i++) {
      const yearsAgo = 5 + Math.floor(Math.random() * 25);

      await models.lifeTimeline.create({
        id: generateId('tl', userId, i + 1),
        userId,
        title: TIMELINE_TITLES[i % TIMELINE_TITLES.length],
        description: `A significant milestone in my life. [${userName}]`,
        eventDate: pastDate(yearsAgo * 365),
        category: TIMELINE_CATEGORIES[i % TIMELINE_CATEGORIES.length],
        location: 'Home',
        images: [],
        createdAt: pastDate(3 - i),
      });
      console.log(`  Timeline ${i + 1}: ${TIMELINE_TITLES[i % TIMELINE_TITLES.length]}`);
    }

    // 6. Create 2-3 fits
    const fitCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < fitCount; i++) {
      const rating = 1 + Math.floor(Math.random() * 5);

      await models.fits.create({
        id: generateId('fit', userId, i + 1),
        userId,
        name: FIT_NAMES[i % FIT_NAMES.length],
        items: ['T-Shirt', 'Jeans', 'Sneakers'],
        description: `My favorite outfit for ${FIT_NAMES[i % FIT_NAMES.length].toLowerCase()}. [${userName}]`,
        rating,
        lastWorn: pastDate(2 - i),
        tags: FIT_TAGS[i % FIT_TAGS.length],
        image: null,
        createdAt: pastDate(2 - i),
      });
      console.log(`  Fit ${i + 1}: ${FIT_NAMES[i % FIT_NAMES.length]} (rating: ${rating}/5)`);
    }

    console.log('');
  }

  // Verify counts
  console.log('=== VERIFICATION ===');
  const [
    totalGoals,
    totalBucketList,
    totalMemories,
    totalMyCircle,
    totalLifeTimeline,
    totalFits,
  ] = await Promise.all([
    models.goals.countDocuments(),
    models.bucketList.countDocuments(),
    models.memories.countDocuments(),
    models.myCircle.countDocuments(),
    models.lifeTimeline.countDocuments(),
    models.fits.countDocuments(),
  ]);

  console.log(`Goals: ${totalGoals}`);
  console.log(`Bucket List: ${totalBucketList}`);
  console.log(`Memories: ${totalMemories}`);
  console.log(`My Circle: ${totalMyCircle}`);
  console.log(`Life Timeline: ${totalLifeTimeline}`);
  console.log(`Fits: ${totalFits}`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('All placeholder/test data has been seeded.');
  console.log('This is TEST DATA for the PERSONAL tab demonstration only.');

  process.exit(0);
}

seedPersonal().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
