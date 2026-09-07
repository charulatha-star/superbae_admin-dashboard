import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';

/**
 * Script to list and optionally drop the email_1 index from admin_dashboard.users
 * This index was left over from when the email field was in the schema.
 */

async function listUserIndexes(): Promise<void> {
  await connectDB();
  
  const conn = mongoose.connection;
  const db = conn.db;
  
  if (!db) {
    throw new Error('Database connection not established');
  }
  
  console.log('Connected to database.\n');
  
  // Get the users collection
  const usersCollection = db.collection('users');
  
  // List all indexes
  const indexes = await usersCollection.indexes();
  
  console.log('Current indexes on admin_dashboard.users:');
  console.log('='.repeat(60));
  
  for (const index of indexes) {
    console.log(`Name: ${index.name}`);
    console.log(`  Keys: ${JSON.stringify(index.key)}`);
    console.log(`  Unique: ${index.unique ? 'YES' : 'NO'}`);
    console.log(`  Sparse: ${index.sparse ? 'YES' : 'NO'}`);
    console.log('---');
  }
  
  console.log('='.repeat(60));
  
  // Check if email_1 index exists
  const hasEmailIndex = indexes.some(idx => idx.name === 'email_1');
  console.log(`\nemail_1 index exists: ${hasEmailIndex ? 'YES' : 'NO'}`);
  
  await mongoose.disconnect();
}

async function dropEmailIndex(): Promise<void> {
  await connectDB();
  
  const conn = mongoose.connection;
  const db = conn.db;
  
  if (!db) {
    throw new Error('Database connection not established');
  }
  
  console.log('Connected to database.\n');
  
  // Get the users collection
  const usersCollection = db.collection('users');
  
  // Drop the email_1 index
  try {
    const result = await usersCollection.dropIndex('email_1');
    console.log('✓ Successfully dropped email_1 index');
    console.log(`  Result: ${result}`);
  } catch (error) {
    console.error('✗ Failed to drop email_1 index:');
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
  
  // Verify it's gone
  const indexes = await usersCollection.indexes();
  const hasEmailIndex = indexes.some(idx => idx.name === 'email_1');
  
  if (!hasEmailIndex) {
    console.log('✓ Verified: email_1 index no longer exists');
  } else {
    console.error('✗ Warning: email_1 index still exists after drop attempt');
  }
  
  console.log('\nRemaining indexes on admin_dashboard.users:');
  for (const index of indexes) {
    console.log(`  - ${index.name}`);
  }
  
  await mongoose.disconnect();
}

async function main(): Promise<void> {
  const action = process.argv[2];
  
  if (action === 'list') {
    await listUserIndexes();
  } else if (action === 'drop') {
    await dropEmailIndex();
  } else {
    console.log('Usage:');
    console.log('  npm run build && node dist/scripts/fixUserIndexes.js list');
    console.log('  npm run build && node dist/scripts/fixUserIndexes.js drop');
    console.log('\nOr:');
    console.log('  npm run fix:indexes list');
    console.log('  npm run fix:indexes drop');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
