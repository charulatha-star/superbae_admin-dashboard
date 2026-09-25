// src/models/deviceToken.ts
import { Schema, model, Document } from 'mongoose';
import { createId } from '../utils/ids';

/**
 * FCM device tokens for Super Bae MOBILE APP users (not admins).
 *
 * Deliberately a standalone model (same pattern as notification.ts / club.ts)
 * and NOT registered in models/registry.ts: registry collections are served
 * by the auth-only generic CRUD loop, which must never expose device tokens.
 *
 * userId matches the existing users collection ID style: a plain string
 * (the main Super Bae app owns real user authentication; see seed.ts note),
 * never a MongoDB ObjectId.
 * No seed data is created for this collection.
 */

export type DeviceTokenPlatform = 'android' | 'ios';

export const DEVICE_TOKEN_PLATFORMS: DeviceTokenPlatform[] = ['android', 'ios'];

export interface DeviceTokenDoc extends Document {
  id: string;
  userId: string;
  token: string;
  platform: DeviceTokenPlatform;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<DeviceTokenDoc>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => createId('deviceToken'),
    },
    userId: { type: String, required: true, index: true },
    // One record per FCM token; the unique index makes duplicate registration
    // impossible at the storage layer (re-registration updates the record).
    token: { type: String, required: true, unique: true, index: true },
    platform: { type: String, required: true, enum: DEVICE_TOKEN_PLATFORMS },
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'deviceTokens' }
);

export const DeviceTokenModel = model<DeviceTokenDoc>('DeviceToken', deviceTokenSchema);
