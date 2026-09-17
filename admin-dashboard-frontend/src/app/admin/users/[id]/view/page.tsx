// 'use client';

// import React, { useEffect, useState, type ReactElement } from 'react';
// import { useParams } from 'next/navigation';
// import Link from 'next/link';
// import {
//   ArrowLeft,
//   Pencil,
//   FileText,
//   Users,
//   ShieldCheck,
//   CircleUserRound,
//   CalendarDays,
//   KeyRound,
//   Activity,
//   MessageSquare,
//   CreditCard,
//   Smartphone,
//   Laptop,
//   Monitor,
//   CheckCircle,
//   Ban,
//   PauseCircle,
//   PlayCircle,
//   Inbox,
// } from 'lucide-react';
// import { Tabs, type TabItem } from '@/src/components/admin/Tabs/Tabs';
// import { fetchApi } from '@/src/lib/api/api';
// import {
//   getUser,
//   getUserOverview,
//   getUserSecurity,
//   getUserProfile,
//   getUserSubscription,
//   getUserContent,
//   getUserEvents,
//   getUserCommunity,
//   getUserPersonal,
//   getUserActivity,
//   updateUser,
//   type User,
//   type UserTabData,
//   type UserActivityResponse,
//   type ActivityRecord,
// } from '@/src/lib/api/users';

// import { Loader } from '@/src/components/admin/Loader';
// import { PermissionGate } from '@/src/components/admin/PermissionGate';
// import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
// import { Toast } from '@/src/components/admin/Toast';
// import { NoData } from '@/src/components/admin/NoData/NoData';
// import styles from './page.module.css';
// import s from './viewSections.module.css';

// /* ── Types ─────────────────────────────────────────────────────────────── */

// interface ActivityEntry {
//   id?: string;
//   action: string;
//   occurredAt?: string;
// }

// interface DeviceSession {
//   id: string;
//   device: string;
//   type?: string;
//   browser?: string;
//   location?: string;
//   lastActiveAt?: string;
//   isCurrent?: boolean;
// }

// interface LoginRecord {
//   id: string;
//   loginAt: string;
//   device?: string;
//   ipAddress?: string;
// }

// interface Subscription {
//   userId: string;
//   plan: string;
//   status: string;
//   startDate: string;
//   nextBillingDate: string;
//   amount: number;
// }

// type ConfirmAction = 'activate' | 'suspend' | 'block' | 'unblock';

// /* ── Helpers ───────────────────────────────────────────────────────────── */

// const formatDate = (value?: string) =>
//   value
//     ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
//     : '—';

// const formatDateTime = (value?: string) =>
//   value
//     ? new Date(value).toLocaleString(undefined, {
//       month: 'short',
//       day: 'numeric',
//       hour: 'numeric',
//       minute: '2-digit',
//     })
//     : '—';

// const deviceIcon = (type?: string) => {
//   const t = (type || '').toLowerCase();
//   if (t.includes('phone') || t.includes('mobile') || t.includes('ios') || t.includes('android')) {
//     return <Smartphone size={18} />;
//   }
//   if (t.includes('tablet') || t.includes('ipad')) {
//     return <Monitor size={18} />;
//   }
//   if (t.includes('desktop') || t === 'pc' || t.includes('windows')) {
//     return <Laptop size={18} />;
//   }
//   return <Monitor size={18} />;
// };

// const confirmTitle = (t: ConfirmAction) => {
//   if (t === 'suspend') return 'Suspend';
//   if (t === 'block') return 'Block';
//   if (t === 'unblock') return 'Unblock';
//   return 'Activate';
// };

// const toText = (value: unknown): string => {
//   if (value === null || value === undefined) return '—';
//   if (typeof value === 'boolean') return value ? 'Yes' : 'No';
//   if (typeof value === 'number') return String(value);
//   if (Array.isArray(value)) return value.map(toText).join(', ');
//   if (typeof value === 'object') return JSON.stringify(value);
//   return String(value);
// };

// const displayKey = (key: string): string => {
//   return key
//     .replace(/([a-z])([A-Z])/g, '$1 $2')
//     .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
//     .replace(/[_-]+/g, ' ')
//     .replace(/\bid\b/gi, 'ID')
//     .trim();
// };

// /** Returns true if value is a plain (non-null, non-array) object. */
// const isTabObject = (v: unknown): v is Record<string, unknown> =>
//   typeof v === 'object' && v !== null && !Array.isArray(v);

// /** Keys that only describe the API envelope and should never be shown to the user. */
// const IGNORED_TAB_KEYS = new Set(['success', 'pagination', 'accountActions', 'quickActions']);

// /** Filters noise metadata keys out of a tab response object. */
// const tabEntries = (obj: Record<string, unknown>) =>
//   Object.entries(obj).filter(([k]) => !k.toLowerCase().includes('id') && !IGNORED_TAB_KEYS.has(k));

// /** Renders just the value portion (the cell body) of a tab entry, expanding nested objects/arrays. */
// const renderTabValueCell = (value: unknown): ReactElement => {
//   if (value === null || value === undefined || value === '') {
//     return <span className={styles.infoValue}>-</span>;
//   }

//   if (Array.isArray(value)) {
//     return value.length === 0 ? (
//       <span className={styles.infoValue}>-</span>
//     ) : (
//       <div className={s.subList}>
//         {value.map((item, idx) =>
//           isTabObject(item) ? (
//             <div className={s.subCard} key={idx}>
//               <table className={s.nestedTable}>
//                 <tbody>
//                   {tabEntries(item).map(([k, v]) => (
//                     <tr key={k}>
//                       <th scope="row" className={s.tabTableLabel}>{displayKey(k)}</th>
//                       <td>{renderTabValueCell(v)}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             <div className={s.subRow} key={idx}>
//               <span className={s.bullet} />
//               {toText(item)}
//             </div>
//           )
//         )}
//       </div>
//     );
//   }

//   if (isTabObject(value)) {
//     const nested = tabEntries(value);
//     return nested.length === 0 ? (
//       <span className={styles.infoValue}>-</span>
//     ) : (
//       <table className={s.nestedTable}>
//         <tbody>
//           {nested.map(([k, v]) => (
//             <tr key={k}>
//               <th scope="row" className={s.tabTableLabel}>{displayKey(k)}</th>
//               <td>{renderTabValueCell(v)}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     );
//   }

//   return <span className={styles.infoValue}>{toText(value)}</span>;
// };
// /** Renders a key-value table from a profile-tab endpoint response. */
// const renderTabGrid = (data: UserTabData | null): ReactElement | null => {
//   if (!data) return null;
//   const entries = tabEntries(data);
//   if (entries.length === 0) return null;
//   return (
//     <div className={s.tableCard}>
//       <table className={s.dataTable}>
//         <thead>
//           <tr>
//             <th>Field</th>
//             <th>Value</th>
//           </tr>
//         </thead>
//         <tbody>
//           {entries.map(([key, value]) => (
//             <tr key={key}>
//               <td className={s.tabTableLabel}>{displayKey(key)}</td>
//               <td>{renderTabValueCell(value)}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// /** Counts the top-level displayable fields in a tab response (used for the tab badge). */
// const tabFieldCount = (data: UserTabData | null): number =>
//   data ? tabEntries(data).length : 0;

// /** Counts the items in a paginated collection field, e.g. posts.data.length. */
// const collectionCount = (data: unknown): number => {
//   if (!data) return 0;
//   const obj = data as Record<string, unknown>;
//   if (Array.isArray(obj.data)) return obj.data.length;
//   if (Array.isArray(data)) return (data as unknown[]).length;
//   return 0;
// };

// /* ── User Activity panel helpers ──────────────────────────────────────── */

// /** Turns snake_case into readable, title-cased text (e.g. post_created → Post Created). */
// const prettify = (value?: string): string =>
//   value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';

// /** Derives a friendly activity category from the record shape / id. */
// const activityTypeOf = (rec: ActivityRecord): string => {
//   if (rec.featureName) return 'Feature';
//   if (rec.trackerType) return 'Tracker';
//   if (rec.title) return 'Journal';
//   const id = rec.id ?? '';
//   if (id.includes('goal')) return 'Goal';
//   if (id.includes('journal')) return 'Journal';
//   if (id.includes('tracker')) return 'Tracker';
//   if (id.includes('feature')) return 'Feature';
//   return 'Activity';
// };

