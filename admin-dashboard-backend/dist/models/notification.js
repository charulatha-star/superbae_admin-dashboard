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
    channel: { type: String, enum: ['push', 'email', 'sms'], default: 'push' },
    scheduleAt: { type: Date },
    segmentId: { type: String },
    templateId: { type: String },
    status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed'], default: 'draft' },
}, { timestamps: true });
exports.NotificationModel = (0, mongoose_1.model)('Notification', notificationSchema);
