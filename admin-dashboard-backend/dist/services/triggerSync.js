"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../config/db");
const registry_1 = require("../models/registry");
const testDbSync_1 = require("./testDbSync");
async function main() {
    console.log('Starting manual test DB sync...\n');
    try {
        // Connect to admin_dashboard database
        await (0, db_1.connectDB)();
        console.log('Connected to admin_dashboard database\n');
        // Run manual sync
        await (0, testDbSync_1.triggerManualSync)(registry_1.models);
        console.log('Manual sync completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Manual sync failed:', error);
        await (0, testDbSync_1.closeTestDbConnection)();
        process.exit(1);
    }
}
main();
