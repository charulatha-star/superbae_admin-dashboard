import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { groupService } from '../services/groupService';
import { models } from '../models/registry';

export function createGroupsRouter() {
  const router = express.Router();

  // Apply auth to all group routes
  router.use(requireAuth);

  // Helper to get admin details for audit
  const getAdminContext = (req: express.Request) => ({
    adminId: String(req.currentAdmin?.id || 'system'),
    adminName: String(req.currentAdmin?.name || 'System'),
  });

  // GET /groups - List groups with pagination and filtering
  router.get('/', requirePermission('groups.view'), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filters = {
        status: req.query.status,
        category: req.query.category,
        isFeatured: req.query.isFeatured !== undefined ? req.query.isFeatured === 'true' : undefined,
        search: req.query.search,
      };

      const result = await groupService.listGroups(filters, skip, limit);
      res.json({
        success: true,
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // POST /groups - Create a group
  router.post('/', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const group = await groupService.createGroup(req.body, adminId, adminName);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // GET /groups/:id - Get a group
  router.get('/:id', requirePermission('groups.view'), async (req, res) => {
    try {
      const group = await groupService.getGroup(String(req.params.id));
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // PUT /groups/:id - Update a group
  router.put('/:id', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const group = await groupService.updateGroup(String(req.params.id), req.body, adminId, adminName);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // DELETE /groups/:id - Delete a group
  router.delete('/:id', requirePermission('groups.delete'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const success = await groupService.deleteGroup(String(req.params.id), adminId, adminName);
      if (!success) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // POST /groups/:id/approve - Approve a group
  router.post('/:id/approve', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const group = await groupService.approveGroup(String(req.params.id), adminId, adminName);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // POST /groups/:id/reject - Reject a group
  router.post('/:id/reject', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const group = await groupService.rejectGroup(String(req.params.id), adminId, adminName);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // POST /groups/:id/feature - Feature a group
  router.post('/:id/feature', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const isFeatured = req.body.isFeatured !== false; // default true if not provided
      const group = await groupService.updateGroup(String(req.params.id), { isFeatured }, adminId, adminName);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // GET /groups/:id/members - List members
  router.get('/:id/members', requirePermission('groups.view'), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [memberships, total] = await Promise.all([
        models.memberships.find({ groupId: String(req.params.id) }).skip(skip).limit(limit).lean(),
        models.memberships.countDocuments({ groupId: String(req.params.id) }),
      ]);

      res.json({
        success: true,
        data: memberships,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // POST /groups/:id/members - Add member/moderator
  router.post('/:id/members', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const { userId, role = 'member' } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

      const membership = await groupService.addMember(String(req.params.id), userId, role, adminId, adminName);
      if (!membership) return res.status(404).json({ success: false, message: 'Group not found' });
      res.json({ success: true, data: membership });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  // DELETE /groups/:id/members/:userId - Remove member
  router.delete('/:id/members/:userId', requirePermission('groups.manage'), async (req, res) => {
    try {
      const { adminId, adminName } = getAdminContext(req);
      const success = await groupService.removeMember(String(req.params.id), String(req.params.userId), adminId, adminName);
      if (!success) return res.status(404).json({ success: false, message: 'Member or Group not found' });
      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unexpected error' });
    }
  });

  return router;
}
