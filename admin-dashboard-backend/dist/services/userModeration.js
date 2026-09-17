"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyUserModerationAction = applyUserModerationAction;
async function applyUserModerationAction(models, userId, action) {
    const user = await models.users.findOne({ id: userId }).lean();
    if (!user)
        return null;
    if (action === 'warn')
        return user;
    const updates = action === 'ban'
        ? { status: 'suspended', blocked: true }
        : { status: 'suspended' };
    return models.users
        .findOneAndUpdate({ id: userId }, { $set: updates }, { new: true, lean: true })
        .lean();
}