// /** Renders a titled activity section built from a `<thead>` + `<tbody>` pair. */
// const renderActivitySection = (
//   title: string,
//   count: number,
//   head: ReactElement,
//   body: ReactElement | null,
// ): ReactElement => (
//   <div className={s.tabBlock}>
//     <div className={s.actSectionHead}>
//       <h4 className={s.subBlockLabel}>{title}</h4>
//       <span className={s.actCount}>{count}</span>
//     </div>
//     {body ?? (
//       <div className={s.emptyNote}>
//         <Inbox size={16} /> No {title.toLowerCase()} recorded.
//       </div>
//     )}
//   </div>
// );

// export default function ViewUserPage() {
//   const { id: userId = '' } = useParams();

//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [subs, setSubs] = useState<Subscription[]>([]);
//   const [subLoading, setSubLoading] = useState(false);
//   const [sessions, setSessions] = useState<DeviceSession[]>([]);
//   const [sessionsLoading, setSessionsLoading] = useState(false);
//   const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
//   const [historyLoading, setHistoryLoading] = useState(false);
//   const [activity, setActivity] = useState<UserActivityResponse>({});
//   const [activityLoading, setActivityLoading] = useState(false);
//   // Data from the dedicated profile-tab endpoints
//   const [overview, setOverview] = useState<UserTabData | null>(null);
//   const [security, setSecurity] = useState<UserTabData | null>(null);
//   const [profile, setProfile] = useState<UserTabData | null>(null);
//   const [content, setContent] = useState<UserTabData | null>(null);
//   const [events, setEvents] = useState<UserTabData | null>(null);
//   const [community, setCommunity] = useState<UserTabData | null>(null);
//   const [personal, setPersonal] = useState<UserTabData | null>(null);

//   const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
//   const [confirm, setConfirm] = useState<{ type: ConfirmAction } | null>(null);
//   const [acting, setActing] = useState(false);

//   useEffect(() => {
//     if (!userId) return;
//     const load = async () => {
//       try {
//         setLoading(true);
//         const data = await getUser(String(userId));
//         setUser(data);
//       } catch (err) {
//         console.error(err);
//         setError('Failed to load user details.');
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();

//     // Fetch every profile-tab endpoint for this user. Each one fails
//     // gracefully (stays null) so missing data never blocks the page.
//     getUserOverview(String(userId)).then(setOverview).catch((err) => console.error('Failed to load user overview', err));
//     getUserSecurity(String(userId)).then(setSecurity).catch((err) => console.error('Failed to load user security', err));
//     getUserProfile(String(userId)).then(setProfile).catch((err) => console.error('Failed to load user profile', err));
//     getUserContent(String(userId)).then(setContent).catch((err) => console.error('Failed to load user content', err));
//     getUserEvents(String(userId)).then(setEvents).catch((err) => console.error('Failed to load user events', err));
//     getUserCommunity(String(userId)).then(setCommunity).catch((err) => console.error('Failed to load user community', err));
//     getUserPersonal(String(userId)).then(setPersonal).catch((err) => console.error('Failed to load user personal', err));
//   }, [userId]);

//   useEffect(() => {
//     if (!userId) return;
//     setSubLoading(true);
//     getUserSubscription(String(userId))
//       .then((data) => setSubs([data as unknown as Subscription]))
//       .catch((err) => console.error('Failed to load subscriptions', err))
//       .finally(() => setSubLoading(false));
//   }, [userId]);

//   useEffect(() => {
//   if (!userId) return;
//   setActivityLoading(true);
//   getUserActivity(String(userId))
//     .then((data) => setActivity(data))
//     .catch((err) => console.error('Failed to load user activity', err))
//     .finally(() => setActivityLoading(false));
// }, [userId]);

//   // Devices & sessions from the /sessions endpoint
//   useEffect(() => {
//     if (!userId) return;
//     setSessionsLoading(true);
//     fetchApi<DeviceSession[]>(`/sessions?userId=${userId}`)
//       .then((data) => setSessions(Array.isArray(data) ? data : []))
//       .catch((err) => console.error('Failed to load sessions', err))
//       .finally(() => setSessionsLoading(false));
//   }, [userId]);

//   // Login history from the /loginHistory endpoint
//   useEffect(() => {
//     if (!userId) return;
//     setHistoryLoading(true);
//     fetchApi<LoginRecord[]>(`/loginHistory?userId=${userId}`)
//       .then((data) => setLoginHistory(Array.isArray(data) ? data : []))
//       .catch((err) => console.error('Failed to load login history', err))
//       .finally(() => setHistoryLoading(false));
//   }, [userId]);

//   const applyAccountAction = async (action: 'activate' | 'suspend' | 'block' | 'unblock') => {
//     if (!user) return;
//     setActing(true);
//     try {
//       const patch: Record<string, string | boolean> =
//         action === 'block'
//           ? { status: 'suspended', blocked: true }
//           : { status: 'active', blocked: false }; // activate, suspend, unblock all restore to active
//       if (action === 'suspend') patch.status = 'suspended';

//       const updated = await updateUser(user.id, patch);
//       setUser((prev) => (prev ? { ...prev, ...updated } : prev));
//       const actionText = action === 'block' ? 'blocked' : action === 'suspend' ? 'suspended' : 'activated';
//       setToast({ message: `User account ${actionText}.`, type: 'success' });
//     } catch (err) {
//       console.error(err);
//       setToast({ message: 'Failed to update account status.', type: 'error' });
//     } finally {
//       setActing(false);
//       setConfirm(null);
//     }
//   };

//   if (loading) {
//     return (
//       <div className={styles.container}>
//         <div className={styles.loadingWrapper}>
//           <Loader />
//         </div>
//       </div>
//     );
//   }

//   if (error && !user) {
//     return (
//       <div className={styles.container}>
//         <div className={styles.errorAlert}>User not found.</div>
//         <Link href="/admin/users" className={styles.backButton}>
//           <ArrowLeft size={16} /> Back to Users
//         </Link>
//       </div>
//     );
//   }

//   const isBlocked = !!user?.blocked;
//   const isSuspended = user?.status === 'suspended';
//   const isActive = user?.status === 'active';

//   const subscription = subs[0];
//   const activityList = activity;
//   const devices = sessions;
//   const history = loginHistory;

//   // Activity data used inside the activity tab panel
//   const allActivityList = Array.isArray(activityList) ? activityList : [];
//   const activityTotal = allActivityList.length;
//   const hasActivity = activityTotal > 0;

//   // Additional lists for stats (if activity is structured)
//   const journalList = Array.isArray(activity.journalActivity?.data) ? activity.journalActivity.data : [];
//   const trackerList = Array.isArray(activity.trackerActivity?.data) ? activity.trackerActivity.data : [];
//   const featureList = Array.isArray(activity.featureUsage?.data) ? activity.featureUsage.data : [];

