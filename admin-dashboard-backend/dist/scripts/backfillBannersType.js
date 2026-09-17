"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
/**
 * Backfill script for banners collection to add the new 'type' field.
 *
 * Ensures all existing banner documents have type: 'banner' set.
 * Safe to re-run: only updates documents where type is missing.
 *
 * Usage: npx tsx src/scripts/backfillBannersType.ts
 * DO NOT import or run automatically
 */
async function backfillBannersType() {
    await (0, db_1.connectDB)();
    console.log('Banners type field backfill starting...\n');
    const collection = registry_1.models.banners;
    if (!collection) {
        console.error('No model for resource "banners", aborting.');
        process.exit(1);
    }
    const docs = await collection.find({}).lean();
    let updated = 0;
    let skipped = 0;
    for (const doc of docs) {
        const docId = typeof doc.id === 'string' ? doc.id : String(doc._id || 'unknown');
        if (doc.type === undefined) {
            await collection.updateOne({ id: docId }, { $set: { type: 'banner' } });
            updated++;
            console.log(`  banners ${docId}: backfilled type = 'banner'`);
        }
        else {
            skipped++;
        }
    }
    console.log(`\nBanners: ${updated} updated, ${skipped} already had type field.`);
    console.log('=== Banners type backfill complete ===');
    await mongoose_1.default.disconnect();
    process.exit(0);
}
backfillBannersType()
    .catch((error) => {
    console.error('Banners type backfill failed:', error);
    process.exit(1);
})
    .finally(async () => {
    await mongoose_1.default.disconnect();
});
