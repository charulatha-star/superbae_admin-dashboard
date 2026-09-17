'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Calendar,
  Users,
  Tag,
  Image as ImageIcon,
  Search,
  X,
  Check,
} from 'lucide-react';
import { fetchApi } from '@/src/lib/api/api';
import { Loader } from '@/src/components/admin/Loader';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import { Toast } from '@/src/components/admin/Toast';
import { Tabs, type TabItem } from '@/src/components/admin/Tabs/Tabs';
import styles from './page.module.css';
import s from './viewSections.module.css';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Event {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  attendees: number;
  capacity: number;
  registeredCount?: number;
  checkedInCount: number;
  host: string;
  category: string;
  description?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  reminderConfig?: { enabled?: boolean; sendBeforeHours?: number };
  createdAt?: string;
  updatedAt?: string;
}

interface Registration {
  id: string;
  userId: string | null;
  eventId: string;
  status: 'registered' | 'attended' | 'cancelled';
  registrationDate: string;
  checkInDate: string | null;
  ticketType: string | null;
  ticketCode: string | null;
  price: number | null;
  user: { id: string; name: string } | null;
}

interface AnalyticsSummary {
  event: Event;
  registered: number;
  capacity: number;
  utilization: number;
  attended: number;
  attendanceRate: number;
  cancelled: number;
  cancellationRate: number;
  noShows: number;
  noShowRate: number;
  revenue: number;
  registrationTrend: Array<{ date: string; registrations: number }>;
  definitions: Record<string, string>;
}

interface RegistrationsResponse {
  event: Event;
  data: Registration[];
  total: number;
}

type ConfirmAction = 'delete';

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

