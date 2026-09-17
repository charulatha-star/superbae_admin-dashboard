import { randomUUID } from 'crypto';
import { models } from '../models/registry';

export async function logAudit(
  adminId: string,
  adminName: string,
  action: string,
  targetType: string,
  targetId: string,
  description: string,
  reason?: string
): Promise<void> {
  try {
    await models.auditLogs.create({
      id: randomUUID(),
      adminId,
      adminName,
      action,
      targetType,
      targetId,
      description,
      reason: reason || null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