//   const tabItems: TabItem[] = [
//     {
//       id: 'overview',
//       label: 'Overview',
//       icon: <Users size={16} />,
//       badge: (overview as Record<string, unknown> | undefined)?.recentActivity
//         ? collectionCount((overview as Record<string, unknown>).recentActivity)
//         : undefined,
//       panel: !overview ? (
//         <div className={s.emptyNote}>
//           <Inbox size={16} /> No overview data available for this user.
//         </div>
//       ) : (
//         (() => {
//           const o = overview as Record<string, Record<string, unknown>>;
//           const summary = (o.activitySummary as Record<string, number> | undefined) ?? {};
//           const recent = Array.isArray(o.recentActivity) ? (o.recentActivity as ActivityEntry[]) : [];
//           return (
//             <div className={s.tabStack}>
//               <div className={s.statTiles}>
//                 <div className={s.statTile}>
//                   <MessageSquare size={20} className={s.statIcon} />
//                   <div>
//                     <div className={s.statTileValue}>{Number(summary.posts ?? 0)}</div>
//                     <div className={s.statTileLabel}>Posts</div>
//                   </div>
//                 </div>
//                 <div className={s.statTile}>
//                   <CalendarDays size={20} className={s.statIcon} />
//                   <div>
//                     <div className={s.statTileValue}>{Number(summary.events ?? 0)}</div>
//                     <div className={s.statTileLabel}>Events</div>
//                   </div>
//                 </div>
//                 <div className={s.statTile}>
//                   <Users size={20} className={s.statIcon} />
//                   <div>
//                     <div className={s.statTileValue}>{Number(summary.groups ?? 0)}</div>
//                     <div className={s.statTileLabel}>Groups</div>
//                   </div>
//                 </div>
//               </div>
//               <div className={s.tabBlock}>
//                 <h4 className={s.subBlockLabel}>Recent Activity</h4>
//                 {recent.length > 0 ? (
//                   <ul className={s.activityList}>
//                     {recent.map((item, idx) => (
//                       <li key={item.id ?? idx} className={s.activityItem}>
//                         <span className={s.activityDot} />
//                         <div className={s.activityBody}>
//                           <div className={s.activityAction}>{item.action}</div>
//                         </div>
//                         <span className={s.activityTime}>{formatDateTime(item.occurredAt)}</span>
//                       </li>
//                     ))}
//                   </ul>
//                 ) : (
//                   <div className={s.emptyNote}>
//                     <Inbox size={16} /> No recent activity recorded for this user.
//                   </div>
//                 )}
//               </div>
//             </div>
//           );
//         })()
//       ),
//     },
//     {
//       id: 'profile',
//       label: 'Profile',
//       icon: <CircleUserRound size={16} />,
//       badge: profile ? tabFieldCount(profile) : undefined,
//       panel: !profile ? (
//         <div className={s.emptyNote}>
//           <Inbox size={16} /> No profile data available for this user.
//         </div>
//       ) : (
//         (() => {
//           const p = profile as Record<string, Record<string, unknown>>;
//           const basic = (p.basic as Record<string, unknown> | undefined) ?? {};
//           const about = (p.about as Record<string, unknown> | undefined) ?? {};
//           const completion = Number(p.profileCompletion ?? 0);
//           const interests = Array.isArray(about.interests) ? (about.interests as unknown[]).join(', ') : '—';
//           const loves = Array.isArray(about.thingsILove) ? (about.thingsILove as unknown[]).join(', ') : '—';
//           return (
//             <div className={s.tabStack}>
//               <div className={s.subBlock}>
//                 <span className={s.subBlockLabel}>Basic Information</span>
//                 <div className={styles.grid}>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Name</span>
//                     <span className={styles.infoValue}>{String(basic.name ?? '—')}</span>
//                   </div>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Phone</span>
//                     <span className={styles.infoValue}>{String(basic.phone ?? '—')}</span>
//                   </div>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Status</span>
//                     <span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>
//                       {String(basic.status ?? '—')}
//                     </span>
//                   </div>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Joined</span>
//                     <span className={styles.infoValue}>{formatDate(String(basic.joinedAt ?? ''))}</span>
//                   </div>
//                 </div>
//               </div>
//               <div className={s.subBlock}>
//                 <span className={s.subBlockLabel}>About</span>
//                 <div className={styles.grid}>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Bio</span>
//                     <span className={styles.infoValue}>{String(about.bio ?? '—')}</span>
//                   </div>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Interests</span>
//                     <span className={styles.infoValue}>{interests}</span>
//                   </div>
//                   <div className={styles.infoItem}>
//                     <span className={styles.infoLabel}>Things I Love</span>
//                     <span className={styles.infoValue}>{loves}</span>
//                   </div>
//                 </div>
//               </div>
//               <div className={s.tabBlock}>
//                 <h4 className={s.subBlockLabel}>Profile Completion</h4>
//                 <div className={s.progressTrack}>
//                   <div className={s.progressFill} style={{ width: `${Math.min(100, completion)}%` }} />
//                 </div>
//                 <span className={s.progressLabel}>{completion}%</span>
//               </div>
//             </div>
//           );
//         })()
//       ),
//     },
//     {
//       id: 'security',
//       label: 'Security',
//       icon: <ShieldCheck size={16} />,
//       badge: security ? tabFieldCount(security) : undefined,
//       panel: !security ? (
//         <div className={s.emptyNote}>
//           <Inbox size={16} /> No security data available for this user.
//         </div>
//       ) : (
//         (() => {
//           const sec = security as Record<string, unknown>;
//           const secDevices = Array.isArray(sec.devices)
//             ? (sec.devices as DeviceSession[])
//             : devices;
//           const secHistory = Array.isArray(sec.loginHistory) ? (sec.loginHistory as LoginRecord[]) : history;
//           const pwd = (sec.password as Record<string, unknown> | undefined) ?? {};
//           return (
//             <div className={s.tabStack}>
//               <div className={s.subBlock}>
//                 <span className={s.subBlockLabel}>Devices</span>
//                 {secDevices.length > 0 ? (
//                   <ul className={s.deviceList}>
//                     {secDevices.map((d) => (
//                       <li key={d.id} className={s.deviceItem}>
//                         <div className={s.deviceIcon}>{deviceIcon(d.type)}</div>
//                         <div className={s.deviceInfo}>
//                           <div className={s.deviceName}>{d.device || d.type || 'Device'}</div>
//                           <div className={s.deviceMeta}>
//                             {[d.browser, d.location, d.lastActiveAt && `Active ${formatDateTime(d.lastActiveAt)}`]
//                               .filter(Boolean)
//                               .join(' · ')}
//                           </div>
//                         </div>
//                       </li>
//                     ))}
//                   </ul>
//                 ) : (
//                   <div className={s.emptyNote}>
//                     <Inbox size={16} /> No devices available for this user.
//                   </div>
//                 )}
//               </div>
//               <div className={s.subBlock}>
//                 <span className={s.subBlockLabel}>Login History</span>
//                 {secHistory.length > 0 ? (
//                   <table className={s.dataTable}>
//                     <thead>
//                       <tr>
//                         <th>Date &amp; Time</th>
//                         <th>Device</th>
//                         <th>IP Address</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {secHistory.map((h) => (
//                         <tr key={h.id}>
//                           <td>{formatDateTime(h.loginAt)}</td>
//                           <td>{h.device || '—'}</td>
//                           <td>{h.ipAddress || '—'}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 ) : (
//                   <div className={s.emptyNote}>
//                     <Inbox size={16} /> No login history recorded for this user.
//                   </div>
//                 )}
//               </div>
//               <div className={styles.grid}>
//                 <div className={styles.infoItem}>
//                   <span className={styles.infoLabel}>Two-Factor Auth</span>
//                   <span className={styles.infoValue}>{sec.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
//                 </div>
//                 <div className={styles.infoItem}>
//                   <span className={styles.infoLabel}>Password Last Changed</span>
//                   <span className={styles.infoValue}>{pwd.lastChanged ? formatDate(String(pwd.lastChanged)) : 'Never'}</span>
//                 </div>
//                 <div className={styles.infoItem}>
//                   <span className={styles.infoLabel}>Password Reset</span>
//                   <span className={styles.infoValue}>{pwd.canReset ? 'Allowed' : 'Restricted'}</span>
//                 </div>
//               </div>
//             </div>
//           );
//         })()
//       ),
//     },
//     {
//       id: 'subscription',
//       label: 'Subscription',
//       icon: <CreditCard size={16} />,
//       panel: subLoading ? (
//         <div className={s.loadingNote}>
//           <Loader /> Loading subscription…
//         </div>
//       ) : subscription ? (
//         <div className={s.subCard}>
//           <div className={s.subPlan}>
//             <div className={s.subIcon}>
//               <CreditCard size={20} />
//             </div>
//             <div>
//               <div className={s.subPlanName}>{subscription.plan}</div>
//               <div className={s.subMeta}>{subscription.status} plan</div>
//             </div>
//           </div>
//           <div className={s.subDetails}>
//             <div className={s.subField}>
//               <span className={s.subFieldLabel}>Status</span>
//               <span className={s.subFieldValue} style={{ textTransform: 'capitalize' }}>
//                 {subscription.status}
//               </span>
//             </div>
//             <div className={s.subField}>
//               <span className={s.subFieldLabel}>Start</span>
//               <span className={s.subFieldValue}>{formatDate(subscription.startDate)}</span>
//             </div>
//             <div className={s.subField}>
//               <span className={s.subFieldLabel}>Renewal</span>
//               <span className={s.subFieldValue}>{formatDate(subscription.nextBillingDate)}</span>
//             </div>
//             <div className={s.subField}>
//               <span className={s.subFieldLabel}>Amount</span>
//               <span className={s.subFieldValue}>
//                 ${Number(subscription.amount || 0).toLocaleString()}
//               </span>
//             </div>
//           </div>
//         </div>
//       ) : (
//         <div className={s.emptyNote}>
//           <Inbox size={16} /> No active subscription found for this user.
//         </div>
//       ),
//     },
//     {
//       id: 'activity',
//       label: 'Activity',
//       icon: <Activity size={16} />,
//       badge: activityTotal > 0 ? activityTotal : undefined,
//       panel: activityLoading ? (
//         <div className={s.loadingNote}>
//           <Loader /> Loading activity...
//         </div>
//       ) : !hasActivity ? (
//         <div className={s.emptyNote}>
//           <Inbox size={16} /> No recent activity recorded for this user.
//         </div>
//       ) : (
//         <div className={s.tabStack}>
//           {/* Stats tiles */}
//           <div className={s.statTiles}>
//             <div className={s.statTile}>
//               <Activity size={20} className={s.statIcon} />
//               <div>
//                 <div className={s.statTileValue}>{activityTotal}</div>
//                 <div className={s.statTileLabel}>Actions</div>
//               </div>
//             </div>
//             <div className={s.statTile}>
//               <MessageSquare size={20} className={s.statIcon} />
//               <div>
//                 <div className={s.statTileValue}>{activity.journalActivity?.total ?? journalList.length}</div>
//                 <div className={s.statTileLabel}>Journals</div>
//               </div>
//             </div>
//             <div className={s.statTile}>
//               <CalendarDays size={20} className={s.statIcon} />
//               <div>
//                 <div className={s.statTileValue}>{activity.trackerActivity?.total ?? trackerList.length}</div>
//                 <div className={s.statTileLabel}>Trackers</div>
//               </div>
//             </div>
//             <div className={s.statTile}>
//               <CreditCard size={20} className={s.statIcon} />
//               <div>
//                 <div className={s.statTileValue}>{activity.featureUsage?.total ?? featureList.length}</div>
//                 <div className={s.statTileLabel}>Features</div>
//               </div>
//             </div>
//           </div>

