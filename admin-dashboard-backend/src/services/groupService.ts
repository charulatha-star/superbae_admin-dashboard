import { randomUUID } from 'crypto';
import { models, LooseDocument } from '../models/registry';
import { logAudit } from '../utils/audit';

export class GroupService {
  /**
   * Create a new group
   */
  async createGroup(data: any, adminId: string, adminName: string): Promise<LooseDocument> {
    const groupId = randomUUID();
    const group = await models.groups.create({
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

    await logAudit(
      adminId,
      adminName,
      'create_group',
      'group',
      groupId,
      `Created group "${data.name}"`
    );

    return group;
  }

  /**
   * Get a group by ID
   */
  async getGroup(groupId: string): Promise<LooseDocument | null> {
    return await models.groups.findOne({ id: groupId }).lean();
  }

  /**
   * List all groups with pagination and filtering
   */
  async listGroups(filters: any, skip: number, limit: number): Promise<{ data: LooseDocument[], total: number }> {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.isFeatured !== undefined) query.isFeatured = filters.isFeatured;
    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      models.groups.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      models.groups.countDocuments(query),
    ]);

    return { data, total };
  }

  /**
   * Update a group
   */
  async updateGroup(groupId: string, data: any, adminId: string, adminName: string): Promise<LooseDocument | null> {
    const group = await models.groups.findOneAndUpdate(
      { id: groupId },
      { $set: data },
      { new: true }
    ).lean();

    if (group) {
      await logAudit(
        adminId,
        adminName,
        'update_group',
        'group',
        groupId,
        `Updated group "${group.name || groupId}"`
      );
    }
    return group;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string, adminId: string, adminName: string): Promise<boolean> {
    const group = await models.groups.findOne({ id: groupId }).lean();
    if (!group) return false;

    await models.groups.deleteOne({ id: groupId });
    await models.memberships.deleteMany({ groupId });

    await logAudit(
      adminId,
      adminName,
      'delete_group',
      'group',
      groupId,
      `Deleted group "${group.name || groupId}"`
    );

    return true;
  }

  /**
   * Approve a group
   */
  async approveGroup(groupId: string, adminId: string, adminName: string): Promise<LooseDocument | null> {
    return this.updateGroup(groupId, { status: 'approved' }, adminId, adminName);
  }

  /**
   * Reject a group
   */
  async rejectGroup(groupId: string, adminId: string, adminName: string): Promise<LooseDocument | null> {
    return this.updateGroup(groupId, { status: 'rejected' }, adminId, adminName);
  }

  /**
   * Add a member/moderator to a group
   */
  async addMember(groupId: string, userId: string, role: string, adminId: string, adminName: string): Promise<LooseDocument | null> {
    const group = await models.groups.findOne({ id: groupId }).lean();
    if (!group) return null;

    let membership = await models.memberships.findOne({ groupId, userId }).lean();
    if (membership) {
      membership = await models.memberships.findOneAndUpdate(
        { id: membership.id },
        { $set: { role, status: 'active', updatedAt: new Date() } },
        { new: true }
      ).lean();
    } else {
      membership = await models.memberships.create({
        id: randomUUID(),
        userId,
        groupId,
        role,
        joinedAt: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Increment memberCount
      await models.groups.updateOne({ id: groupId }, { $inc: { memberCount: 1 } });
    }

    await logAudit(
      adminId,
      adminName,
      'add_group_member',
      'group',
      groupId,
      `Added user ${userId} as ${role} to group ${groupId}`
    );

    return membership;
  }

  /**
   * Remove a member/moderator from a group
   */
  async removeMember(groupId: string, userId: string, adminId: string, adminName: string): Promise<boolean> {
    const membership = await models.memberships.findOne({ groupId, userId }).lean();
    if (!membership) return false;

    await models.memberships.deleteOne({ id: membership.id });
    
    // Decrement memberCount
    await models.groups.updateOne({ id: groupId }, { $inc: { memberCount: -1 } });

    await logAudit(
      adminId,
      adminName,
      'remove_group_member',
      'group',
      groupId,
      `Removed user ${userId} from group ${groupId}`
    );

    return true;
  }

  /**
   * Fetch group activity (mocked via userActivity or actual implementation)
   * Assuming group activity could be in userActivity or another collection.
   */
  async getGroupActivity(groupId: string, skip: number, limit: number) {
    // Currently, there isn't a dedicated groupActivity collection in registry,
    // we could query userActivity related to this group if there is a groupId field,
    // but userActivity schema doesn't have it explicitly.
    // For now we will return an empty list or implement it if a collection exists.
    return { data: [], total: 0 };
  }
}

export const groupService = new GroupService();
