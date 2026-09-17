'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { Calendar, Search, Plus, Trash2, Eye, Users } from 'lucide-react';
import { PermissionGate } from '../../../components/admin/PermissionGate';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { Toast } from '../../../components/admin/Toast';
import styles from '../users/page.module.css';
import eventStyles from './page.module.css';

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
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Event[]>('/events').then(setEvents).catch(console.error).finally(() => setLoading(false));
  }, []);

  const deleteEvent = async () => {
    if (!deleteId) return;
    try {
      await fetchApi(`/events/${deleteId}`, { method: 'DELETE' });
      setEvents((current) => current.filter((item) => item.id !== deleteId));
      setToast({ message: 'Event permanently deleted.', type: 'success' });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Failed to delete event.', type: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalAttendees = events.reduce((s, e) => s + (e.attendees || 0), 0);
  const totalUpcoming = events.filter(e => e.status === 'upcoming').length;
  const totalCompleted = events.filter(e => e.status === 'completed').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>Manage and monitor all platform events.</p>
        </div>
        <PermissionGate permission="EVENTS_MANAGE">
          <button type="button" className={styles.createBtn} onClick={() => router.push('/admin/events/new')}><Plus size={16} /> Create Event</button>
        </PermissionGate>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Calendar size={20} className={styles.statIcon} style={{ color: '#2563eb' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#2563eb' }}>{events.length}</div>
            <div className={styles.statLabel}>Total Events</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Calendar size={20} className={styles.statIcon} style={{ color: '#16a34a' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#16a34a' }}>{totalUpcoming}</div>
            <div className={styles.statLabel}>Upcoming</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Calendar size={20} className={styles.statIcon} style={{ color: '#6b7280' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#6b7280' }}>{totalCompleted}</div>
            <div className={styles.statLabel}>Completed</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#7c3aed' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#7c3aed' }}>{totalAttendees}</div>
            <div className={styles.statLabel}>Total Attendees</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No events" description="No events are available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Host</th>
                  <th>Attendees</th>
                  <th>Capacity</th>
                  <th>Checked In</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(event => {
                  const capacityValue = event.capacity || 1;
                  const registeredValue = event.registeredCount || 0;
                  const capacityPercent = Math.min((registeredValue / capacityValue) * 100, 100);
                  const checkedInValue = event.checkedInCount || 0;
                  const checkedInPercent = Math.min((checkedInValue / capacityValue) * 100, 100);
                  return (
                    <tr key={event.id}>
                      <td><strong>{event.title}</strong></td>
                      <td>{event.category}</td>
                      <td><span className={`${styles.badge} ${styles.free}`}>{event.type}</span></td>
                      <td>{new Date(event.date).toLocaleDateString()}</td>
                      <td>{event.host}</td>
                      <td>{event.attendees}</td>
                      <td>
                        <div className={eventStyles.capacityCell}>
                          <div className={eventStyles.capacityBar}>
                            <div className={eventStyles.capacityBarFill} style={{ width: `${capacityPercent}%` }} />
                          </div>
                          <div className={eventStyles.capacityText}>{registeredValue} / {event.capacity || '—'}</div>
                        </div>
                      </td>
                      <td>
                        <div className={eventStyles.capacityCell}>
                          <div className={eventStyles.capacityBar}>
                            <div className={eventStyles.capacityBarFill} style={{ width: `${checkedInPercent}%`, background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)' }} />
                          </div>
                          <div className={eventStyles.capacityText}>{checkedInValue} / {event.capacity || '—'}</div>
                        </div>
                      </td>
                      <td><span className={`${styles.badge} ${eventStyles[event.status] || styles.inactive}`}>{event.status}</span></td>
                      <td>
                        <div className={styles.actionButtons}>
                          <PermissionGate permission="EVENTS_MANAGE">
                            <span className={eventStyles.tooltip} data-tip="View event details">
                              <button type="button" className={styles.iconBtn} onClick={() => router.push(`/admin/events/${event.id}/view`)}><Eye size={15} /></button>
                            </span>
                            <span className={eventStyles.tooltip} data-tip="Delete event">
                              <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => setDeleteId(event.id)}><Trash2 size={15} /></button>
                            </span>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</button>
                <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal isOpen={!!deleteId} title="Delete event" message="This permanently deletes this event and all of its registrations and check-in records. This cannot be undone." confirmText="Delete" variant="danger" onConfirm={deleteEvent} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