//           {/* All activity — primary event feed as a proper table */}
//           {renderActivitySection(
//             'All Activity',
//             allActivityList.length,
//             <thead>
//               <tr>
//                 <th>Action</th>
//                 <th>Category</th>
//                 <th>When</th>
//               </tr>
//             </thead>,
//             allActivityList.length > 0 ? (
//               <table className={s.dataTable}>
//                 <thead>
//                   <tr>
//                     <th>Action</th>
//                     <th>Category</th>
//                     <th>When</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {allActivityList.map((item, idx) => (
//                     <tr key={item.id ?? idx}>
//                       <td>
//                         <span className={s.actionText}>{prettify(item.action)}</span>
//                       </td>
//                       <td>
//                         <span className={`${s.statusPill} ${s.typePill}`}>{activityTypeOf(item)}</span>
//                       </td>
//                       <td className={s.actTimeCell}>{formatDateTime(item.occurredAt)}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             ) : null
//           )}
//         </div>
//       ),
//     },
//     // Content tab temporarily commented out
//     // {
//     //   id: 'content',
//     //   label: 'Content',
//     //   icon: <FileText size={16} />,
//     //   badge: content ? tabFieldCount(content) : undefined,
//     //   panel:
//     //     renderTabGrid(content) ?? (
//     //       <div className={s.emptyNote}>
//     //         <Inbox size={16} /> No content data available for this user.
//     //       </div>
//     //     ),
//     // },
//     {
//       id: 'events',
//       label: 'Events',
//       icon: <CalendarDays size={16} />,
//       badge: events ? tabFieldCount(events) : undefined,
//       panel:
//         renderTabGrid(events) ?? (
//           <div className={s.emptyNote}>
//             <Inbox size={16} /> No event data available for this user.
//           </div>
//         ),
//     },
//     {
//       id: 'community',
//       label: 'Community',
//       icon: <Users size={16} />,
//       badge: community ? tabFieldCount(community) : undefined,
//       panel:
//         renderTabGrid(community) ?? (
//           <div className={s.emptyNote}>
//             <Inbox size={16} /> No community data available for this user.
//           </div>
//         ),
//     },
//     {
//       id: 'personal',
//       label: 'Personal',
//       icon: <KeyRound size={16} />,
//       badge: personal ? tabFieldCount(personal) : undefined,
//       panel:
//         renderTabGrid(personal) ?? (
//           <div className={s.emptyNote}>
//             <Inbox size={16} /> No personal data available for this user.
//           </div>
//         ),
//     },
//   ];

//   return (
//     <div className={styles.container}>
//       {user &&
//         toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

//       <div className={styles.header}>
//         <Link href="/admin/users" className={styles.backBtn}>
//           <ArrowLeft size={16} /> Back to Users
//         </Link>
//         <h1 className={styles.title}>User Profile</h1>
//         <p className={styles.subtitle}>View complete information for {user?.name}</p>
//       </div>

//       {/* Summary card */}
//       <div className={styles.summaryCard}>
//         <div className={styles.avatar}>{user?.name.charAt(0).toUpperCase()}</div>
//         <div className={styles.summaryInfo}>
//           <h2 className={styles.summaryName}>{user?.name}</h2>
//           <span className={styles.infoValue}>{user?.phone}</span>
//           <div className={styles.badges}>
//             <span
//               className={`${styles.badge} ${styles[isBlocked ? 'blocked' : user?.status || 'inactive'] || styles.inactive}`}
//             >
//               {isBlocked ? 'Blocked' : user?.status}
//             </span>
//             <span className={`${styles.badge} ${styles[user?.plan?.toLowerCase() || 'free'] || styles.free}`}>
//               {user?.plan}
//             </span>
//           </div>
//         </div>
//       </div>
//       <div className={styles.content}>
//         <Tabs tabs={tabItems} />

//         {/* Danger zone / account actions */}
//         <div className={s.dangerZone}>
//           <h3 className={s.dangerTitle}>Account Status &amp; Actions</h3>
//           <p className={s.dangerDesc}>
//             Change the account status of <strong>{user?.name}</strong>. These actions are sensitive and require
//             confirmation.
//           </p>
//           <div className={s.accountActions}>
//             {isBlocked ? (
//               <button
//                 type="button"
//                 className={`${s.actionBtn} ${s.activate}`}
//                 onClick={() => setConfirm({ type: 'unblock' })}
//                 disabled={acting}
//               >
//                 <PlayCircle size={16} /> Unblock &amp; Activate
//               </button>
//             ) : (
//               <>
//                 {isSuspended && (
//                   <button
//                     type="button"
//                     className={`${s.actionBtn} ${s.activate}`}
//                     onClick={() => setConfirm({ type: 'activate' })}
//                     disabled={acting}
//                   >
//                     <CheckCircle size={16} /> Activate Account
//                   </button>
//                 )}
//                 {isActive && (
//                   <button
//                     type="button"
//                     className={`${s.actionBtn} ${s.suspend}`}
//                     onClick={() => setConfirm({ type: 'suspend' })}
//                     disabled={acting}
//                   >
//                     <PauseCircle size={16} /> Suspend
//                   </button>
//                 )}
//                 {!isBlocked && (
//                   <button
//                     type="button"
//                     className={`${s.actionBtn} ${s.block}`}
//                     onClick={() => setConfirm({ type: 'block' })}
//                     disabled={acting}
//                   >
//                     <Ban size={16} /> Block
//                   </button>
//                 )}
//               </>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Actions */}
//       <div className={styles.actions}>
//         <Link href="/admin/users" className={styles.backButton}>
//           <ArrowLeft size={16} /> Back to Users
//         </Link>
//         <PermissionGate permission="users.edit">
//           <Link href={`/admin/users/${user?.id}`} className={styles.editBtn}>
//             <Pencil size={16} /> Edit User
//           </Link>
//         </PermissionGate>
//       </div>

//       {confirm && (
//         <ConfirmModal
//           isOpen
//           variant="danger"
//           title={`${confirmTitle(confirm.type)} Account`}
//           message={
//             <>
//               Are you sure you want to <strong>{confirmTitle(confirm.type).toLowerCase()}</strong>{' '}
//               <strong>{user?.name}</strong>? This action changes their account status and takes effect immediately.
//             </>
//           }
//           confirmText={confirmTitle(confirm.type)}
//           onConfirm={() => applyAccountAction(confirm.type)}
//           onCancel={() => setConfirm(null)}
//         />
//       )}
//     </div>
//   );
// }



// src/app/admin/users/[id]/view/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  Ban,
  PauseCircle,
  PlayCircle,
  CheckCircle,
  MessageSquare,
  Users,
  Calendar,
  Clock,
} from 'lucide-react';
import { fetchApi } from '@/src/lib/api/api';
import { Loader } from '@/src/components/admin/Loader';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import { Toast } from '@/src/components/admin/Toast';
import styles from './page.module.css';
import s from './viewSections.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface User {
  id: string;
  name: string;
  status: string;
  plan: string;
  blocked?: boolean;
  joinedAt?: string;
  lastSeen?: string;
  posts?: number;
  groups?: number;
  followers?: number;
}

