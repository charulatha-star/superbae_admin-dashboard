import 'dotenv/config';

import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { LooseDocument } from '../models/registry';

/**
 * Seed script for ACTIVITY tab data
 * Creates placeholder/test data for journalActivity, trackerActivity, featureUsage,
 * and adds goal-related actions to userActivity for the 5 real users.
 * 
 * Usage: Run manually via `npx ts-node src/scripts/seedActivity.ts`
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

// Sample journal activity data
const JOURNAL_TITLES = [
  'Morning reflections',
  'Daily thoughts',
  'Gratitude journal',
  'Dream analysis',
  'Weekly review',
  'Goal progress',
  'Personal growth',
  'Challenges faced',
];

const JOURNAL_CONTENTS = [
  'Today I felt accomplished after completing my morning routine.',
  'Reflecting on the positive moments from this week.',
  'I am grateful for the support from my friends and family.',
  'Had an interesting dream last night that I wanted to document.',
  'Reviewing my goals and progress for this month.',
  'Facing some challenges but staying optimistic.',
  'Learning new things every day and growing as a person.',
  'Today was productive and fulfilling.',
];

const MOODS = ['happy', 'grateful', 'reflective', 'motivated', 'calm', 'inspired', 'content', 'hopeful'];

// Sample tracker activity data
const TRACKER_TYPES = [
  'water_intake',
  'steps',
  'sleep_hours',
  'meditation_minutes',
  'calories_burned',
  'reading_time',
  'screen_time',
  'workout_duration',
];

const TRACKER_UNITS = [
  'ml',
  'steps',
  'hours',
  'minutes',
  'calories',
  'minutes',
  'minutes',
  'minutes',
];

// Sample feature usage data
const FEATURE_NAMES = [
  'journal',
  'goal_tracker',
  'mood_tracker',
  'habit_tracker',
  'community_forum',
  'personal_analytics',
  'reminders',
  'export_data',
  'dark_mode',
  'notifications',
];

// Goal-related actions for userActivity
const GOAL_RELATED_ACTIONS = [
  'goal_created',
  'goal_updated',
  'goal_deleted',
  'goal_completed',
  'goal_abandoned',
  'goal_progress_updated',
];

async function seedActivity(): Promise<void> {
  await connectDB();

  console.log('Seeding ACTIVITY tab data...\n');

  // Clear existing test data from new collections
  console.log('Clearing existing placeholder data from journalActivity, trackerActivity, featureUsage...');
  await Promise.all([
    models.journalActivity.deleteMany({}),
    models.trackerActivity.deleteMany({}),
    models.featureUsage.deleteMany({}),
  ]);
  console.log('  Done.\n');

  // Remove existing goal-related actions from userActivity to avoid duplicates
  console.log('Removing existing goal-related actions from userActivity...');
  await models.userActivity.deleteMany({
    action: { $in: GOAL_RELATED_ACTIONS }
  });
  console.log('  Done.\n');

  // Seed data for each real user
  const allUserIds = Object.values(REAL_USER_IDS);

  for (const userId of allUserIds) {
    const userName = REAL_USER_NAMES[userId] || 'Unknown';
    console.log(`Seeding activity data for ${userName} (${userId})...`);

    // 1. Create 2-3 journalActivity records per user
    const journalCount = 2 + Math.floor(Math.random() * 2); // 2-3 records
    const userJournalActivity: LooseDocument[] = [];

    for (let i = 0; i < journalCount; i++) {
      const journal = {
        id: generateId('journal', userId, i + 1),
        userId,
        title: JOURNAL_TITLES[i % JOURNAL_TITLES.length],
        content: JOURNAL_CONTENTS[i % JOURNAL_CONTENTS.length] + ` [${userName}]`,
        mood: MOODS[i % MOODS.length],
        tags: ['personal', 'reflection', userName.toLowerCase().replace(' ', '_')],
        createdAt: pastDate(7 - i),
      };
      userJournalActivity.push(journal);
    }

    if (userJournalActivity.length > 0) {
      await models.journalActivity.insertMany(userJournalActivity);
      console.log(`  Created ${userJournalActivity.length} journalActivity records`);
    }

    // 2. Create 2-3 trackerActivity records per user
    const trackerCount = 2 + Math.floor(Math.random() * 2); // 2-3 records
    const userTrackerActivity: LooseDocument[] = [];

    for (let i = 0; i < trackerCount; i++) {
      const trackerType = TRACKER_TYPES[i % TRACKER_TYPES.length];
      const unit = TRACKER_UNITS[i % TRACKER_UNITS.length];
      const value = Math.floor(Math.random() * 100) + 1;

      const tracker = {
        id: generateId('tracker', userId, i + 1),
        userId,
        trackerType,
        value,
        unit,
        note: `Daily ${trackerType.replace('_', ' ')} tracking [${userName}]`,
        createdAt: pastDate(5 - i),
      };
      userTrackerActivity.push(tracker);
    }

    if (userTrackerActivity.length > 0) {
      await models.trackerActivity.insertMany(userTrackerActivity);
      console.log(`  Created ${userTrackerActivity.length} trackerActivity records`);
    }

    // 3. Create 2-3 featureUsage records per user
    const featureCount = 2 + Math.floor(Math.random() * 2); // 2-3 records
    const userFeatureUsage: LooseDocument[] = [];

    for (let i = 0; i < featureCount; i++) {
      const featureName = FEATURE_NAMES[i % FEATURE_NAMES.length];
      const usageCount = Math.floor(Math.random() * 50) + 1;

      const feature = {
        id: generateId('feature', userId, i + 1),
        userId,
        featureName,
        usageCount,
        lastUsedAt: pastDate(2 - i),
        createdAt: pastDate(30 - i * 2),
      };
      userFeatureUsage.push(feature);
    }

    if (userFeatureUsage.length > 0) {
      await models.featureUsage.insertMany(userFeatureUsage);
      console.log(`  Created ${userFeatureUsage.length} featureUsage records`);
    }

    // 4. Add 1-2 goal-related action entries to userActivity
    const goalActionCount = 1 + Math.floor(Math.random() * 2); // 1-2 records
    const userGoalActions: LooseDocument[] = [];

    for (let i = 0; i < goalActionCount; i++) {
      const action = GOAL_RELATED_ACTIONS[i % GOAL_RELATED_ACTIONS.length];
      const daysAgo = 10 + Math.floor(Math.random() * 15);

      const goalAction = {
        id: generateId('activity_goal', userId, i + 1),
        userId,
        action,
        occurredAt: pastDate(daysAgo),
      };
      userGoalActions.push(goalAction);
    }

    if (userGoalActions.length > 0) {
      await models.userActivity.insertMany(userGoalActions);
      console.log(`  Added ${userGoalActions.length} goal-related actions to userActivity`);
    }

    console.log('');
  }

  // Verify counts
  console.log('=== VERIFICATION ===');
  const [
    totalJournalActivity,
    totalTrackerActivity,
    totalFeatureUsage,
    totalGoalRelatedActions
  ] = await Promise.all([
    models.journalActivity.countDocuments(),
    models.trackerActivity.countDocuments(),
    models.featureUsage.countDocuments(),
    models.userActivity.countDocuments({ action: { $in: GOAL_RELATED_ACTIONS } }),
  ]);

  console.log(`Total journalActivity: ${totalJournalActivity}`);
  console.log(`Total trackerActivity: ${totalTrackerActivity}`);
  console.log(`Total featureUsage: ${totalFeatureUsage}`);
  console.log(`Total goal-related actions in userActivity: ${totalGoalRelatedActions}`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('All placeholder/test data has been seeded.');
  console.log('This is TEST DATA for the ACTIVITY tab demonstration only.');

  process.exit(0);
}

seedActivity().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});