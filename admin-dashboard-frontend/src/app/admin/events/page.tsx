'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { Calendar, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface Event {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  attendees: number;
  host: string;
  category: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Event[]>('/events').then(setEvents).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>Manage and monitor all platform events.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Events', value: events.length, color: '#2563eb' },
          { label: 'Upcoming', value: events.filter(e => e.status === 'upcoming').length, color: '#16a34a' },
          { label: 'Completed', value: events.filter(e => e.status === 'completed').length, color: '#6b7280' },
          { label: 'Total Attendees', value: events.reduce((s, e) => s + e.attendees, 0), color: '#7c3aed' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <Calendar size={20} className={styles.statIcon} style={{ color: stat.color }} />
            <div>
              <div className={styles.statValue} style={{ color: stat.color }}>{stat.value.toLocaleString()}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(event => (
                <tr key={event.id}>
                  <td><strong>{event.title}</strong></td>
                  <td>{event.category}</td>
                  <td><span className={`${styles.badge} ${styles.free}`}>{event.type}</span></td>
                  <td>{new Date(event.date).toLocaleDateString()}</td>
                  <td>{event.host}</td>
                  <td>{event.attendees}</td>
                  <td><span className={`${styles.badge} ${event.status === 'upcoming' ? styles.active : styles.inactive}`}>{event.status}</span></td>
                </tr>
              ))}
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
    </div>
  );
}