interface OverviewActivity {
  action: string;
  occurredAt?: string;
}

interface OverviewUser {
  id: string;
  name: string;
  phone?: string;
  status: string;
  joinedAt?: string;
  lastSeen?: string;
  plan: string;
}

interface OverviewData {
  success: boolean;
  user: OverviewUser;
  activitySummary: {
    posts: number;
    events: number;
    groups: number;
  };
  recentActivity: OverviewActivity[];
}

/* Profile tab types */
interface ProfileBasic {
  name: string;
  phone: string;
  status: string;
  joinedAt: string;
}

interface ProfileAbout {
  bio: string | null;
  interests: string[];
  thingsILove: string[];
  zodiac: string | null;
}

interface ProfileData {
  success: boolean;
  basic: ProfileBasic;
  about: ProfileAbout;
  profileCompletion: number;
}

interface ContentSection<T> {
  data: T[];
  total: number;
  pages: number;
}

/* Events tab types */
interface EventItem {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  attendees: number;
  host: string;
  category: string;
}

interface EventRegistration {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  registrationDate: string;
  checkInDate: string | null;
  ticketType: string;
  price: number;
  ticketCode: string;
  createdAt: string;
  updatedAt: string;
  event: EventItem;
}

interface EventPayment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  paymentType: string;
  eventId: string;
  registrationId: string;
}

interface EventsData {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    skip: number;
  };
  registered: ContentSection<EventRegistration>;
  attended: ContentSection<EventRegistration>;
  payments: ContentSection<EventPayment>;
}

/* Community tab types */
interface CommunityMembership {
  id: string;
  name: string;
  description: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

interface CommunityMember {
  id: string;
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
  status: string;
}

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  commentsCount: number;
  status: string;
}

interface CommunityComment {
  id: string;
  content: string;
  postId: string;
  createdAt: string;
  status: string;
}

interface CommunityReaction {
  id: string;
  type: string;
  postId: string;
  createdAt: string;
}

interface CommunityData {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    skip: number;
  };
  groups: ContentSection<CommunityMembership>;
  clubs: ContentSection<CommunityMembership>;
}

/* Personal tab types */
interface PersonalGoal {
  id: string;
  title: string;
  status: string;
  progress: number;
  targetDate: string | null;
}

interface PersonalBucketList {
  id: string;
  title: string;
  priority: number;
  status: string;
}

interface PersonalMemory {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  images: string[];
}

interface PersonalMyCircle {
  id: string;
  name: string | null;
  relationship: string | null;
}

interface PersonalLifeTimeline {
  id: string;
  event: string;
  category: string | null;
  date: string | null;
}

interface PersonalFit {
  id: string;
  name: string;
  tags: string[];
  rating: number | null;
}

interface PersonalData {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    skip: number;
  };
  goals: ContentSection<PersonalGoal>;
  bucketList: ContentSection<PersonalBucketList>;
  memories: ContentSection<PersonalMemory>;
  myCircle: ContentSection<PersonalMyCircle>;
  lifeTimeline: ContentSection<PersonalLifeTimeline>;
  fits: ContentSection<PersonalFit>;
}

/* Security tab types */
interface SecurityDevice {
  id: string;
  userId: string;
  device: string;
  ipAddress: string;
  lastActiveAt: string;
}

interface SecurityLoginHistory {
  id: string;
  userId: string;
  loginAt: string;
  device: string;
  ipAddress: string;
}

interface SecurityData {
  success: boolean;
  devices: SecurityDevice[];
  loginHistory: SecurityLoginHistory[];
}

/* Subscription tab types */
interface SubscriptionPaymentHistory {
  _id: string;
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  paymentType: string;
  eventId?: string;
  registrationId?: string;
}

interface SubscriptionData {
  success: boolean;
  id: string;
  userId: string;
  plan: string;
  amount: number;
  status: string;
  paymentMethod: string;
  startDate: string;
  nextBillingDate: string | null;
  createdAt: string;
  updatedAt: string;
  paymentHistory: SubscriptionPaymentHistory[];
}

/* Activity tab types */
interface AllActivity {
  id: string;
  userId: string;
  action: string;
  occurredAt: string;
}

interface GoalActivity {
  id: string;
  userId: string;
  action: string;
  occurredAt: string;
}

interface JournalActivity {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: string;
  tags: string[];
  createdAt: string;
}

interface TrackerActivity {
  id: string;
  userId: string;
  trackerType: string;
  value: number;
  unit: string;
  note: string;
  createdAt: string;
}

interface FeatureUsage {
  id: string;
  userId: string;
  featureName: string;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
}

interface ActivityData {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    skip: number;
  };
  allActivity: ContentSection<AllActivity>;
  timeline: ContentSection<unknown>;
  goalActivity: ContentSection<GoalActivity>;
  journalActivity: ContentSection<JournalActivity>;
  trackerActivity: ContentSection<TrackerActivity>;
  featureUsage: ContentSection<FeatureUsage>;
}

type ConfirmAction = 'activate' | 'suspend' | 'block' | 'unblock';

/* ── Constants ─────────────────────────────────────────────────────────── */

const tabs = ['Overview', 'Profile', 'Security', 'Subscription', 'Activity', 'Events', 'Community', 'Personal'];

/* ── Helpers ───────────────────────────────────────────────────────────── */

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : '—';

const confirmTitle = (t: ConfirmAction) => {
  if (t === 'suspend') return 'Suspend';
  if (t === 'block') return 'Block';
  if (t === 'unblock') return 'Unblock';
  return 'Activate';
};