function AttendeesTab({ eventId, event }: { eventId: string; event: Event | null }) {
  const [attendees, setAttendees] = useState<Registration[]>([]);
  const [attendeesTotal, setAttendeesTotal] = useState(0);
  const [attendeesSearch, setAttendeesSearch] = useState('');
  const [attendeesLoading, setAttendeesLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [localCheckedIn, setLocalCheckedIn] = useState<number>(event?.checkedInCount ?? 0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadAttendees = useCallback(async (search = '') => {
    setAttendeesLoading(true);
    try {
      const resp = await fetchApi<RegistrationsResponse>(
        `/events/${eventId}/registrations?search=${encodeURIComponent(search)}`,
        {},
        true,
      );
      setAttendees(resp.data || []);
      setAttendeesTotal(resp.total || 0);
    } catch {
      setToast({ message: 'Failed to load attendees.', type: 'error' });
    } finally {
      setAttendeesLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  const handleCheckIn = async (reg: Registration) => {
    setCheckingIn(reg.id);
    try {
      await fetchApi(`/events/${eventId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ registrationId: reg.id }),
      });
      setAttendees((prev) => prev.map((r) =>
        r.id === reg.id ? { ...r, status: 'attended', checkInDate: new Date().toISOString() } : r,
      ));
      setLocalCheckedIn((prev) => prev + 1);
      setToast({ message: 'Attendee checked in.', type: 'success' });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Check-in failed.', type: 'error' });
    } finally {
      setCheckingIn(null);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (attendeesSearch) loadAttendees(attendeesSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [attendeesSearch, loadAttendees]);

  return (
    <div className={s.tabStack}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className={s.attendeeSummary}>
        <Users size={16} />
        <strong>Checked in:</strong> {localCheckedIn} / <strong>Capacity:</strong> {event?.capacity ?? '—'}
        <span style={{ marginInlineStart: 'auto' }}>{attendeesTotal} total registered</span>
      </div>

      <div className={s.attendeeSearchWrapper}>
        <Search size={16} className={s.attendeeSearchIcon} />
        <input
          type="text"
          placeholder="Search by name, ticket, or registration ID..."
          value={attendeesSearch}
          onChange={(e) => setAttendeesSearch(e.target.value)}
        />
        {attendeesSearch && (
          <button
            type="button"
            className={s.attendeeSearchClear}
            onClick={() => setAttendeesSearch('')}
          ><X size={14} /></button>
        )}
      </div>

      {attendeesLoading ? (
        <div className={s.loadingNote}><Loader /> Loading attendees…</div>
      ) : attendees.length === 0 ? (
        <div className={s.emptyNote}>No attendees found.</div>
      ) : (
        <table className={s.attendeeTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Ticket</th>
              <th>Registration ID</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((reg) => (
              <tr key={reg.id} className={reg.status === 'cancelled' ? s.attendeeRowCancelled : ''}>
                <td>{reg.user?.name || '—'}</td>
                <td>{reg.ticketType || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{reg.id}</td>
                <td>
                  <span className={`${s.attendeeBadge} ${s[reg.status]}`}>{reg.status}</span>
                </td>
                <td>
                  {reg.status === 'registered' ? (
                    <button
                      type="button"
                      className={s.checkInBtn}
                      onClick={() => handleCheckIn(reg)}
                      disabled={checkingIn === reg.id}
                    >
                      {checkingIn === reg.id ? 'Checking in…' : 'Check In'}
                    </button>
                  ) : reg.status === 'attended' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success-text)' }}>
                      <Check size={14} /> Checked in
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AnalyticsTab({ eventId }: { eventId: string }) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<AnalyticsSummary>(`/events/${eventId}/analytics`)
      .then((data) => setAnalytics(data))
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return <div className={s.loadingNote}><Loader /> Loading analytics…</div>;
  }

  if (error || !analytics) {
    return <div className={s.emptyNote}>{error || 'No analytics data.'}</div>;
  }

  const formatPercent = (val: number) => `${Math.round(val * 100)}%`;
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const statCards: Array<{ label: string; value: string | number }> = [
    { label: 'Registered', value: analytics.registered },
    { label: 'Capacity', value: analytics.capacity > 0 ? analytics.capacity : '—' },
    { label: 'Attended', value: analytics.attended },
    { label: 'Cancelled', value: analytics.cancelled },
    { label: 'No-Shows', value: analytics.noShows },
    { label: 'Revenue', value: formatCurrency(analytics.revenue) },
  ];

  const maxTrend = Math.max(...analytics.registrationTrend.map((p) => p.registrations), 1);

  return (
    <div className={s.tabStack}>
      <div className={s.analyticsGrid}>
        {statCards.map((card) => (
          <div key={card.label} className={s.analyticsCard}>
            <span className={s.analyticsCardLabel}>{card.label}</span>
            <span className={s.analyticsCardValue}>{card.value}</span>
          </div>
        ))}
      </div>

      <div className={s.subBlock}>
        <span className={s.subBlockLabel}>Rates</span>
        <div className={s.tabStack}>
          <div className={s.rateIndicator}>
            <span className={s.rateText}>Attendance</span>
            <div className={s.rateBar}>
              <div className={`${s.rateBarFill} ${s.attendance}`} style={{ width: `${Math.round(analytics.attendanceRate * 100)}%` }} />
            </div>
            <span className={s.rateText}>{formatPercent(analytics.attendanceRate)}</span>
          </div>
          <div className={s.rateIndicator}>
            <span className={s.rateText}>Cancellation</span>
            <div className={s.rateBar}>
              <div className={`${s.rateBarFill} ${s.cancellation}`} style={{ width: `${Math.round(analytics.cancellationRate * 100)}%` }} />
            </div>
            <span className={s.rateText}>{formatPercent(analytics.cancellationRate)}</span>
          </div>
          <div className={s.rateIndicator}>
            <span className={s.rateText}>No-Show</span>
            <div className={s.rateBar}>
              <div className={`${s.rateBarFill} ${s.noShow}`} style={{ width: `${Math.round(analytics.noShowRate * 100)}%` }} />
            </div>
            <span className={s.rateText}>{formatPercent(analytics.noShowRate)}</span>
          </div>
          <div className={s.rateIndicator}>
            <span className={s.rateText}>Utilization</span>
            <div className={s.rateBar}>
              <div className={s.rateBarFill} style={{ width: `${Math.round(analytics.utilization * 100)}%`, background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)' }} />
            </div>
            <span className={s.rateText}>{formatPercent(analytics.utilization)}</span>
          </div>
        </div>
      </div>

      <div className={s.chartCard}>
        <div className={s.chartTitle}>Registration Trend</div>
        {analytics.registrationTrend.length === 0 ? (
          <div className={s.trendEmpty}>No registration data yet.</div>
        ) : (
           <div className={s.trendBarContainer}>
             {analytics.registrationTrend.map((point) => {
               const height = (point.registrations / maxTrend) * 100;
               return (
                 <div key={point.date} className={s.trendBarWrapper}>
                   <span className={s.trendBarCount}>{point.registrations}</span>
                   <div className={s.trendBar} style={{ height: `${height}%` }} />
                   <span className={s.trendBarLabel}>{new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                 </div>
               );
             })}
           </div>
        )}
      </div>
    </div>
  );
}

export default function ViewEventPage() {
  const { id: rawId = '' } = useParams();
  const eventId = typeof rawId === 'string' ? rawId : (Array.isArray(rawId) ? rawId[0] : '');

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<{ type: ConfirmAction } | null>(null);
  const [acting, setActing] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['overview']));

  /* ── Load event ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApi<Event>(`/events/${eventId}`);
        setEvent(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load event details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const handleEdit = () => {
    router.push(`/admin/events/${eventId}`);
  };

  const handleDelete = async () => {
    if (!eventId) return;
    setActing(true);
    try {
      await fetchApi(`/events/${eventId}`, { method: 'DELETE' });
      setToast({ message: 'Event permanently deleted.', type: 'success' });
      setTimeout(() => router.push('/admin/events'), 1000);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Failed to delete event.', type: 'error' });
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const handleTabChange = (tabId: string) => {
    setVisitedTabs((prev) => new Set([...prev, tabId]));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Loader />
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>Event not found.</div>
        <Link href="/admin/events" className={styles.backButton}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
      </div>
    );
  }

  const statusBadge = event?.status === 'upcoming' ? 'upcoming'
    : event?.status === 'completed' ? 'completed'
    : event?.status === 'archived' ? 'archived'
    : 'inactive';

  const tabItems: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <Calendar size={16} />,
      panel: (
        <div className={s.tabStack}>
          <div className={s.subBlock}>
            <span className={s.subBlockLabel}>Basic Information</span>
            <div className={styles.grid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Title</span>
                <span className={styles.infoValue}>{event?.title}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Description</span>
                <span className={styles.infoValue}>{event?.description || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Category</span>
                <span className={styles.infoValue}>{event?.category}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Type</span>
                <span className={`${styles.infoValue} ${styles.badge} ${styles.free}`}>{event?.type}</span>
              </div>
            </div>
          </div>

          <div className={s.subBlock}>
            <span className={s.subBlockLabel}>Scheduling</span>
            <div className={styles.grid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Date & Time</span>
                <span className={styles.infoValue}>{formatDateTime(event?.date)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Location</span>
                <span className={styles.infoValue}>{event?.location || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Host</span>
                <span className={styles.infoValue}>{event?.host || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status</span>
                <span className={`${styles.badge} ${styles[statusBadge] || styles.inactive}`}>{event?.status}</span>
              </div>
            </div>
          </div>

          <div className={s.subBlock}>
            <span className={s.subBlockLabel}>Capacity &amp; Attendance</span>
            <div className={styles.grid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Capacity</span>
                <span className={styles.infoValue}>{event?.capacity || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Registered</span>
                <span className={styles.infoValue}>{event?.registeredCount ?? 0}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Checked In</span>
                <span className={styles.infoValue}>{event?.checkedInCount ?? 0}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Attendees (legacy)</span>
                <span className={styles.infoValue}>{event?.attendees ?? 0}</span>
              </div>
            </div>
          </div>

          <div className={s.subBlock}>
            <span className={s.subBlockLabel}>Reminders</span>
            <div className={styles.grid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Enabled</span>
                <span className={styles.infoValue}>{event?.reminderConfig?.enabled ? 'Yes' : 'No'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Send Before (hours)</span>
                <span className={styles.infoValue}>{event?.reminderConfig?.sendBeforeHours ?? 24}</span>
              </div>
            </div>
          </div>

          <div className={s.subBlock}>
            <span className={s.subBlockLabel}>Timestamps</span>
            <div className={styles.grid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Created At</span>
                <span className={styles.infoValue}>{formatDateTime(event?.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Updated At</span>
                <span className={styles.infoValue}>{formatDateTime(event?.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'attendees',
      label: 'Attendees',
      icon: <Users size={16} />,
      panel: visitedTabs.has('attendees')
        ? <AttendeesTab eventId={eventId} event={event} />
        : <div className={s.emptyNote}>Loading attendees…</div>,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <Tag size={16} />,
      panel: visitedTabs.has('analytics')
        ? <AnalyticsTab eventId={eventId} />
        : <div className={s.emptyNote}>Loading analytics…</div>,
    },
  ];

  return (
    <div className={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.header}>
        <Link href="/admin/events" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
        <h1 className={styles.title}>Event Details</h1>
        <p className={styles.subtitle}>View complete information for {event?.title}</p>
      </div>

      {/* Summary card */}
      <div className={styles.summaryCard}>
        <div className={styles.eventImageWrapper}>
          {event?.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} className={styles.eventImage} />
          ) : (
            <div className={styles.eventImagePlaceholder}>
              <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>
        <div className={styles.summaryInfo}>
          <h2 className={styles.summaryName}>{event?.title}</h2>
          <span className={styles.infoValue}>{formatDateTime(event?.date)}</span>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles[statusBadge] || styles.inactive}`}>
              {event?.status}
            </span>
            <span className={`${styles.badge} ${styles.free}`}>
              {event?.type}
            </span>
            <span className={`${styles.badge} ${styles.free}`}>
              {event?.category}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <Tabs tabs={tabItems} defaultTab="overview" ariaLabel="Event sections" onTabChange={handleTabChange} />

        {/* Actions section */}
        <div className={s.dangerZone}>
          <h3 className={s.dangerTitle}>Event Actions</h3>
          <p className={s.dangerDesc}>
            Modify or delete <strong>{event?.title}</strong>. These actions are sensitive and require confirmation.
          </p>
          <div className={s.accountActions}>
            <PermissionGate permission="EVENTS_MANAGE">
              <button
                type="button"
                className={`${s.actionBtn} ${s.activate}`}
                onClick={handleEdit}
                disabled={acting}
              >
                <Pencil size={16} /> Edit Event
              </button>
              <button
                type="button"
                className={`${s.actionBtn} ${s.block}`}
                onClick={() => setConfirm({ type: 'delete' })}
                disabled={acting}
              >
                <Trash2 size={16} /> Delete Event
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className={styles.actions}>
        <Link href="/admin/events" className={styles.backButton}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
      </div>

      {confirm && (
        <ConfirmModal
          isOpen
          variant="danger"
          title="Delete Event"
          message={
            <>
              Are you sure you want to <strong>delete</strong>{' '}
              <strong>{event?.title}</strong>?{' '}
              This permanently deletes the event and all of its registrations and check-in records. This cannot be undone.
            </>
          }
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
