"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./config/db");
const routes_1 = require("./routes");
const testDbSync_1 = require("./services/testDbSync");
const registry_1 = require("./models/registry");
function errorMessage(error) {
    return error instanceof Error ? error.message : 'Internal server error';
}
let server = null;
async function start() {
    await (0, db_1.connectDB)();
    // Start auto-sync if enabled
    (0, testDbSync_1.startAutoSync)(registry_1.models);
    const app = (0, express_1.default)();
    const port = process.env.PORT || 3001;
    app.use((0, cors_1.default)({
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    }));
    app.use(express_1.default.json({ limit: '2mb' }));
    (0, routes_1.registerRoutes)(app);
    const errorHandler = (err, _req, res, next) => {
        void next;
        console.error(err);
        res.status(500).json({ message: errorMessage(err) });
    };
    app.use(errorHandler);
    server = app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
    });
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('\nSIGTERM received. Shutting down gracefully...');
        (0, testDbSync_1.stopAutoSync)();
        await (0, testDbSync_1.closeTestDbConnection)();
        server?.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
    process.on('SIGINT', async () => {
        console.log('\nSIGINT received. Shutting down gracefully...');
        (0, testDbSync_1.stopAutoSync)();
        await (0, testDbSync_1.closeTestDbConnection)();
        server?.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
}
start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
