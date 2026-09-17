'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Check, X } from 'lucide-react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import styles from './shared.module.css';

export interface ReportItem {
  id: string;
  contentId?: string;
  postId?: string;
  commentId?: string;
  reporter?: string;
  reporterName?: string;
  reportedUser?: string;
  author?: string;
  reason?: string;
  content?: string;
  excerpt?: string;
  status?: string;
  createdAt?: string;
}

interface ReportedListProps {
  resource: 'reportedPosts' | 'reportedComments';
  title: string;
  subtitle: string;
  contentLabel: string;
}

export function ReportedList({ resource, title, subtitle, contentLabel }: ReportedListProps) {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ item: ReportItem; action: 'dismiss' | 'remove' } | null>(null);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  useEffect(() => {
    fetchApi<ReportItem[]>(`/${resource}`).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [resource]);

  const reporterOf = (r: ReportItem) => r.reporterName || r.reporter || 'Unknown';
  const contentOf = (r: ReportItem) => r.content || r.excerpt || '';

  const filtered = items.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      contentOf(r).toLowerCase().includes(q) ||
      reporterOf(r).toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || (r.status || 'pending') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const applyAction = async () => {
    if (!confirmAction) return;
    const { item, action } = confirmAction;
    try {
      const status = action === 'dismiss' ? 'dismissed' : 'removed';
      const updated = await fetchApi<ReportItem>(`/${resource}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolvedAt: new Date().toISOString() }),
      });
      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, ...updated } : r)));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmAction(null);
    }
  };

  const pendingCount = items.filter((r) => (r.status || 'pending') === 'pending').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <X size={20} className={styles.statIcon} style={{ color: '#dc2626' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#dc2626' }}>{pendingCount}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Check size={20} className={styles.statIcon} style={{ color: '#16a34a' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#16a34a' }}>
              {items.filter((r) => (r.status || 'pending') !== 'pending').length}
            </div>
            <div className={styles.statLabel}>Resolved</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
          <option value="pending">Pending</option>
          <option value="dismissed">Dismissed</option>
          <option value="removed">Removed</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No reports found" description="No reports match your filters." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{contentLabel}</th>
                  <th>Reporter</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((report) => {
                  const status = report.status || 'pending';
                  const contentLink = report.postId ? `/admin/community/posts/${report.postId}` : null;
                  return (
                    <tr key={report.id}>
                      <td className={styles.postTitleCell}>
                        <p className={styles.postExcerpt} style={{ whiteSpace: 'normal' }}>{contentOf(report) || '—'}</p>
                      </td>
                      <td>{reporterOf(report)}</td>
                      <td>{report.reason || '—'}</td>
                      <td><span className={`${styles.badge} ${styles[status] || ''}`}>{status}</span></td>
                      <td>{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          {contentLink && status === 'pending' && (
                            <Link href={contentLink} className={styles.iconBtn} title="View content">
                              <Search size={16} />
                            </Link>
                          )}
                          {status === 'pending' && (
                            <>
                              <button type="button" className={`${styles.iconBtn} ${styles.successBtn}`} title="Dismiss report" onClick={() => setConfirmAction({ item: report, action: 'dismiss' })}>
                                <Check size={16} />
                              </button>
                              <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Remove content" onClick={() => setConfirmAction({ item: report, action: 'remove' })}>
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</button>
                <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.action === 'dismiss' ? 'Dismiss Report' : 'Remove Content'}
        message={
          confirmAction?.action === 'dismiss'
            ? 'Are you sure you want to dismiss this report? No action will be taken against the content.'
            : 'Are you sure you want to remove the reported content? This will mark the content as removed.'
        }
        confirmText={confirmAction?.action === 'dismiss' ? 'Dismiss' : 'Remove'}
        variant={confirmAction?.action === 'dismiss' ? 'primary' : 'danger'}
        onConfirm={applyAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

