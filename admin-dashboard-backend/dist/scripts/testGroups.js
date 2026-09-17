"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const registry_1 = require("../models/registry");
const groupService_1 = require("../services/groupService");
dotenv.config();
async function runTests() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI not set');
    }
    await mongoose_1.default.connect(uri);
    console.log('Connected to MongoDB');
    console.log('\n--- Test 1: Create Group ---');
    const adminId = 'system';
    const adminName = 'System Admin';
    const groupData = {
        name: 'Test Group',
        description: 'A group for testing',
        category: 'Testing',
        owner: 'user123',
        status: 'pending'
    };
    const newGroup = await groupService_1.groupService.createGroup(groupData, adminId, adminName);
    console.log('Created Group:', newGroup);
    console.log('\n--- Test 2: List Groups ---');
    const list = await groupService_1.groupService.listGroups({}, 0, 10);
    console.log('Total groups:', list.total);
    console.log('\n--- Test 3: Update Group ---');
    const updated = await groupService_1.groupService.updateGroup(newGroup.id, { status: 'approved' }, adminId, adminName);
    console.log('Updated Status:', updated?.status);
    console.log('\n--- Test 4: Add Member ---');
    const member = await groupService_1.groupService.addMember(newGroup.id, 'user456', 'admin', adminId, adminName);
    console.log('Added Member Role:', member?.role);
    console.log('\n--- Test 5: Fetch Members ---');
    const members = await registry_1.models.memberships.find({ groupId: newGroup.id });
    console.log('Members count:', members.length);
    console.log('\n--- Test 6: Delete Group ---');
    await groupService_1.groupService.deleteGroup(newGroup.id, adminId, adminName);
    const deleted = await groupService_1.groupService.getGroup(newGroup.id);
    console.log('Deleted Group exists?', !!deleted);
    await mongoose_1.default.disconnect();
}
runTests().catch(console.error);
