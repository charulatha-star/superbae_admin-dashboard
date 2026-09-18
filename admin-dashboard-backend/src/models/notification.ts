// src/models/notification.ts
import { Schema, model, Document } from 'mongoose';
import { createId } from '../utils/ids';

export interface Notification extends Document {
  id: string;
  title: string;
  body: string;
  channel: 'push' | 'email' | 'sms';
  scheduleAt?: Date;
  segmentId?: string;
  templateId?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>({
  id: { type: String, default: () => createId('notification') },
  title: { type: String, required: true },
  body: { type: String, required: true },
  channel: { type: String, enum: ['push', 'email', 'sms'], default: 'push' },
  scheduleAt: { type: Date },
  segmentId: { type: String },
  templateId: { type: String },
  status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed'], default: 'draft' },
}, { timestamps: true });

export const NotificationModel = model<Notification>('Notification', notificationSchema);
