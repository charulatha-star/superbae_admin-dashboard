"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupService = exports.GroupService = void 0;
const crypto_1 = require("crypto");
const registry_1 = require("../models/registry");
const audit_1 = require("../utils/audit");
class GroupService {
    /**
     * Create a new group
     */
    async createGroup(data, adminId, adminName) {
        const groupId = (0, crypto_1.randomUUID)();
        const group = await registry_1.models.groups.create({
            id: groupId,
            name: data.name,
            description: data.description || null,
            category: data.category || null,
            memberCount: 0,
            status: data.status || 'pending',
            owner: data.owner || null,
            organizerId: data.organizerId || null,
            isFeatured: data.isFeatured || false,
            createdAt: new Date(),
        });
        await (0, audit_1.logAudit)(adminId, adminName, 'create_group', 'group', groupId, `Created group "${data.name}"`);
        return group;
    }
    /**
     * Get a group by ID
     */
    async getGroup(groupId) {
        return await registry_1.models.groups.findOne({ id: groupId }).lean();
    }
    /**
     * List all groups with pagination and filtering
     */
    async listGroups(filters, skip, limit) {
        const query = {};
        if (filters.status)
            query.status = filters.status;
        if (filters.category)
            query.category = filters.category;
        if (filters.isFeatured !== undefined)
            query.isFeatured = filters.isFeatured;
        if (filters.search) {
            query.name = { $regex: filters.search, $options: 'i' };
        }
        const [data, total] = await Promise.all([
            registry_1.models.groups.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            registry_1.models.groups.countDocuments(query),
        ]);
        return { data, total };
    }
    /**
     * Update a group
     */
    async updateGroup(groupId, data, adminId, adminName) {
        const group = await registry_1.models.groups.findOneAndUpdate({ id: groupId }, { $set: data }, { new: true }).lean();
        if (group) {
            await (0, audit_1.logAudit)(adminId, adminName, 'update_group', 'group', groupId, `Updated group "${group.name || groupId}"`);
        }
        return group;
    }
    /**
     * Delete a group
     */
    async deleteGroup(groupId, adminId, adminName) {
        const group = await registry_1.models.groups.findOne({ id: groupId }).lean();
        if (!group)
            return false;
        await registry_1.models.groups.deleteOne({ id: groupId });
        await registry_1.models.memberships.deleteMany({ groupId });
        await (0, audit_1.logAudit)(adminId, adminName, 'delete_group', 'group', groupId, `Deleted group "${group.name || groupId}"`);
        return true;
    }
    /**
     * Approve a group
     */
    async approveGroup(groupId, adminId, adminName) {
        return this.updateGroup(groupId, { status: 'approved' }, adminId, adminName);
    }
    /**
     * Reject a group
     */
    async rejectGroup(groupId, adminId, adminName) {
        return this.updateGroup(groupId, { status: 'rejected' }, adminId, adminName);
    }
    /**
     * Add a member/moderator to a group
     */
    async addMember(groupId, userId, role, adminId, adminName) {
        const group = await registry_1.models.groups.findOne({ id: groupId }).lean();
        if (!group)
            return null;
        let membership = await registry_1.models.memberships.findOne({ groupId, userId }).lean();
        if (membership) {
            membership = await registry_1.models.memberships.findOneAndUpdate({ id: membership.id }, { $set: { role, status: 'active', updatedAt: new Date() } }, { new: true }).lean();
        }
        else {
            membership = await registry_1.models.memberships.create({
                id: (0, crypto_1.randomUUID)(),
                userId,
                groupId,
                role,
                joinedAt: new Date(),
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            // Increment memberCount
            await registry_1.models.groups.updateOne({ id: groupId }, { $inc: { memberCount: 1 } });
        }
        await (0, audit_1.logAudit)(adminId, adminName, 'add_group_member', 'group', groupId, `Added user ${userId} as ${role} to group ${groupId}`);
        return membership;
    }
    /**
     * Remove a member/moderator from a group
     */
    async removeMember(groupId, userId, adminId, adminName) {
        const membership = await registry_1.models.memberships.findOne({ groupId, userId }).lean();
        if (!membership)
            return false;
        await registry_1.models.memberships.deleteOne({ id: membership.id });
        // Decrement memberCount
        await registry_1.models.groups.updateOne({ id: groupId }, { $inc: { memberCount: -1 } });
        await (0, audit_1.logAudit)(adminId, adminName, 'remove_group_member', 'group', groupId, `Removed user ${userId} from group ${groupId}`);
        return true;
    }
    /**
     * Fetch group activity (mocked via userActivity or actual implementation)
     * Assuming group activity could be in userActivity or another collection.
     */
    async getGroupActivity(groupId, skip, limit) {
        // Currently, there isn't a dedicated groupActivity collection in registry,
        // we could query userActivity related to this group if there is a groupId field,
        // but userActivity schema doesn't have it explicitly.
        // For now we will return an empty list or implement it if a collection exists.
        return { data: [], total: 0 };
    }
}
exports.GroupService = GroupService;
exports.groupService = new GroupService();
