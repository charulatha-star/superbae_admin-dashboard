// src/services/notificationSegments.ts
/**
 * Pure notification-segment vocabulary (Step 8 extraction).
 *
 * This module has no imports on purpose: it is the dependency-free single
 * source of truth for the supported segment values, shared by the targeting
 * service (resolution), the management service (write-time canonicalization +
 * validation) and the read-only GET /notifications/options contract endpoint.
 * That avoids a circular import between those modules.
 */

/**
 * The ONLY segments supported today. Each one resolves against fields that
 * already exist in the users collection (status/plan/lastSeen) — no Firebase
 * identity segments exist until the mobile-user auth contract lands.
 */
export const SUPPORTED_SEGMENTS = [
  'all_users',
  'active_users',
  'premium_users',
  'inactive_users',
] as const;

export type SupportedSegment = (typeof SUPPORTED_SEGMENTS)[number];

/** Window used by the UI's "Active Users (last 7 days)" segment. */
export const ACTIVE_WINDOW_DAYS = 7;

/** Display labels used by the existing UI options and the seeded records. */
export const SEGMENT_LABELS: Record<SupportedSegment, string> = {
  all_users: 'All Users',
  active_users: 'Active Users (last 7 days)',
  premium_users: 'Premium Subscribers',
  inactive_users: 'Inactive Users',
};

/**
 * Two segment vocabularies exist in this repo: the UI select values
 * (all_users, active_users, ...) and the human labels that legacy/seeded
 * records carry in `targetSegment` ("All Users", "Premium Subscribers", ...).
 * Both are accepted; nothing else is.
 */
const SEGMENT_ALIASES: Record<string, SupportedSegment> = {
  all: 'all_users',
  everyone: 'all_users',
  'all users': 'all_users',
  active: 'active_users',
  'active users': 'active_users',
  premium: 'premium_users',
  'premium users': 'premium_users',
  'premium subscribers': 'premium_users',
  subscribed: 'premium_users',
  inactive: 'inactive_users',
  'inactive users': 'inactive_users',
};

/**
 * Public canonicalizer: resolves a value from either vocabulary (canonical
 * slug or UI label) to the canonical slug, and returns null for anything
 * unrecognized. Never throws, so write paths can keep legacy values verbatim
 * while still converging recognized labels onto the canonical slug.
 */
export function canonicalizeSegmentId(raw: unknown): SupportedSegment | null {
  if (raw === undefined || raw === null) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const candidates = [
    key,
    key.replace(/[\s-]+/g, '_'),
    key.replace(/\s*\([^)]*\)\s*$/, '').trim(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if ((SUPPORTED_SEGMENTS as readonly string[]).includes(candidate)) {
      return candidate as SupportedSegment;
    }
    const alias = SEGMENT_ALIASES[candidate];
    if (alias) return alias;
  }
  return null;
}
