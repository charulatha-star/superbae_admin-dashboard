'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { Shield, AlertTriangle, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface SecurityEvent {
  id: string;
  type: string;
  description: string;
  ip: string;
  user: string;
  severity: string;
  createdAt: string;
  resolved: boolean;
}

export default function SecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<SecurityEvent[]>('/security').then(setEvents).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.user.toLowerCase().includes(search.toLowerCase()) ||
      e.ip.includes(search);
    const matchFilter = filter === 'all' || (filter === 'unresolved' ? !e.resolved : e.resolved);
    return matchSearch && matchFilter;
  });

  const severityClass: Record<string, string> = { high: 'suspended', medium: 'premium', low: 'inactive' };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Security Events</h1>
          <p className={styles.subtitle}>Monitor security alerts and suspicious activity.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Events', value: events.length, color: '#2563eb' },
          { label: 'Unresolved', value: events.filter(e => !e.resolved).length, color: '#dc2626' },
          { label: 'High Severity', value: events.filter(e => e.severity === 'high').length, color: '#b91c1c' },
          { label: 'Resolved', value: events.filter(e => e.resolved).length, color: '#16a34a' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <Shield size={20} className={styles.statIcon} style={{ color: stat.color }} />
            <div>
              <div className={styles.statValue} style={{ color: stat.color }}>{stat.value}</div>
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
        <select value={filter} onChange={e => setFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No security events" description="No security events are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>User</th>
                <th>IP Address</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(event => (
                <tr key={event.id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.type}</span></td>
                  <td>{event.description}</td>
                  <td>{event.user}</td>
                  <td><code>{event.ip}</code></td>
                  <td><span className={`${styles.badge} ${styles[severityClass[event.severity] || 'inactive']}`}>{event.severity}</span></td>
                  <td>
                    <span className={`${styles.badge} ${event.resolved ? styles.active : styles.suspended}`}>
                      {event.resolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                  <td>{new Date(event.createdAt).toLocaleDateString()}</td>
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
