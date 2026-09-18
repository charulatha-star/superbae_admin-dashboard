'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../../components/admin/PermissionGate';
import { Edit2, Eye, Lightbulb, Plus, Search } from 'lucide-react';
import styles from '../../users/page.module.css';
import ContentStatusBadge from '../ContentStatusBadge';
import { formatContentDate } from '../contentFormat';

interface Tip {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  scheduledAt?: string | null;
  views: number;
  createdAt: string;
}

export default function TipsPage() {
  const [items, setItems] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApi<Tip[]>('/tips').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Defensive: documents that don't match the schema (missing/renamed fields) must
  // never break the list, so coerce every searched field to a string first.
  const needle = search.toLowerCase();
  const filtered = items.filter(t =>
    String(t.title ?? '').toLowerCase().includes(needle) ||
    String(t.category ?? '').toLowerCase().includes(needle)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Wellness Tips</h1>
          <p className={styles.subtitle}>Manage health and wellness tip content.</p>
        </div>
        <PermissionGate permission="CONTENT_MANAGE">
          <Link href="/admin/content/tips/new" className={styles.createBtn}>
            <Plus size={16} /> Create Tip
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Tips', value: items.length, color: '#16a34a' },
          { label: 'Published', value: items.filter(i => i.status === 'published').length, color: '#2563eb' },
          { label: 'Total Views', value: items.reduce((s, i) => s + (Number(i.views) || 0), 0), color: '#7c3aed' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <Lightbulb size={20} className={styles.statIcon} style={{ color: stat.color }} />
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
          <input type="text" placeholder="Search tips..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No tips" description="No wellness tips are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Views</th>
                <th>Status</th>
                <th>Created</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(tip => (
                <tr key={tip.id}>
                  <td><strong>{tip.title}</strong></td>
                  <td>{tip.category}</td>
                  <td>{(Number(tip.views) || 0).toLocaleString()}</td>
                  <td><ContentStatusBadge status={tip.status} scheduledAt={tip.scheduledAt} /></td>
                  <td>{formatContentDate(tip.createdAt)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionButtons}>
                      <Link href={`/admin/content/tips/${tip.id}/view`} className={styles.iconBtn} title="View">
                        <Eye size={16} />
                      </Link>
                      <PermissionGate permission="CONTENT_MANAGE">
                        <Link href={`/admin/content/tips/${tip.id}`} className={styles.iconBtn} title="Edit">
                          <Edit2 size={16} />
                        </Link>
                      </PermissionGate>
                    </div>
                  </td>
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
