'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { ClipboardList, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  description: string;
  createdAt: string;
}

const actionColor: Record<string, string> = {
  'admin.created': '#2563eb',
  'admin.deleted': '#dc2626',
  'role.updated': '#7c3aed',
  'user.suspended': '#d97706',
  'content.published': '#16a34a',
  'payment.refunded': '#0891b2',
  'report.resolved': '#16a34a',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<AuditLog[]>('/auditLogs').then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>Track all administrative actions across the platform.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <ClipboardList size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statValue}>{logs.length}</div>
            <div className={styles.statLabel}>Total Events</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No audit logs" description="No audit logs are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Action</th>
                <th>Description</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(log => (
                <tr key={log.id}>
                  <td>{log.adminName}</td>
                  <td>
                    <span style={{
                      backgroundColor: `${actionColor[log.action] || '#6b7280'}20`,
                      color: actionColor[log.action] || '#6b7280',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.description}</td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
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
