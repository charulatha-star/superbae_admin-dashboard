import mongoose, { Model, Document } from 'mongoose';
import cron from 'node-cron';
import { LooseDocument } from '../models/registry';

// Interface for users from the test database
interface TestUser {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  [key: string]: unknown;
}

// Interface for users in admin_dashboard
interface AdminDashboardUser extends LooseDocument {
  id: string;
  name: string;
  phone?: string;
  status?: string;
  plan?: string;
  joinedAt?: Date | string;
  lastSeen?: Date | string;
  posts?: number;
  groups?: number;
}

// Connection cache for test database
let testDbConnection: mongoose.Connection | null = null;

/**
 * Get a read-only connection to the test database
 */
async function getTestDbConnection(): Promise<mongoose.Connection> {
  if (testDbConnection && testDbConnection.readyState === 1) {
    return testDbConnection;
  }

  const testUri = process.env.TEST_MONGODB_URI;
  if (!testUri) {
    throw new Error('TEST_MONGODB_URI is missing. Cannot connect to test database.');
  }

  // Create a separate connection for the test database
  const conn = mongoose.createConnection(testUri, {
    readPreference: 'primary',
    retryWrites: false,
  });

  testDbConnection = conn;
  return conn;
}

/**
 * Close the test database connection
 */
export async function closeTestDbConnection(): Promise<void> {
  if (testDbConnection) {
    await testDbConnection.close();
    testDbConnection = null;
  }
}

// Result type for sync operations
export interface SyncResult {
  timestamp: string;
  testUsersFound: number;
  created: number;
  updated: number;
  errors: string[];
  skipped: number;
}

/**
 * Perform a single sync run from test.users to admin_dashboard.users
 */
export async function syncTestUsersToAdmin(models: Record<string, Model<LooseDocument>>): Promise<SyncResult> {
  const errors: string[] = [];
  let testUsersFound = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // Connect to test database
    const testConn = await getTestDbConnection();
    const TestUserModel = testConn.model<TestUser>('User', new mongoose.Schema({}, { strict: false }));

    // Get all users from test database
    const testUsers: TestUser[] = await TestUserModel.find({}).lean();
    testUsersFound = testUsers.length;

    const adminUserModel = models.users;

    // Process each user from test database
    for (const testUser of testUsers) {
      try {
        // Normalize phone number for matching (remove spaces, dashes, plus signs)
        const phone = String(testUser.phone || '').replace(/[\s\-+()]/g, '');
        const name = String(testUser.name || '');

        // Skip users without a phone number (can't match)
        if (!phone) {
          skipped++;
          continue;
        }

        // Check if user exists in admin_dashboard by phone
        const existingUser = await adminUserModel.findOne({ phone }).lean<AdminDashboardUser | null>();

        if (!existingUser) {
          // Create new user with defaults
          const newUser: AdminDashboardUser = {
            id: `user_${phone}_${Date.now()}`,
            name,
            phone,
            status: 'active',
            plan: 'free',
            joinedAt: new Date(),
            lastSeen: new Date(),
            posts: 0,
            groups: 0,
          };

          await adminUserModel.create(newUser);
          created++;
        } else {
          // Update only name and phone, preserve all other admin_dashboard fields
          const update: Partial<AdminDashboardUser> = {
            name,
            phone,
          };

          await adminUserModel.findOneAndUpdate(
            { phone },
            { $set: update },
            { new: true, lean: true }
          );
          updated++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync user ${testUser.name || testUser.phone || testUser._id}: ${errorMessage}`);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      testUsersFound,
      created,
      updated,
      errors,
      skipped,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Sync failed: ${errorMessage}`);
    return {
      timestamp: new Date().toISOString(),
      testUsersFound: 0,
      created: 0,
      updated: 0,
      errors,
      skipped: 0,
    };
  }
}

/**
 * Log sync results to console
 */
function logSyncResult(result: SyncResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('TEST DB SYNC RUN');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Users found in test DB: ${result.testUsersFound}`);
  console.log(`Users created in admin_dashboard: ${result.created}`);
  console.log(`Users updated in admin_dashboard: ${result.updated}`);
  console.log(`Users skipped (no phone): ${result.skipped}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((error) => console.log(`  - ${error}`));
  } else {
    console.log('\nNo errors');
  }
  console.log('='.repeat(60) + '\n');
}

// Scheduled job reference
let scheduledJob: cron.ScheduledTask | null = null;

/**
 * Start the automatic sync job (runs every 5 minutes)
 */
export function startAutoSync(models: Record<string, Model<LooseDocument>>): void {
  const enabled = process.env.ENABLE_TEST_DB_SYNC === 'true';
  
  if (!enabled) {
    console.log('[Test DB Sync] Auto-sync is disabled (ENABLE_TEST_DB_SYNC=false)');
    return;
  }

  console.log('[Test DB Sync] Starting auto-sync every 5 minutes...');

  // Run immediately on start
  console.log('[Test DB Sync] Running initial sync...');
  syncTestUsersToAdmin(models).then(logSyncResult).catch((error) => {
    console.error('[Test DB Sync] Error during initial sync:', error);
  });

  // Then every 5 minutes
  scheduledJob = cron.schedule(
    '*/5 * * * *', // Every 5 minutes
    async () => {
      try {
        const result = await syncTestUsersToAdmin(models);
        logSyncResult(result);
      } catch (error) {
        console.error('[Test DB Sync] Error during scheduled sync:', error);
      }
    }
  );

  console.log('[Test DB Sync] Auto-sync cron job started');
}

/**
 * Stop the automatic sync job
 */
export function stopAutoSync(): void {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('[Test DB Sync] Auto-sync cron job stopped');
  }
}

/**
 * Manually trigger a sync run
 */
export async function triggerManualSync(models: Record<string, Model<LooseDocument>>): Promise<void> {
  console.log('[Test DB Sync] Starting manual sync...');
  const result = await syncTestUsersToAdmin(models);
  logSyncResult(result);
  await closeTestDbConnection();
}
