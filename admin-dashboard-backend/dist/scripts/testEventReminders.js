"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const eventReminders_1 = require("../services/eventReminders");
async function testEventReminders() {
    await (0, db_1.connectDB)();
    const suffix = (0, crypto_1.randomUUID)();
    const ids = {
        inWindowEnabled: `test_reminder_in_window_${suffix}`,
        disabled: `test_reminder_disabled_${suffix}`,
        outsideWindow: `test_reminder_outside_${suffix}`,
        alreadySent: `test_reminder_sent_${suffix}`,
        pastEvent: `test_reminder_past_${suffix}`,
    };
    try {
        await registry_1.models.events.create([
            { id: ids.inWindowEnabled, title: 'In Window', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
            { id: ids.disabled, title: 'Disabled', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: false, sendBeforeHours: 24 }, reminderSentAt: null },
            { id: ids.outsideWindow, title: 'Outside', type: 'online', date: new Date(Date.now() + 48 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
            { id: ids.alreadySent, title: 'Sent', type: 'online', date: new Date(Date.now() + 12 * 60 * 60 * 1000), status: 'upcoming', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: new Date(Date.now() - 1000) },
            { id: ids.pastEvent, title: 'Past', type: 'online', date: new Date(Date.now() - 12 * 60 * 60 * 1000), status: 'completed', category: 'Testing', capacity: 5, reminderConfig: { enabled: true, sendBeforeHours: 24 }, reminderSentAt: null },
        ]);
        const now = new Date();
        const firstRun = await (0, eventReminders_1.processEventReminders)(registry_1.models, now);
        if (firstRun !== 1)
            throw new Error(`Expected 1 reminder on first run, got ${firstRun}.`);
        const sentEvent = await registry_1.models.events.findOne({ id: ids.inWindowEnabled }).lean();
        if (!sentEvent?.reminderSentAt)
            throw new Error('Expected in-window event to be marked as reminded.');
        const secondRun = await (0, eventReminders_1.processEventReminders)(registry_1.models, now);
        if (secondRun !== 0)
            throw new Error(`Expected 0 reminders on second run, got ${secondRun}.`);
        const disabledEvent = await registry_1.models.events.findOne({ id: ids.disabled }).lean();
        if (disabledEvent?.reminderSentAt)
            throw new Error('Expected disabled event to remain unmarked.');
        const outsideEvent = await registry_1.models.events.findOne({ id: ids.outsideWindow }).lean();
        if (outsideEvent?.reminderSentAt)
            throw new Error('Expected outside-window event to remain unmarked.');
        const pastEvent = await registry_1.models.events.findOne({ id: ids.pastEvent }).lean();
        if (pastEvent?.reminderSentAt)
            throw new Error('Expected past event to remain unmarked.');
        const alreadySentEvent = await registry_1.models.events.findOne({ id: ids.alreadySent }).lean();
        if (!alreadySentEvent?.reminderSentAt)
            throw new Error('Expected already-sent event to keep its original reminderSentAt.');
        const logs = [];
        const customRun = await (0, eventReminders_1.processEventReminders)(registry_1.models, new Date(), (message) => logs.push(message));
        if (customRun !== 0)
            throw new Error(`Expected 0 reminders on custom-log run, got ${customRun}.`);
        (0, eventReminders_1.startEventReminderJob)(registry_1.models);
        await new Promise((resolve) => setTimeout(resolve, 100));
        (0, eventReminders_1.stopEventReminderJob)();
        console.log('Event reminders Phase 8 test passed.');
    }
    finally {
        await Promise.all([
            registry_1.models.events.deleteMany({ id: { $in: [ids.inWindowEnabled, ids.disabled, ids.outsideWindow, ids.alreadySent, ids.pastEvent] } }),
        ]);
        await mongoose_1.default.disconnect();
    }
}
testEventReminders().catch((error) => {
    console.error('Event reminders Phase 8 test failed:', error);
    process.exitCode = 1;
});
