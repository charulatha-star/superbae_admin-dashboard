import 'dotenv/config';

import { connectDB } from '../config/db';
import { models, LooseDocument } from '../models/registry';

const USERS = {
  alice: 'usr_001',
  yogesh: 'user_919500011980_1788166013011',
  divya: 'user_919790440088_1788166013252',
  jane: 'user_918667556475_1788166013366',
  ram: 'user_919514515152_1788174900911',
};

const posts: LooseDocument[] = [
  {
    id: 'anon_1',
    content: 'Feeling down today...',
    status: 'hidden',
    reportCount: 3,
    realAuthorId: USERS.alice,
    riskScore: 82,
    createdAt: new Date('2026-08-24T10:00:00Z'),
    updatedAt: new Date('2026-09-05T11:54:44.281Z'),
  },
  {
    id: 'anon_2',
    content: 'Is anyone else receiving suspicious links in direct messages?',
    status: 'flagged',
    reportCount: 5,
    realAuthorId: USERS.yogesh,
    riskScore: 96,
    createdAt: new Date('2026-08-27T14:20:00Z'),
    updatedAt: new Date('2026-08-27T14:20:00Z'),
  },
  {
    id: 'anon_3',
    content: 'Looking for advice on setting boundaries with a friend.',
    status: 'active',
    reportCount: 0,
    realAuthorId: USERS.divya,
    riskScore: 12,
    createdAt: new Date('2026-08-29T09:15:00Z'),
    updatedAt: new Date('2026-08-29T09:15:00Z'),
  },
  {
    id: 'anon_4',
    content: 'This community is useless and everyone here is a fraud.',
    status: 'removed',
    reportCount: 4,
    realAuthorId: USERS.jane,
    riskScore: 74,
    createdAt: new Date('2026-08-31T18:45:00Z'),
    updatedAt: new Date('2026-09-01T08:10:00Z'),
  },
  {
    id: 'anon_5',
    content: 'Thank you for creating a place where people can talk openly.',
    status: 'active',
    reportCount: 0,
    realAuthorId: USERS.ram,
    riskScore: 4,
    createdAt: new Date('2026-09-02T07:30:00Z'),
    updatedAt: new Date('2026-09-02T07:30:00Z'),
  },
];

const reports: LooseDocument[] = [
  { id: 'anon_report_2_1', reportId: 'ANON-RPT-002-1', anonymousPostId: 'anon_2', userId: USERS.yogesh, reporter: 'Alice Valid', reportedUser: 'Yogesh', reason: 'Suspicious links', description: 'Post references possible phishing links.', status: 'pending', severity: 'high', createdAt: new Date('2026-08-27T15:00:00Z') },
  { id: 'anon_report_2_2', reportId: 'ANON-RPT-002-2', anonymousPostId: 'anon_2', userId: USERS.yogesh, reporter: 'Divya Ashokkumar', reportedUser: 'Yogesh', reason: 'Spam content', description: 'Repeated suspicious message pattern.', status: 'pending', severity: 'medium', createdAt: new Date('2026-08-27T15:20:00Z') },
  { id: 'anon_report_4_1', reportId: 'ANON-RPT-004-1', anonymousPostId: 'anon_4', userId: USERS.jane, reporter: 'Ram', reportedUser: 'Jane Doe', reason: 'Offensive language', description: 'Abusive language toward the community.', status: 'resolved', severity: 'medium', createdAt: new Date('2026-08-31T19:00:00Z') },
];

const aiFlags: LooseDocument[] = [
  { id: 'anon_flag_2_1', contentType: 'anonymousPost', contentId: 'anon_2', content: 'Suspicious link pattern detected', reportedBy: 'automated-safety', reason: 'Possible phishing', status: 'pending', riskScore: 96, createdAt: new Date('2026-08-27T14:21:00Z') },
  { id: 'anon_flag_4_1', contentType: 'anonymousPost', contentId: 'anon_4', content: 'Aggressive and insulting language detected', reportedBy: 'automated-safety', reason: 'Harassment', status: 'resolved', riskScore: 74, createdAt: new Date('2026-08-31T18:46:00Z') },
];

async function seedAnonymousModeration(): Promise<void> {
  await connectDB();
  await models.anonymousPosts.deleteMany({ id: { $in: posts.map((post) => post.id) } });
  await models.safetyReports.deleteMany({ id: { $in: reports.map((report) => report.id) } });
  await models.safetyModeration.deleteMany({ id: { $in: aiFlags.map((flag) => flag.id) } });
  await models.anonymousPosts.insertMany(posts);
  await models.safetyReports.insertMany(reports);
  await models.safetyModeration.insertMany(aiFlags);
  console.log(`Seeded ${posts.length} anonymous posts, ${reports.length} reports, and ${aiFlags.length} AI flags.`);
  await models.anonymousPosts.find({ id: { $in: posts.map((post) => post.id) } }).lean().then((seeded) => console.log(JSON.stringify(seeded, null, 2)));
  await models.safetyReports.find({ id: { $in: reports.map((report) => report.id) } }).lean().then((seeded) => console.log(JSON.stringify(seeded, null, 2)));
  await models.safetyModeration.find({ id: { $in: aiFlags.map((flag) => flag.id) } }).lean().then((seeded) => console.log(JSON.stringify(seeded, null, 2)));
  process.exit(0);
}

seedAnonymousModeration().catch((error: unknown) => {
  console.error('Anonymous moderation seed failed:', error);
  process.exit(1);
});