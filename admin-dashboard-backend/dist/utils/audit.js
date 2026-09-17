"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const crypto_1 = require("crypto");
const registry_1 = require("../models/registry");
async function logAudit(adminId, adminName, action, targetType, targetId, description, reason) {
    try {
        await registry_1.models.auditLogs.create({
            id: (0, crypto_1.randomUUID)(),
            adminId,
            adminName,
            action,
            targetType,
            targetId,
            description,
            reason: reason || null,
            createdAt: new Date(),
        });
    }
    catch (error) {
        console.error('Failed to write audit log:', error);
    }
}
