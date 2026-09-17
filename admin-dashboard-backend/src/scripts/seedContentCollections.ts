import 'dotenv/config';

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { LooseDocument } from '../models/registry';

/**
 * Seed script for CMS CONTENT COLLECTION data.
 * Seeds tips, affirmations, banners, zodiac, journalPrompts,
 * fortuneCookies, communityGuidelines, and appAnnouncements
 * with initial content.
 *
 * Uses upsert-by-id so it is safe to re-run: documents with matching IDs
 * are skipped if they already exist. This prevents data loss from
 * seed.ts's deleteMany({}) — running this script can ONLY ADD or
 * PRESERVE, never delete.
 *
 * Usage: npx tsx src/scripts/seedContentCollections.ts
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

const now = new Date().toISOString();

const affirmationsData: LooseDocument[] = [
  {
    id: 'aff_001',
    text: 'I am worthy of love and belonging.',
    category: 'Self-Love',
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-10T10:00:00Z'),
    createdAt: new Date('2026-01-10T10:00:00Z'),
    updatedAt: new Date('2026-01-10T10:00:00Z'),
  },
  {
    id: 'aff_002',
    text: 'I embrace the abundance that flows to me today.',
    category: 'Abundance',
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-12T08:00:00Z'),
    createdAt: new Date('2026-01-12T08:00:00Z'),
    updatedAt: new Date('2026-01-12T08:00:00Z'),
  },
  {
    id: 'aff_003',
    text: 'I trust my intuition to guide me toward the right choices.',
    category: 'Intuition',
    status: 'published',
    isFeatured: true,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-18T07:00:00Z'),
    createdAt: new Date('2026-01-18T07:00:00Z'),
    updatedAt: new Date('2026-01-18T07:00:00Z'),
  },
  {
    id: 'aff_004',
    text: 'Every challenge I face makes me stronger and more resilient.',
    category: 'Strength',
    status: 'draft',
    isFeatured: false,
    authorId: null,
    scheduledAt: new Date('2026-03-01T09:00:00Z'),
    publishedAt: null,
    createdAt: new Date('2026-02-25T10:00:00Z'),
    updatedAt: new Date('2026-02-25T10:00:00Z'),
  },
];

const tipsData: LooseDocument[] = [
  {
    id: 'tip_001',
    title: 'Morning Meditation for Mental Clarity',
    body: 'Start your day with 5 minutes of mindful breathing. Sit upright, close your eyes, and focus on your breath. This simple practice reduces stress hormones and improves focus for the entire day.',
    category: 'Wellness',
    subtype: 'wellness',
    status: 'published',
    views: 1247,
    createdAt: new Date('2026-01-15T08:00:00Z'),
    updatedAt: new Date('2026-01-15T08:00:00Z'),
  },
  {
    id: 'tip_002',
    title: 'Hydrate Before Your First Coffee',
    body: 'Before reaching for that morning cup, drink a glass of water. Proper hydration kickstarts your metabolism, aids digestion, and helps your body absorb the benefits of your coffee without the jitters.',
    category: 'Health',
    subtype: 'wellness',
    status: 'published',
    views: 892,
    createdAt: new Date('2026-02-03T09:30:00Z'),
    updatedAt: new Date('2026-02-03T09:30:00Z'),
  },
  {
    id: 'tip_003',
    title: 'Quick Desk Stretches for Remote Workers',
    body: 'Every hour, stand up and stretch your neck, shoulders, and back. Simple movements like shoulder rolls and wrist stretches can prevent repetitive strain injuries and keep your energy up all day.',
    category: 'Fitness',
    subtype: 'wellness',
    status: 'published',
    views: 1563,
    createdAt: new Date('2026-02-20T10:15:00Z'),
    updatedAt: new Date('2026-02-20T10:15:00Z'),
  },
  {
    id: 'tip_004',
    title: 'Sleep Hygiene: Create a Bedtime Ritual',
    body: 'Power down screens 30 minutes before bed. Dim the lights, brew a cup of herbal tea, and read a book. A consistent bedtime ritual signals to your brain that it is time to wind down, leading to deeper sleep.',
    category: 'Health',
    subtype: 'wellness',
    status: 'published',
    views: 2108,
    createdAt: new Date('2026-03-01T22:30:00Z'),
    updatedAt: new Date('2026-03-01T22:30:00Z'),
  },
  {
    id: 'tip_005',
    title: 'Digital Detox: Set App Time Limits',
    body: 'Use your phone settings to set daily limits on social media apps. After you hit your limit, the app greys out — no scrolling. This small change can dramatically reduce anxiety and improve real-world connections.',
    category: 'Wellness',
    subtype: 'wellness',
    status: 'draft',
    views: 0,
    createdAt: new Date('2026-03-12T14:00:00Z'),
    updatedAt: new Date('2026-03-12T14:00:00Z'),
    scheduledAt: new Date('2026-03-20T09:00:00Z'),
    authorId: REAL_USER_IDS.alice,
  },
  {
    id: 'tip_006',
    title: 'Eat the Rainbow: Colorful Plates for Better Nutrition',
    body: 'Each color in your fruits and vegetables provides different antioxidants and nutrients. Aim to include at least 3 colors on your plate at every meal for maximum nutritional benefit.',
    category: 'Health',
    subtype: 'wellness',
    status: 'published',
    views: 734,
    createdAt: new Date('2026-03-08T12:45:00Z'),
    updatedAt: new Date('2026-03-08T12:45:00Z'),
  },
];

const bannersData: LooseDocument[] = [
  {
    id: 'ban_001',
    title: 'Premium Upgrade Banner',
    imageUrl: '/banners/premium.jpg',
    linkUrl: '/upgrade',
    placement: 'home_top',
    status: 'active',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    clicks: 342,
    impressions: 5120,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-09-11T00:00:00Z'),
  },
  {
    id: 'ban_002',
    title: 'New Journal Feature Launch',
    imageUrl: '/banners/journal-launch.jpg',
    linkUrl: '/journal',
    placement: 'journal_banner',
    status: 'scheduled',
    startDate: '2026-09-15T00:00:00Z',
    endDate: '2026-10-15T00:00:00Z',
    clicks: 0,
    impressions: 0,
    createdAt: new Date('2026-09-10T12:00:00Z'),
    updatedAt: new Date('2026-09-10T12:00:00Z'),
    isFeatured: false,
    authorId: null,
    publishedAt: null,
    scheduledAt: new Date('2026-09-15T00:00:00Z'),
  },
  {
    id: 'ban_003',
    title: 'Monthly Challenge: 10K Steps Daily',
    imageUrl: '/banners/steps-challenge.jpg',
    linkUrl: '/challenges/steps',
    placement: 'dashboard_promo',
    status: 'published',
    startDate: new Date('2026-09-05T00:00:00Z'),
    endDate: new Date('2026-09-30T00:00:00Z'),
    clicks: 128,
    impressions: 890,
    createdAt: new Date('2026-09-05T08:00:00Z'),
    updatedAt: new Date('2026-09-05T08:00:00Z'),
    isFeatured: false,
    authorId: null,
    publishedAt: new Date('2026-09-05T08:00:00Z'),
    scheduledAt: null,
  },
];

const zodiacData: LooseDocument[] = [
  {
    id: 'zod_001',
    sign: 'Aries',
    date: '2026-08-24',
    horoscope: 'Today brings fresh energy and opportunities. Take the lead with confidence.',
    love: 'Romance is in the air for Aries today.',
    career: 'Bold decisions will pay off at work.',
    status: 'published',
    createdAt: new Date('2026-08-24T00:00:00Z'),
    updatedAt: new Date('2026-08-24T00:00:00Z'),
  },
  {
    id: 'zod_002',
    sign: 'Taurus',
    date: '2026-09-21',
    horoscope: 'Financial stability improves as you stick to your budget. A small investment may pay off soon.',
    love: 'A heartfelt conversation deepens your connection with your partner.',
    career: 'Your attention to detail impresses your manager today.',
    status: 'published',
    createdAt: new Date('2026-09-21T00:00:00Z'),
    updatedAt: new Date('2026-09-21T00:00:00Z'),
    isFeatured: false,
    authorId: null,
    publishedAt: new Date('2026-09-21T00:00:00Z'),
    scheduledAt: null,
  },
  {
    id: 'zod_003',
    sign: 'Gemini',
    date: '2026-09-22',
    horoscope: 'Your communication skills shine today. A conversation could open new doors.',
    love: 'A surprise message brightens your afternoon unexpectedly.',
    career: 'Networking pays off — follow up on that connection.',
    status: 'published',
    createdAt: new Date('2026-09-22T00:00:00Z'),
    updatedAt: new Date('2026-09-22T00:00:00Z'),
    isFeatured: false,
    authorId: null,
    publishedAt: new Date('2026-09-22T00:00:00Z'),
    scheduledAt: null,
  },
  {
    id: 'zod_004',
    sign: 'Cancer',
    date: '2026-09-23',
    horoscope: 'Your intuition is especially strong today. Trust your gut feelings about people.',
    love: 'Nurture your relationships with small acts of kindness.',
    career: 'Your empathy helps resolve a team conflict.',
    status: 'draft',
    createdAt: new Date('2026-09-15T10:00:00Z'),
    updatedAt: new Date('2026-09-15T10:00:00Z'),
    isFeatured: false,
    authorId: null,
    publishedAt: null,
    scheduledAt: new Date('2026-09-23T00:00:00Z'),
  },
];

const journalPromptsData: LooseDocument[] = [
  {
    id: 'prompt_1',
    text: 'What made you smile today?',
    category: 'Gratitude',
    status: 'active',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date('2026-01-08T09:00:00Z'),
    updatedAt: new Date('2026-01-08T09:00:00Z'),
  },
  {
    id: 'prompt_2',
    text: 'Describe a moment this week when you felt truly seen by someone.',
    category: 'Relationships',
    status: 'active',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date('2026-02-14T10:00:00Z'),
    updatedAt: new Date('2026-02-14T10:00:00Z'),
  },
  {
    id: 'prompt_3',
    text: 'If you could give your past self one piece of advice, what would it be?',
    category: 'Reflection',
    status: 'published',
    isFeatured: true,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-03-01T00:00:00Z'),
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    id: 'prompt_4',
    text: 'What is one small step you can take today toward a bigger goal?',
    category: 'Goals',
    status: 'active',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date('2026-03-10T08:30:00Z'),
    updatedAt: new Date('2026-03-10T08:30:00Z'),
  },
];

const fortuneCookiesData: LooseDocument[] = [
  {
    id: 'fortune_001',
    text: 'A pleasant surprise is waiting for you around the corner.',
    category: 'General',
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-15T08:00:00Z'),
    createdAt: new Date('2026-01-15T08:00:00Z'),
    updatedAt: new Date('2026-01-15T08:00:00Z'),
  },
  {
    id: 'fortune_002',
    text: 'Your creativity will lead you to new opportunities.',
    category: 'Inspiration',
    status: 'published',
    isFeatured: true,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-02-01T09:00:00Z'),
    createdAt: new Date('2026-02-01T09:00:00Z'),
    updatedAt: new Date('2026-02-01T09:00:00Z'),
  },
  {
    id: 'fortune_003',
    text: 'A new friendship will blossom when you least expect it.',
    category: 'Relationships',
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-02-14T10:00:00Z'),
    createdAt: new Date('2026-02-14T10:00:00Z'),
    updatedAt: new Date('2026-02-14T10:00:00Z'),
  },
  {
    id: 'fortune_004',
    text: 'The stars align for a journey of self-discovery.',
    category: 'Self-Growth',
    status: 'draft',
    isFeatured: false,
    authorId: null,
    scheduledAt: new Date('2026-04-01T00:00:00Z'),
    publishedAt: null,
    createdAt: new Date('2026-03-15T12:00:00Z'),
    updatedAt: new Date('2026-03-15T12:00:00Z'),
  },
];

const communityGuidelinesData: LooseDocument[] = [
  {
    id: 'guideline_001',
    title: 'Be Kind and Respectful',
    body: 'Treat everyone with kindness and respect. We are a diverse community with different backgrounds, experiences, and perspectives. Harassment, hate speech, and personal attacks are not tolerated.',
    order: 1,
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'guideline_002',
    title: 'Stay On Topic',
    body: 'Keep discussions relevant to the channel or group topic. Off-topic conversations can derail helpful exchanges and make it harder for members to find the information they need.',
    order: 2,
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'guideline_003',
    title: 'No Spam or Self-Promotion',
    body: 'Do not post unsolicited advertisements, affiliate links, or repetitive promotional content. Share your own work only in designated channels and when it adds genuine value to the conversation.',
    order: 3,
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'guideline_004',
    title: 'Protect Privacy',
    body: 'Never share personal information — yours or anyone else\'s — including phone numbers, addresses, emails, or private messages. Respect the privacy and safety of all community members.',
    order: 4,
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'guideline_005',
    title: 'Report Concerns',
    body: 'If you see something that violates these guidelines, use the report feature or contact a moderator directly. Do not engage with problematic content — let the moderation team handle it.',
    order: 5,
    status: 'draft',
    isFeatured: false,
    authorId: null,
    scheduledAt: new Date('2026-04-01T00:00:00Z'),
    publishedAt: null,
    createdAt: new Date('2026-03-20T14:00:00Z'),
    updatedAt: new Date('2026-03-20T14:00:00Z'),
  },
];

const appAnnouncementsData: LooseDocument[] = [
  {
    id: 'announce_001',
    title: 'Welcome to Super Bae v2.0!',
    body: 'We are thrilled to announce the launch of Super Bae v2.0 with a redesigned interface, new wellness features, and improved community tools. Explore the updates and share your feedback!',
    severity: 'info',
    status: 'published',
    isFeatured: true,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-08-01T09:00:00Z'),
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    id: 'announce_002',
    title: 'Scheduled Maintenance This Weekend',
    body: 'We will be performing scheduled maintenance on Saturday, September 14th from 2:00 AM to 4:00 AM UTC. The app may be temporarily unavailable during this window. We apologize for any inconvenience.',
    severity: 'warning',
    status: 'published',
    isFeatured: false,
    authorId: null,
    scheduledAt: new Date('2026-09-10T00:00:00Z'),
    publishedAt: new Date('2026-09-10T00:00:00Z'),
    createdAt: new Date('2026-09-05T10:00:00Z'),
    updatedAt: new Date('2026-09-05T10:00:00Z'),
  },
  {
    id: 'announce_003',
    title: 'Critical Security Update Required',
    body: 'A critical security vulnerability has been identified. Please update your app to the latest version (v2.1.3) immediately to protect your account and data. Visit the app store or our website to download the update.',
    severity: 'critical',
    status: 'published',
    isFeatured: true,
    authorId: null,
    scheduledAt: null,
    publishedAt: new Date('2026-09-12T14:00:00Z'),
    createdAt: new Date('2026-09-12T14:00:00Z'),
    updatedAt: new Date('2026-09-12T14:00:00Z'),
  },
  {
    id: 'announce_004',
    title: 'New Premium Features Coming Soon',
    body: 'We\'re working on exciting new premium features including advanced analytics, personalized insights, and exclusive community access. Stay tuned for the official launch announcement next month!',
    severity: 'info',
    status: 'draft',
    isFeatured: false,
    authorId: null,
    scheduledAt: new Date('2026-10-01T09:00:00Z'),
    publishedAt: null,
    createdAt: new Date('2026-09-10T16:00:00Z'),
    updatedAt: new Date('2026-09-10T16:00:00Z'),
  },
];

const collections: Array<{ name: string; model: mongoose.Model<LooseDocument>; data: LooseDocument[] }> = [
  { name: 'tips', model: models.tips, data: tipsData },
  { name: 'affirmations', model: models.affirmations, data: affirmationsData },
  { name: 'banners', model: models.banners, data: bannersData },
  { name: 'zodiac', model: models.zodiac, data: zodiacData },
  { name: 'journalPrompts', model: models.journalPrompts, data: journalPromptsData },
  { name: 'fortuneCookies', model: models.fortuneCookies, data: fortuneCookiesData },
  { name: 'communityGuidelines', model: models.communityGuidelines, data: communityGuidelinesData },
  { name: 'appAnnouncements', model: models.appAnnouncements, data: appAnnouncementsData },
];

async function seedContentCollections(): Promise<void> {
  await connectDB();

  console.log('Seeding CMS Content collections...\n');

  for (const { name, model, data } of collections) {
    const seedIds = data.map(d => d.id);
    const existingDocs = await model.find({ id: { $in: seedIds } }).lean<LooseDocument[]>();
    const existingIds = new Set(existingDocs.map((d: any) => d.id));

    const newDocs = data.filter(d => !existingIds.has(d.id));

    if (newDocs.length === 0) {
      console.log(`${name}: ${data.length} already present, skipping.`);
    } else {
      let inserted = 0;
      for (const doc of newDocs) {
        try {
          await model.create(doc, { validateBeforeSave: false, new: true });
          inserted++;
        } catch (err: any) {
          if (err?.code === 11000) {
            // duplicate key — already inserted
            inserted++;
            continue;
          }
          // Fall back to raw MongoDB insert to bypass Mongoose schema validation
          // (needed for non-enum status values like 'active' that existing data uses)
          try {
            const rawDoc = { ...doc };
            delete (rawDoc as any)._id;
            delete (rawDoc as any).__v;
            await model.collection.insertOne(rawDoc);
            inserted++;
            console.log(`  (fell back to raw insert for ${doc.id} due to validation: ${err.message.substring(0, 80)})`);
          } catch (rawErr: any) {
            if (rawErr?.code === 11000) {
              inserted++;
              continue;
            }
            console.error(`  ERROR inserting ${name}/${doc.id}: ${rawErr.message.substring(0, 120)}`);
          }
        }
      }
      console.log(`${name}: inserted ${inserted} new docs (out of ${data.length} total).`);
    }

    const totalCount = await model.countDocuments();
    console.log(`${name}: ${totalCount} total docs in collection.\n`);
  }

  console.log('=== Content seeding complete ===');
  await mongoose.disconnect();
}

seedContentCollections().catch((error: unknown) => {
  console.error('Content seed failed:', error);
  process.exit(1);
});
