// src/services/deviceTokens.ts
import { createId } from '../utils/ids';
import { cleanDoc } from '../utils/clean';
import { LooseDocument } from '../models/registry';
import {
  DeviceTokenModel,
  DEVICE_TOKEN_PLATFORMS,
  DeviceTokenPlatform,
} from '../models/deviceToken';

/**
 * Device-token foundation (Step 3). Registration/deactivation logic only —
 * NO HTTP endpoint is exposed yet because the backend has NO mobile-user
 * authentication middleware: /auth/* is admin-session-based (adminSessions),
 * and real app users authenticate through Firebase in the main Super Bae app.
 * Exposing register/deactivate without user authentication would let anyone
 * bind arbitrary tokens to arbitrary users, so the route is intentionally
 * deferred until the mobile-team authentication dependency lands.
 *
 * Every function takes the userId as a server-side parameter — never from a
 * request body — so the future authenticated route stays trivially safe.
 * No delivery/sending logic exists here.
 */

export class DeviceTokenInputError extends Error {
  statusCode = 400;
}

const PLATFORM_SET = new Set<string>(DEVICE_TOKEN_PLATFORMS);

function platformValue(value: unknown): DeviceTokenPlatform {
  const s = String(value ?? '').trim().toLowerCase();
  if (!PLATFORM_SET.has(s)) {
    throw new DeviceTokenInputError(`platform must be one of: ${DEVICE_TOKEN_PLATFORMS.join(', ')}.`);
  }
  return s as DeviceTokenPlatform;
}

function tokenValue(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) throw new DeviceTokenInputError('token is required.');
  if (s.length < 16) {
    throw new DeviceTokenInputError('token does not have the shape of a valid FCM registration token.');
  }
  return s;
}

function userIdValue(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) throw new DeviceTokenInputError('userId is required.');
  return s;
}

/**
 * Creates or refreshes a device registration, keyed by the FCM token itself:
 *  - unknown token  -> new record (id assigned server-side);
 *  - known token    -> same record updated (userId/platform refreshed,
 *                      isActive restored to true, lastSeenAt bumped);
 *  - duplicate records are impossible (unique index on token).
 */
export async function registerDeviceToken(
  userId: unknown,
  token: unknown,
  platform: unknown
): Promise<LooseDocument> {
  const cleanUserId = userIdValue(userId);
  const cleanToken = tokenValue(token);
  const cleanPlatform = platformValue(platform);

  const updated = await DeviceTokenModel.findOneAndUpdate(
    { token: cleanToken },
    {
      $set: {
        userId: cleanUserId,
        platform: cleanPlatform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      $setOnInsert: { id: createId('deviceToken') },
    },
    { new: true, upsert: true, lean: true }
  );

  if (!updated) throw new Error('Device token registration failed.');
  return cleanDoc(updated as unknown as LooseDocument);
}

/** Deactivates one token for one user. Returns null when the pair is unknown. */
export async function deactivateDeviceToken(
  userId: unknown,
  token: unknown
): Promise<LooseDocument | null> {
  const cleanUserId = userIdValue(userId);
  const cleanToken = tokenValue(token);
  const updated = await DeviceTokenModel.findOneAndUpdate(
    { userId: cleanUserId, token: cleanToken },
    { $set: { isActive: false } },
    { new: true, lean: true }
  );
  return updated ? cleanDoc(updated as unknown as LooseDocument) : null;
}

/** Deactivates every active token of a user (logout-everywhere semantics). */
export async function deactivateAllDeviceTokens(userId: unknown): Promise<{ matchedCount: number; modifiedCount: number }> {
  const cleanUserId = userIdValue(userId);
  const result = await DeviceTokenModel.updateMany(
    { userId: cleanUserId, isActive: true },
    { $set: { isActive: false } }
  );
  return { matchedCount: result.matchedCount ?? 0, modifiedCount: result.modifiedCount ?? 0 };
}

/** Active tokens for a user — the exact input a future send service will consume. */
export async function listActiveDeviceTokens(userId: unknown): Promise<LooseDocument[]> {
  const cleanUserId = userIdValue(userId);
  const docs = await DeviceTokenModel.find({ userId: cleanUserId, isActive: true })
    .lean<LooseDocument[]>();
  return docs.map(cleanDoc);
}

/**
 * Every currently active device registration across all users — the
 * destination set for notification sending (no segment system exists yet).
 * Deactivated tokens are excluded; nothing here deletes records.
 */
export async function listAllActiveDeviceTokens(): Promise<LooseDocument[]> {
  const docs = await DeviceTokenModel.find({ isActive: true }).lean<LooseDocument[]>();
  return docs.map(cleanDoc);
}
