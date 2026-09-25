// src/models/notification.ts
import { Schema, model, Document } from 'mongoose';
import { createId } from '../utils/ids';

export interface NotificationSendResultRecord {
  targeted: number;
  successful: number;
  failed: number;
  skipped: number;
  /**
   * Step 8 (additive): explicit delivery discriminator. Never 'no_devices'
   * here: a zero-device no-op writes no sendResult at all, so a null
   * sendResult is the documented marker for "no delivery was ever attempted".
   */
  outcome?: 'sent' | 'partial' | 'failed';
  at: string;
  failures?: Array<{
    deviceTokenId: string;
    userId: string;
    tokenMask: string;
    code: string;
    message: string;
  }>;
}

export interface Notification extends Document {
  id: string;
  title: string;
  body: string;
  channel: 'push' | 'sms';
  scheduleAt?: Date;
  segmentId?: string;
  templateId?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  /** Actual send bookkeeping (Step 5, additive): set only when delivery was attempted. */
  sentAt?: Date | null;
  sendResult?: NotificationSendResultRecord | null;
  /** Step 6 (additive): transient dispatcher claim / zero-device backoff marker. */
  scheduledClaimedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>({
  id: { type: String, default: () => createId('notification') },
  title: { type: String, required: true },
  body: { type: String, required: true },
  channel: { type: String, enum: ['push', 'sms'], default: 'push' },
  scheduleAt: { type: Date },
  segmentId: { type: String },
  templateId: { type: String },
  status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed'], default: 'draft' },
  // Additive send bookkeeping (never set for zero-device no-op sends).
  sentAt: { type: Date, default: null },
  sendResult: { type: Schema.Types.Mixed, default: null },
  // Step 6 (additive): transient dispatcher claim — atomic anti-duplicate
  // marker; future values act as zero-device retry backoff.
  scheduledClaimedAt: { type: Date, default: null },
}, { timestamps: true });

export const NotificationModel = model<Notification>('Notification', notificationSchema);
