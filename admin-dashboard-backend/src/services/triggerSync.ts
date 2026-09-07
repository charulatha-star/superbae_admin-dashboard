import 'dotenv/config';
import { connectDB } from '../config/db';
import { models } from '../models/registry';
import { triggerManualSync, closeTestDbConnection } from './testDbSync';

async function main(): Promise<void> {
  console.log('Starting manual test DB sync...\n');

  try {
    // Connect to admin_dashboard database
    await connectDB();
    console.log('Connected to admin_dashboard database\n');

    // Run manual sync
    await triggerManualSync(models);

    console.log('Manual sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Manual sync failed:', error);
    await closeTestDbConnection();
    process.exit(1);
  }
}

main();
