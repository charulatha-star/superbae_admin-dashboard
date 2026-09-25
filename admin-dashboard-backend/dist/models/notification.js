"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModel = void 0;
// src/models/notification.ts
const mongoose_1 = require("mongoose");
const ids_1 = require("../utils/ids");
const notificationSchema = new mongoose_1.Schema({
    id: { type: String, default: () => (0, ids_1.createId)('notification') },
    title: { type: String, required: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['push', 'sms'], default: 'push' },
    scheduleAt: { type: Date },
    segmentId: { type: String },
    templateId: { type: String },
    status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed'], default: 'draft' },
    // Additive send bookkeeping (never set for zero-device no-op sends).
    sentAt: { type: Date, default: null },
    sendResult: { type: mongoose_1.Schema.Types.Mixed, default: null },
    // Step 6 (additive): transient dispatcher claim — atomic anti-duplicate
    // marker; future values act as zero-device retry backoff.
    scheduledClaimedAt: { type: Date, default: null },
}, { timestamps: true });
exports.NotificationModel = (0, mongoose_1.model)('Notification', notificationSchema);
