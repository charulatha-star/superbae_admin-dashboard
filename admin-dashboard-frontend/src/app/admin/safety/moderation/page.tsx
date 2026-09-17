'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { ShieldCheck, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface ModerationItem {
  id: string;
  content: string;
  contentType: string;
  severity: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchApi<ModerationItem[]>('/safetyModeration').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => {
    const matchSearch = i.reason.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || i.status === filter;
    return matchSearch && matchFilter;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Moderation Queue</h1>
          <p className={styles.subtitle}>Review flagged content and take moderation actions.</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search moderation items..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No moderation items" description="No flagged content is available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Content</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.content}</td>
                    <td>{item.contentType}</td>
                    <td>{item.severity}</td>
                    <td>{item.reason}</td>
                    <td><span className={`${styles.badge} ${item.status === 'pending' ? styles.suspended : item.status === 'actioned' ? styles.active : styles.inactive}`}>{item.status}</span></td>
                    <td>{new Date(item.severity).toLocaleDateString()}</td>
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
