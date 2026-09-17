import { fetchApi } from './api';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface User {
  id: string;
  name: string;
  phone: number | string;
  email?: string;
  status: string;
  plan: string;
  blocked?: boolean;
  joinedAt: string;
  lastSeen: string;
  posts?: number;
  groups?: number;
  followers?: number;
  bio?: string;
  location?: string;
  dob?: string;
  gender?: string;
  occupation?: string;
}

export type UserPayload = Omit<User, 'id'> & { id?: string };

/** Generic shape returned by the user profile tab endpoints. */
export type UserTabData = Record<string, unknown>;

/* ── Core user CRUD ────────────────────────────────────────────────────── */

/** GET /users — Get All Users */
export function getUsers(): Promise<User[]> {
  return fetchApi<User[]>('/users');
}

/** GET /users/:id — Get User By ID */
export function getUser(id: string): Promise<User> {
  return fetchApi<User>(`/users/${id}`);
}

/** POST /users — Create User */
export function createUser(data: UserPayload): Promise<User> {
  return fetchApi<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PUT /users/:id — Replace User (full replacement) */
export function replaceUser(id: string, data: UserPayload): Promise<User> {
  return fetchApi<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** PATCH /users/:id — Update User (partial update) */
export function updateUser(id: string, data: Partial<User>): Promise<User> {
  return fetchApi<User>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** DELETE /users/:id — Delete User */
export function deleteUser(id: string): Promise<void> {
  return fetchApi<void>(`/users/${id}`, { method: 'DELETE' });
}

/* ── User profile tabs (all require Bearer token) ──────────────────────── */

/** GET /users/:id/overview — User Overview */
export function getUserOverview(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/overview`);
}

/** GET /users/:id/security — User Security */
export function getUserSecurity(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/security`);
}

/** GET /users/:id/profile — User Profile */
export function getUserProfile(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/profile`);
}

/** GET /users/:id/subscription — User Subscription */
export function getUserSubscription(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/subscription`);
}

/** GET /users/:id/content — User Content */
export function getUserContent(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/content`);
}

/** GET /users/:id/events — User Events */
export function getUserEvents(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/events`);
}

/** GET /users/:id/community — User Community */
export function getUserCommunity(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/community`);
}

/** GET /users/:id/personal — User Personal */
export function getUserPersonal(id: string): Promise<UserTabData> {
  return fetchApi<UserTabData>(`/users/${id}/personal`);
}

/**
 * GET /users/:id/activity — User Activity.
 * Returns a rich object with paginated sections for all activity, journal
 * entries, tracker entries, feature usage, etc.
 */
export function getUserActivity(id: string): Promise<UserActivityResponse> {
  return fetchApi<UserActivityResponse>(`/users/${id}/activity`);
}

/* ── User Activity response types ───────────────────────────────────────── */

/** A single equally-shaped record inside an activity section. */
export interface ActivityRecord {
  id?: string;
  userId?: string;
  action?: string;
  occurredAt?: string;
  // journal entries
  title?: string;
  content?: string;
  mood?: string;
  tags?: string[];
  // tracker entries
  trackerType?: string;
  value?: number;
  unit?: string;
  note?: string;
  // feature usage
  featureName?: string;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
}

/** Paginated array wrapper returned by every section. */
export interface ActivitySectionData {
  data?: ActivityRecord[];
  total?: number;
  pages?: number;
}

/** Shape of the GET /users/:id/activity response. */
export interface UserActivityResponse {
  allActivity?: ActivitySectionData;
  timeline?: ActivitySectionData;
  goalActivity?: ActivitySectionData;
  journalActivity?: ActivitySectionData;
  trackerActivity?: ActivitySectionData;
  featureUsage?: ActivitySectionData;
}