export default function ViewUserPage() {
  const { id: userId = '' } = useParams();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<{ type: ConfirmAction } | null>(null);
  const [acting, setActing] = useState(false);

  /* Overview tab state */
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  /* Profile tab state */
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  /* Events tab state with pagination */
  const [eventsData, setEventsData] = useState<EventsData | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [eventsPage, setEventsPage] = useState(1);

  /* Community tab state with pagination */
  const [communityData, setCommunityData] = useState<CommunityData | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communityPage, setCommunityPage] = useState(1);

  /* Personal tab state with pagination */
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const [personalPage, setPersonalPage] = useState(1);

  /* Security tab state */
  const [securityData, setSecurityData] = useState<SecurityData | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');

  /* Subscription tab state */
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');

  /* Activity tab state with pagination */
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityPage, setActivityPage] = useState(1);

  /* ── Load user ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApi<User>(`/users/${userId}`);
        setUser(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load user details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  /* ── Fetch active tab data ──────────────────────────────────────────── */
  useEffect(() => {
    if (!userId || !activeTab) return;

    if (activeTab === 'Overview') {
      const loadOverview = async () => {
        try {
          setOverviewLoading(true);
          setOverviewError('');
          const data = await fetchApi<OverviewData>(`/users/${userId}/overview`);
          console.log('Overview data:', data);
          setOverviewData(data);
        } catch (err) {
          console.error('Failed to load overview:', err);
          setOverviewError('Failed to load overview data.');
        } finally {
          setOverviewLoading(false);
        }
      };
      loadOverview();
    }

    if (activeTab === 'Profile') {
      const loadProfile = async () => {
        try {
          setProfileLoading(true);
          setProfileError('');
          const data = await fetchApi<ProfileData>(`/users/${userId}/profile`);
          console.log('Profile data:', data);
          setProfileData(data);
        } catch (err) {
          console.error('Failed to load profile:', err);
          setProfileError('Failed to load profile data.');
        } finally {
          setProfileLoading(false);
        }
      };
      loadProfile();
    }

    if (activeTab === 'Events') {
      const loadEvents = async () => {
        try {
          setEventsLoading(true);
          setEventsError('');
          const data = await fetchApi<EventsData>(`/users/${userId}/events?page=${eventsPage}`);
          console.log('Events data:', data);
          setEventsData(data);
        } catch (err) {
          console.error('Failed to load events:', err);
          setEventsError('Failed to load events data.');
        } finally {
          setEventsLoading(false);
        }
      };
      loadEvents();
    }

    if (activeTab === 'Community') {
      const loadCommunity = async () => {
        try {
          setCommunityLoading(true);
          setCommunityError('');
          const data = await fetchApi<CommunityData>(`/users/${userId}/community?page=${communityPage}`);
          console.log('Community data:', data);
          setCommunityData(data);
        } catch (err) {
          console.error('Failed to load community:', err);
          setCommunityError('Failed to load community data.');
        } finally {
          setCommunityLoading(false);
        }
      };
      loadCommunity();
    }

    if (activeTab === 'Personal') {
      const loadPersonal = async () => {
        try {
          setPersonalLoading(true);
          setPersonalError('');
          const data = await fetchApi<PersonalData>(`/users/${userId}/personal?page=${personalPage}`);
          console.log('Personal data:', data);
          setPersonalData(data);
        } catch (err) {
          console.error('Failed to load personal:', err);
          setPersonalError('Failed to load personal data.');
        } finally {
          setPersonalLoading(false);
        }
      };
      loadPersonal();
    }

    if (activeTab === 'Security') {
      const loadSecurity = async () => {
        try {
          setSecurityLoading(true);
          setSecurityError('');
          const data = await fetchApi<SecurityData>(`/users/${userId}/security`);
          console.log('Security data:', data);
          setSecurityData(data);
        } catch (err) {
          console.error('Failed to load security:', err);
          setSecurityError('Failed to load security data.');
        } finally {
          setSecurityLoading(false);
        }
      };
      loadSecurity();
    }

    if (activeTab === 'Subscription') {
      const loadSubscription = async () => {
        try {
          setSubscriptionLoading(true);
          setSubscriptionError('');
          const data = await fetchApi<SubscriptionData>(`/users/${userId}/subscription`);
          console.log('Subscription data:', data);
          setSubscriptionData(data);
        } catch (err) {
          console.error('Failed to load subscription:', err);
          setSubscriptionError('Failed to load subscription data.');
        } finally {
          setSubscriptionLoading(false);
        }
      };
      loadSubscription();
    }

    if (activeTab === 'Activity') {
      const loadActivity = async () => {
        try {
          setActivityLoading(true);
          setActivityError('');
          const data = await fetchApi<ActivityData>(`/users/${userId}/activity?page=${activityPage}`);
          console.log('Activity data:', data);
          setActivityData(data);
        } catch (err) {
          console.error('Failed to load activity:', err);
          setActivityError('Failed to load activity data.');
        } finally {
          setActivityLoading(false);
        }
      };
      loadActivity();
    }
  }, [userId, activeTab, eventsPage, communityPage, personalPage, activityPage]);

  /* ── Account actions ─────────────────────────────────────────────────── */
  const applyAccountAction = async (action: 'activate' | 'suspend' | 'block' | 'unblock') => {
    if (!user) return;
    setActing(true);
    try {
      const patch: Record<string, string | boolean> =
        action === 'block'
          ? { status: 'suspended', blocked: true }
          : { status: 'active', blocked: false };
      if (action === 'suspend') patch.status = 'suspended';

      const updated = await fetchApi<User>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      const actionText = action === 'block' ? 'blocked' : action === 'suspend' ? 'suspended' : 'activated';
      setToast({ message: `User account ${actionText}.`, type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update account status.', type: 'error' });
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  /* ── Loading & error states ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Loader />
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>User not found.</div>
        <Link href="/admin/users" className={styles.backButton}>
          <ArrowLeft size={16} /> Back to Users
        </Link>
      </div>
    );
  }

  const isBlocked = !!user?.blocked;
  const isSuspended = user?.status === 'suspended';
  const isActive = user?.status === 'active';

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className={styles.container}>
      {user && toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header - UNCHANGED */}
      <div className={styles.header}>
        <Link href="/admin/users" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Users
        </Link>
        <h1 className={styles.title}>User Profile</h1>
        <p className={styles.subtitle}>View complete information for {user?.name}</p>
      </div>

      {/* Summary card - UNCHANGED */}
      <div className={styles.summaryCard}>
        <div className={styles.avatar}>{user?.name.charAt(0).toUpperCase()}</div>
        <div className={styles.summaryInfo}>
          <h2 className={styles.summaryName}>{user?.name}</h2>
          <div className={styles.badges}>
            <span
              className={`${styles.badge} ${styles[isBlocked ? 'blocked' : user?.status || 'inactive'] || styles.inactive}`}
            >
              {isBlocked ? 'Blocked' : user?.status}
            </span>
            <span className={`${styles.badge} ${styles[user?.plan?.toLowerCase() || 'free'] || styles.free}`}>
              {user?.plan}
            </span>
          </div>
        </div>
      </div>

      {/* Account Actions - UNCHANGED (from danger zone) */}
      <div className={s.dangerZone}>
        <h3 className={s.dangerTitle}>Account Status & Actions</h3>
        <p className={s.dangerDesc}>
          Change the account status of <strong>{user?.name}</strong>. These actions are sensitive and require
          confirmation.
        </p>
        <div className={s.accountActions}>
          {isBlocked ? (
            <button
              type="button"
              className={`${s.actionBtn} ${s.activate}`}
              onClick={() => setConfirm({ type: 'unblock' })}
              disabled={acting}
            >
              <PlayCircle size={16} /> Unblock & Activate
            </button>
          ) : (
            <>
              {isSuspended && (
                <button
                  type="button"
                  className={`${s.actionBtn} ${s.activate}`}
                  onClick={() => setConfirm({ type: 'activate' })}
                  disabled={acting}
                >
                  <CheckCircle size={16} /> Activate Account
                </button>
              )}
              {isActive && (
                <button
                  type="button"
                  className={`${s.actionBtn} ${s.suspend}`}
                  onClick={() => setConfirm({ type: 'suspend' })}
                  disabled={acting}
                >
                  <PauseCircle size={16} /> Suspend
                </button>
              )}
              {!isBlocked && (
                <button
                  type="button"
                  className={`${s.actionBtn} ${s.block}`}
                  onClick={() => setConfirm({ type: 'block' })}
                  disabled={acting}
                >
                  <Ban size={16} /> Block
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation - NEW */}
      <div className={styles.tabNavigation}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabButton} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content - Overview & Profile Tab Implementation */}
      <div className={styles.tabContent}>
        {activeTab === 'Overview' && (
          <>
            {overviewLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : overviewError ? (
              <div className={styles.errorAlert}>{overviewError}</div>
            ) : overviewData ? (
              <div className={styles.overviewContainer}>
                {/* Account Summary */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Account Summary</h3>
                  <div className={styles.grid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Name</span>
                      <span className={styles.infoValue}>{overviewData.user.name}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Phone</span>
                      <span className={styles.infoValue}>{overviewData.user.phone || '—'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>{overviewData.user.status}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Plan</span>
                      <span className={styles.infoValue}>{overviewData.user.plan}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Joined</span>
                      <span className={styles.infoValue}>{formatDate(overviewData.user.joinedAt)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Last Seen</span>
                      <span className={styles.infoValue}>{formatDate(overviewData.user.lastSeen)}</span>
                    </div>
                  </div>
                </div>

                {/* Activity Summary */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Activity Summary</h3>
                  <div className={s.statTiles}>
                    <div className={s.statTile}>
                      <MessageSquare size={20} className={s.statIcon} />
                      <div>
                        <div className={s.statTileValue}>{overviewData.activitySummary.posts}</div>
                        <div className={s.statTileLabel}>Posts</div>
                      </div>
                    </div>
                    <div className={s.statTile}>
                      <Calendar size={20} className={s.statIcon} />
                      <div>
                        <div className={s.statTileValue}>{overviewData.activitySummary.events}</div>
                        <div className={s.statTileLabel}>Events</div>
                      </div>
                    </div>
                    <div className={s.statTile}>
                      <Users size={20} className={s.statIcon} />
                      <div>
                        <div className={s.statTileValue}>{overviewData.activitySummary.groups}</div>
                        <div className={s.statTileLabel}>Groups</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Recent Activity</h3>
                  {overviewData.recentActivity?.length > 0 ? (
                    <ul className={s.activityList}>
                      {overviewData.recentActivity.slice(0, 5).map((item, idx) => (
                        <li key={idx} className={s.activityItem}>
                          <span className={s.activityDot} />
                          <div className={s.activityBody}>
                            <div className={s.activityAction}>{item.action}</div>
                          </div>
                          <span className={s.activityTime}>{formatDateTime(item.occurredAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={s.emptyNote}>
                      <Clock size={16} /> No recent activity
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Profile' && (
          <>
            {profileLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : profileError ? (
              <div className={styles.errorAlert}>{profileError}</div>
            ) : profileData ? (
              <div className={styles.profileContainer}>
                {/* Basic Information */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Basic Information</h3>
                  <div className={styles.grid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Name</span>
                      <span className={styles.infoValue}>{profileData.basic.name}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Phone</span>
                      <span className={styles.infoValue}>{profileData.basic.phone}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>{profileData.basic.status}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Joined</span>
                      <span className={styles.infoValue}>{formatDate(profileData.basic.joinedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* About Me */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>About Me</h3>
                  <div className={styles.aboutBio}>
                    {profileData.about.bio || 'Not set'}
                  </div>
                </div>

                {/* Zodiac */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Zodiac</h3>
                  <span className={styles.infoValue}>
                    {profileData.about.zodiac || 'Not set'}
                  </span>
                </div>

                {/* Interests */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Interests</h3>
                  {profileData.about.interests.length > 0 ? (
                    <div className={styles.tagList}>
                      {profileData.about.interests.map((tag, idx) => (
                        <span key={idx} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <div className={s.emptyNote}>No interests added</div>
                  )}
                </div>

                {/* Things I Love */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Things I Love</h3>
                  {profileData.about.thingsILove.length > 0 ? (
                    <div className={styles.tagList}>
                      {profileData.about.thingsILove.map((tag, idx) => (
                        <span key={idx} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <div className={s.emptyNote}>None added</div>
                  )}
                </div>

                {/* Profile Completion */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Profile Completion</h3>
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${profileData.profileCompletion}%` }}
                      />
                    </div>
                    <span className={styles.progressText}>{profileData.profileCompletion}%</span>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Events' && (
          <>
            {eventsLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : eventsError ? (
              <div className={styles.errorAlert}>{eventsError}</div>
            ) : eventsData ? (
              <div className={styles.eventsContainer}>
                {/* Pagination Controls */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {eventsData.pagination.page} of {eventsData.registered.pages}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                      disabled={eventsData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setEventsPage((p) => p + 1)}
                      disabled={eventsData.pagination.page >= eventsData.registered.pages}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Registered Events */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Registered Events</h3>
                  {eventsData.registered.total === 0 ? (
                    <div className={s.emptyNote}>No registered events yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Ticket</th>
                            <th>Price</th>
                            <th>Registered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventsData.registered.data.map((reg) => (
                            <tr key={reg.id}>
                              <td>{reg.event.title}</td>
                              <td>{reg.event.type}</td>
                              <td>{formatDateTime(reg.event.date)}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[reg.status.toLowerCase() || 'inactive']}`}>
                                  {reg.status}
                                </span>
                              </td>
                              <td>{reg.ticketType}</td>
                              <td>${reg.price}</td>
                              <td>{formatDateTime(reg.registrationDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Attended Events */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Attended Events</h3>
                  {eventsData.attended.total === 0 ? (
                    <div className={s.emptyNote}>No attended events yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Host</th>
                            <th>Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventsData.attended.data.map((reg) => (
                            <tr key={reg.id}>
                              <td>{reg.event.title}</td>
                              <td>{reg.event.type}</td>
                              <td>{formatDateTime(reg.event.date)}</td>
                              <td>{reg.event.host}</td>
                              <td>{reg.event.category}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Event Payments</h3>
                  {eventsData.payments.total === 0 ? (
                    <div className={s.emptyNote}>No event payments yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Event ID</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Status</th>
                            <th>Method</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventsData.payments.data.map((payment) => (
                            <tr key={payment.id}>
                              <td>{payment.eventId}</td>
                              <td>${payment.amount}</td>
                              <td>{payment.currency}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[payment.status.toLowerCase() || 'inactive']}`}>
                                  {payment.status}
                                </span>
                              </td>
                              <td>{payment.paymentMethod}</td>
                              <td>{formatDateTime(payment.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pagination Controls (Bottom) */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {eventsData.pagination.page} of {eventsData.registered.pages}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                      disabled={eventsData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setEventsPage((p) => p + 1)}
                      disabled={eventsData.pagination.page >= eventsData.registered.pages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Community' && (
          <>
            {communityLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : communityError ? (
              <div className={styles.errorAlert}>{communityError}</div>
            ) : communityData ? (
              <div className={styles.communityContainer}>
                {/* Pagination Controls */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {communityData.pagination.page} of {Math.max(communityData.groups.pages, communityData.clubs.pages, 1)}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setCommunityPage((p) => Math.max(1, p - 1))}
                      disabled={communityData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setCommunityPage((p) => p + 1)}
                      disabled={communityData.pagination.page >= Math.max(communityData.groups.pages, communityData.clubs.pages, 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Groups */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Groups</h3>
                  {communityData.groups.total === 0 ? (
                    <div className={s.emptyNote}>No groups yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {communityData.groups.data.map((group) => (
                            <tr key={group.id}>
                              <td>{group.name}</td>
                              <td>{group.description || '—'}</td>
                              <td>{group.role}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[group.status.toLowerCase() || 'inactive']}`}>
                                  {group.status}
                                </span>
                              </td>
                              <td>{formatDateTime(group.joinedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Clubs */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Clubs</h3>
                  {communityData.clubs.total === 0 ? (
                    <div className={s.emptyNote}>No clubs yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {communityData.clubs.data.map((club) => (
                            <tr key={club.id}>
                              <td>{club.name}</td>
                              <td>{club.description || '—'}</td>
                              <td>{club.role}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[club.status.toLowerCase() || 'inactive']}`}>
                                  {club.status}
                                </span>
                              </td>
                              <td>{formatDateTime(club.joinedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pagination Controls (Bottom) */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {communityData.pagination.page} of {Math.max(communityData.groups.pages, communityData.clubs.pages, 1)}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setCommunityPage((p) => Math.max(1, p - 1))}
                      disabled={communityData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setCommunityPage((p) => p + 1)}
                      disabled={communityData.pagination.page >= Math.max(communityData.groups.pages, communityData.clubs.pages, 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Personal' && (
          <>
            {personalLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : personalError ? (
              <div className={styles.errorAlert}>{personalError}</div>
            ) : personalData ? (
              <div className={styles.personalContainer}>
                {/* Pagination Controls */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {personalData.pagination.page} of {Math.max(
                      personalData.goals.pages,
                      personalData.bucketList.pages,
                      personalData.memories.pages,
                      personalData.myCircle.pages,
                      personalData.lifeTimeline.pages,
                      personalData.fits.pages,
                      1,
                    )}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setPersonalPage((p) => Math.max(1, p - 1))}
                      disabled={personalData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setPersonalPage((p) => p + 1)}
                      disabled={personalData.pagination.page >= Math.max(
                        personalData.goals.pages,
                        personalData.bucketList.pages,
                        personalData.memories.pages,
                        personalData.myCircle.pages,
                        personalData.lifeTimeline.pages,
                        personalData.fits.pages,
                        1,
                      )}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Goals */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Goals</h3>
                  {personalData.goals.total === 0 ? (
                    <div className={s.emptyNote}>No goals yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th>Target Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.goals.data.map((goal) => (
                            <tr key={goal.id}>
                              <td>{goal.title}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[goal.status.toLowerCase() || 'inactive']}`}>
                                  {goal.status}
                                </span>
                              </td>
                              <td>{goal.progress}%</td>
                              <td>{formatDate(goal.targetDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bucket List */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Bucket List</h3>
                  {personalData.bucketList.total === 0 ? (
                    <div className={s.emptyNote}>No bucket list items yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Priority</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.bucketList.data.map((item) => (
                            <tr key={item.id}>
                              <td>{item.title}</td>
                              <td>{item.priority}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[item.status.toLowerCase() || 'inactive']}`}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Memories */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Memories</h3>
                  {personalData.memories.total === 0 ? (
                    <div className={s.emptyNote}>No memories yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Date</th>
                            <th>Location</th>
                            <th>Images</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.memories.data.map((memory) => (
                            <tr key={memory.id}>
                              <td>{memory.title}</td>
                              <td>{formatDate(memory.date)}</td>
                              <td>{memory.location || '—'}</td>
                              <td>{memory.images?.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* My Circle */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>My Circle</h3>
                  {personalData.myCircle.total === 0 ? (
                    <div className={s.emptyNote}>No circle members yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Relationship</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.myCircle.data.map((member) => (
                            <tr key={member.id}>
                              <td>{member.name || '—'}</td>
                              <td>{member.relationship || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Life Timeline */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Life Timeline</h3>
                  {personalData.lifeTimeline.total === 0 ? (
                    <div className={s.emptyNote}>No timeline events yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Category</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.lifeTimeline.data.map((timeline) => (
                            <tr key={timeline.id}>
                              <td>{timeline.event}</td>
                              <td>{timeline.category || '—'}</td>
                              <td>{formatDate(timeline.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Fits */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Fits</h3>
                  {personalData.fits.total === 0 ? (
                    <div className={s.emptyNote}>No fits yet</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Tags</th>
                            <th>Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalData.fits.data.map((fit) => (
                            <tr key={fit.id}>
                              <td>{fit.name}</td>
                              <td>{fit.tags?.join(', ') || '—'}</td>
                              <td>{fit.rating == null ? '—' : `${fit.rating}/5`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pagination Controls (Bottom) */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {personalData.pagination.page} of {Math.max(
                      personalData.goals.pages,
                      personalData.bucketList.pages,
                      personalData.memories.pages,
                      personalData.myCircle.pages,
                      personalData.lifeTimeline.pages,
                      personalData.fits.pages,
                      1,
                    )}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setPersonalPage((p) => Math.max(1, p - 1))}
                      disabled={personalData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setPersonalPage((p) => p + 1)}
                      disabled={personalData.pagination.page >= Math.max(
                        personalData.goals.pages,
                        personalData.bucketList.pages,
                        personalData.memories.pages,
                        personalData.myCircle.pages,
                        personalData.lifeTimeline.pages,
                        personalData.fits.pages,
                        1,
                      )}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Security' && (
          <>
            {securityLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : securityError ? (
              <div className={styles.errorAlert}>{securityError}</div>
            ) : securityData ? (
              <div className={styles.securityContainer}>
                {/* Devices / Active Sessions */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Active Sessions</h3>
                  {securityData.devices.length === 0 ? (
                    <div className={s.emptyNote}>No active sessions</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Device</th>
                            <th>IP Address</th>
                            <th>Last Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityData.devices.map((device) => (
                            <tr key={device.id}>
                              <td>{device.device}</td>
                              <td>{device.ipAddress}</td>
                              <td>{formatDateTime(device.lastActiveAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Login History */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Login History</h3>
                  {securityData.loginHistory.length === 0 ? (
                    <div className={s.emptyNote}>No login history</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Login Time</th>
                            <th>Device</th>
                            <th>IP Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityData.loginHistory.map((login) => (
                            <tr key={login.id}>
                              <td>{formatDateTime(login.loginAt)}</td>
                              <td>{login.device}</td>
                              <td>{login.ipAddress}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>


              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Subscription' && (
          <>
            {subscriptionLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : subscriptionError ? (
              <div className={styles.errorAlert}>{subscriptionError}</div>
            ) : subscriptionData ? (
              <div className={styles.subscriptionContainer}>
                {/* Subscription Details */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Subscription Details</h3>
                  <div className={styles.grid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Plan</span>
                      <span className={styles.infoValue}>{subscriptionData.plan}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Amount</span>
                      <span className={styles.infoValue}>${subscriptionData.amount}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={styles.infoValue}>
                        <span className={`${styles.badge} ${styles[subscriptionData.status.toLowerCase() || 'inactive']}`}>
                          {subscriptionData.status}
                        </span>
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Payment Method</span>
                      <span className={styles.infoValue}>{subscriptionData.paymentMethod}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Start Date</span>
                      <span className={styles.infoValue}>{formatDateTime(subscriptionData.startDate)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Next Billing Date</span>
                      <span className={styles.infoValue}>
                        {subscriptionData.nextBillingDate ? formatDateTime(subscriptionData.nextBillingDate) : '—'}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Created</span>
                      <span className={styles.infoValue}>{formatDateTime(subscriptionData.createdAt)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Updated</span>
                      <span className={styles.infoValue}>{formatDateTime(subscriptionData.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Payment History</h3>
                  {subscriptionData.paymentHistory?.length === 0 ? (
                    <div className={s.emptyNote}>No payment history</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Status</th>
                            <th>Method</th>
                            <th>Date</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subscriptionData.paymentHistory?.map((payment) => (
                            <tr key={payment.id}>
                              <td>{payment.id}</td>
                              <td>${payment.amount}</td>
                              <td>{payment.currency}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[payment.status.toLowerCase() || 'inactive']}`}>
                                  {payment.status}
                                </span>
                              </td>
                              <td>{payment.paymentMethod}</td>
                              <td>{formatDateTime(payment.createdAt)}</td>
                              <td>{payment.paymentType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>


              </div>
            ) : null}
          </>
        )}

        {activeTab === 'Activity' && (
          <>
            {activityLoading ? (
              <div className={styles.loadingWrapper}>
                <Loader />
              </div>
            ) : activityError ? (
              <div className={styles.errorAlert}>{activityError}</div>
            ) : activityData ? (
              <div className={styles.activityContainer}>
                {/* Pagination Controls */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {activityData.pagination.page} of {activityData.allActivity.pages}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      disabled={activityData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setActivityPage((p) => p + 1)}
                      disabled={activityData.pagination.page >= activityData.allActivity.pages}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* All Activity */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>All Activity</h3>
                  {activityData.allActivity.total === 0 ? (
                    <div className={s.emptyNote}>No activity recorded</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Occurred At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityData.allActivity.data.map((activity) => (
                            <tr key={activity.id}>
                              <td>{activity.action}</td>
                              <td>{formatDateTime(activity.occurredAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Goal Activity */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Goal Activity</h3>
                  {activityData.goalActivity.total === 0 ? (
                    <div className={s.emptyNote}>No goal activity</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Occurred At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityData.goalActivity.data.map((activity) => (
                            <tr key={activity.id}>
                              <td>{activity.action}</td>
                              <td>{formatDateTime(activity.occurredAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Journal Activity */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Journal Activity</h3>
                  {activityData.journalActivity.total === 0 ? (
                    <div className={s.emptyNote}>No journal entries</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Content</th>
                            <th>Mood</th>
                            <th>Tags</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityData.journalActivity.data.map((journal) => (
                            <tr key={journal.id}>
                              <td>{journal.title}</td>
                              <td>{journal.content}</td>
                              <td>{journal.mood}</td>
                              <td>{journal.tags.join(', ')}</td>
                              <td>{formatDateTime(journal.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Tracker Activity */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Tracker Activity</h3>
                  {activityData.trackerActivity.total === 0 ? (
                    <div className={s.emptyNote}>No tracker activity</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Unit</th>
                            <th>Note</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityData.trackerActivity.data.map((tracker) => (
                            <tr key={tracker.id}>
                              <td>{tracker.trackerType}</td>
                              <td>{tracker.value}</td>
                              <td>{tracker.unit}</td>
                              <td>{tracker.note}</td>
                              <td>{formatDateTime(tracker.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Feature Usage */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Feature Usage</h3>
                  {activityData.featureUsage.total === 0 ? (
                    <div className={s.emptyNote}>No feature usage recorded</div>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Feature Name</th>
                            <th>Usage Count</th>
                            <th>Last Used</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityData.featureUsage.data.map((feature) => (
                            <tr key={feature.id}>
                              <td>{feature.featureName}</td>
                              <td>{feature.usageCount}</td>
                              <td>{formatDateTime(feature.lastUsedAt)}</td>
                              <td>{formatDateTime(feature.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pagination Controls (Bottom) */}
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    Page {activityData.pagination.page} of {activityData.allActivity.pages}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      disabled={activityData.pagination.page <= 1}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className={styles.paginationBtn}
                      onClick={() => setActivityPage((p) => p + 1)}
                      disabled={activityData.pagination.page >= activityData.allActivity.pages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className={styles.actions}>
        <Link href="/admin/users" className={styles.backButton}>
          <ArrowLeft size={16} /> Back to Users
        </Link>
        <PermissionGate permission="users.edit">
          <Link href={`/admin/users/${user?.id}`} className={styles.editBtn}>
            <Pencil size={16} /> Edit User
          </Link>
        </PermissionGate>
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          isOpen
          variant="danger"
          title={`${confirmTitle(confirm.type)} Account`}
          message={
            <>
              Are you sure you want to <strong>{confirmTitle(confirm.type).toLowerCase()}</strong>{' '}
              <strong>{user?.name}</strong>? This action changes their account status and takes effect immediately.
            </>
          }
          confirmText={confirmTitle(confirm.type)}
          onConfirm={() => applyAccountAction(confirm.type)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
