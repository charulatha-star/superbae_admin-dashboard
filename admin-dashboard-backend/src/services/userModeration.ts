import { LooseDocument, ModelRegistry } from '../models/registry';

export type UserModerationAction = 'warn' | 'suspend' | 'ban';

export async function applyUserModerationAction(
  models: ModelRegistry,
  userId: string,
  action: UserModerationAction,
): Promise<LooseDocument | null> {
  const user = await models.users.findOne({ id: userId }).lean<LooseDocument | null>();
  if (!user) return null;
  if (action === 'warn') return user;

  const updates: LooseDocument = action === 'ban'
    ? { status: 'suspended', blocked: true }
    : { status: 'suspended' };

  return models.users
    .findOneAndUpdate({ id: userId }, { $set: updates }, { new: true, lean: true })
    .lean<LooseDocument | null>();
}