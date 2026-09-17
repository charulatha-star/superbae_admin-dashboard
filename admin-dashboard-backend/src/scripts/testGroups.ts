import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { models } from '../models/registry';
import { groupService } from '../services/groupService';

dotenv.config();

async function runTests() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set');
  }
  
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  console.log('\n--- Test 1: Create Group ---');
  const adminId = 'system';
  const adminName = 'System Admin';
  const groupData = {
    name: 'Test Group',
    description: 'A group for testing',
    category: 'Testing',
    owner: 'user123',
    status: 'pending'
  };
  
  const newGroup = await groupService.createGroup(groupData, adminId, adminName);
  console.log('Created Group:', newGroup);

  console.log('\n--- Test 2: List Groups ---');
  const list = await groupService.listGroups({}, 0, 10);
  console.log('Total groups:', list.total);
  
  console.log('\n--- Test 3: Update Group ---');
  const updated = await groupService.updateGroup(newGroup.id as string, { status: 'approved' }, adminId, adminName);
  console.log('Updated Status:', updated?.status);

  console.log('\n--- Test 4: Add Member ---');
  const member = await groupService.addMember(newGroup.id as string, 'user456', 'admin', adminId, adminName);
  console.log('Added Member Role:', member?.role);

  console.log('\n--- Test 5: Fetch Members ---');
  const members = await models.memberships.find({ groupId: newGroup.id });
  console.log('Members count:', members.length);

  console.log('\n--- Test 6: Delete Group ---');
  await groupService.deleteGroup(newGroup.id as string, adminId, adminName);
  const deleted = await groupService.getGroup(newGroup.id as string);
  console.log('Deleted Group exists?', !!deleted);

  await mongoose.disconnect();
}

runTests().catch(console.error);
