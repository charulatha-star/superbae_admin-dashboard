import mongoose from 'mongoose';

let isConnected = false;

export async function connect() {
  if (isConnected) return;
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin-dashboard';
  await mongoose.connect(mongoUri);
  isConnected = true;
  console.log('🛢️ Connected to MongoDB');
}
