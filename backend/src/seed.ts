import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import { connectDB } from './config/db';
import { models, ARRAY_RESOURCES, SINGLETON_RESOURCES, LooseDocument } from './models/registry';

const DEFAULT_ADMIN_PASSWORDS: Record<string, string> = {
  'superadmin@example.com': 'superadmin@123',
  'john@example.com': 'john@123',
  'mike@example.com': 'mike@123',
  'priya@example.com': 'priya@123',
  'alex@example.com': 'alex@123',
  'emily@example.com': 'emily@123',
  'content@gmail.com': 'content@123',
};

type SeedData = Record<string, unknown> & {
  admins?: LooseDocument[];
};

async function seed(): Promise<void> {
  await connectDB();

  const dbPath = path.join(__dirname, '../../data/db.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as SeedData;

  if (Array.isArray(data.admins)) {
    data.admins = data.admins.map((admin) => {
      const email = String(admin.email || '').toLowerCase();
      const password = admin.password || DEFAULT_ADMIN_PASSWORDS[email];
      return password ? { ...admin, password } : admin;
    });

    const hasSuperAdmin = data.admins.some(
      (admin) => String(admin.email || '').toLowerCase() === 'superadmin@example.com'
    );

    if (!hasSuperAdmin) {
      data.admins.unshift({
        id: 'admin_001',
        name: 'Super Admin',
        email: 'superadmin@example.com',
        password: 'superadmin@123',
        roleId: 'role_super_admin',
        status: 'active',
        twoFactorEnabled: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    }
  }

  const seededUserIds = Array.isArray(data.users)
    ? data.users.map((user) => String(user.id || '')).filter(Boolean)
    : [];

  // loginHistory, sessions, and userActivity are read-only from the Admin Dashboard's perspective.
  // In production, real app users authenticate through Firebase in the main Super Bae app - this data would be written by that system.
  // This admin backend only displays it. Currently using realistic placeholder data until that integration is confirmed.
  const loginDevices = ['Web', 'Mobile', 'iOS App', 'Android App'];
  const sessionDevices = ['Web', 'Mobile', 'iOS App', 'Android App'];
  const activityActions = [
    'profile_viewed',
    'settings_updated',
    'post_created',
    'comment_added',
    'subscription_renewed',
    'password_changed',
  ];

  data.loginHistory = seededUserIds.flatMap((userId, index) => {
    const recordCount = 2 + (index % 2);
    return Array.from({ length: recordCount }, (_, recordIndex) => ({
      id: `login_${userId}_${String(recordIndex + 1).padStart(3, '0')}`,
      userId,
      loginAt: new Date(Date.UTC(2026, 7, 24 - index - recordIndex, recordIndex === 0 ? 8 : 17, recordIndex === 0 ? 30 : 15)).toISOString(),
      device: loginDevices[(index + recordIndex) % loginDevices.length],
      ipAddress: `192.168.${1 + (index % 3)}.${10 + index * 3 + recordIndex}`,
    }));
  });

  data.sessions = seededUserIds.flatMap((userId, index) => {
    const recordCount = 1 + (index % 2);
    return Array.from({ length: recordCount }, (_, recordIndex) => ({
      id: `session_${userId}_${String(recordIndex + 1).padStart(3, '0')}`,
      userId,
      device: sessionDevices[(index + recordIndex + 1) % sessionDevices.length],
      ipAddress: `192.168.${1 + (index % 3)}.${10 + index * 3 + recordIndex}`,
      lastActiveAt: new Date(Date.UTC(2026, 7, 28 - index - recordIndex, recordIndex === 0 ? 8 : 19, recordIndex === 0 ? 45 : 20)).toISOString(),
    }));
  });

  data.userActivity = seededUserIds.flatMap((userId, index) => {
    const recordCount = 3 + (index % 3);
    return Array.from({ length: recordCount }, (_, recordIndex) => ({
      id: `activity_${userId}_${String(recordIndex + 1).padStart(3, '0')}`,
      userId,
      action: activityActions[(index + recordIndex) % activityActions.length],
      occurredAt: new Date(Date.UTC(2026, 7, 27 - index - recordIndex, 10 + recordIndex)).toISOString(),
    }));
  });

  console.log('Seeding MongoDB database: admin_dashboard');
  console.log(`Source: ${dbPath}`);

  for (const resource of ARRAY_RESOURCES) {
    const items = data[resource];
    if (!Array.isArray(items)) {
      console.log(`- skip ${resource} (missing array in db.json)`);
      continue;
    }

    await models[resource].deleteMany({});
    if (items.length > 0) {
      await models[resource].insertMany(items, { ordered: false });
    }
    console.log(`- ${resource}: ${items.length} docs`);
  }

  for (const resource of SINGLETON_RESOURCES) {
    const value = data[resource];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      console.log(`- skip ${resource} (missing object in db.json)`);
      continue;
    }

    await models[resource].deleteMany({});
    await models[resource].create({ ...(value as LooseDocument), _singleton: resource });
    console.log(`- ${resource}: 1 doc`);
  }

  const adminCount = await models.admins.countDocuments();
  const superAdmin = await models.admins
    .findOne({ email: 'superadmin@example.com' })
    .lean<LooseDocument | null>();

  console.log(`\nAdmins in DB: ${adminCount}`);
  console.log(
    `Super Admin: ${superAdmin ? `${superAdmin.email} / ${superAdmin.password}` : 'MISSING'}`
  );
  console.log('Seed completed. Check collections in MongoDB Compass (admin_dashboard).');
  process.exit(0);
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});





