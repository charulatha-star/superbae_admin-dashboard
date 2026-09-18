'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../../components/admin/PermissionGate';
import { Edit2, Eye, Plus, Search, Star } from 'lucide-react';
import styles from '../../users/page.module.css';
import ContentStatusBadge from '../ContentStatusBadge';

interface Affirmation {
  id: string;
  text: string;
  category: string;
  status: string;
  scheduledAt?: string | null;
  createdAt: string;
}

export default function AffirmationsPage() {
  const [items, setItems] = useState<Affirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApi<Affirmation[]>('/affirmations').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(a =>
    a.text.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Affirmations</h1>
          <p className={styles.subtitle}>Manage daily affirmation content.</p>
        </div>
        <PermissionGate permission="CONTENT_MANAGE">
          <Link href="/admin/content/affirmations/new" className={styles.createBtn}>
            <Plus size={16} /> Create Affirmation
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total', value: items.length, color: '#7c3aed' },
          { label: 'Published', value: items.filter(i => i.status === 'published').length, color: '#16a34a' },
          { label: 'Draft', value: items.filter(i => i.status === 'draft').length, color: '#d97706' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <Star size={20} className={styles.statIcon} style={{ color: stat.color }} />
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
          <input type="text" placeholder="Search affirmations..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No affirmations" description="No affirmations are available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Text</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(item => (
                  <tr key={item.id}>
                    <td>{item.text}</td>
                    <td>{item.category}</td>
                    <td><ContentStatusBadge status={item.status} scheduledAt={item.scheduledAt} /></td>
                    <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionButtons}>
                        <Link href={`/admin/content/affirmations/${item.id}/view`} className={styles.iconBtn} title="View">
                          <Eye size={16} />
                        </Link>
                        <PermissionGate permission="CONTENT_MANAGE">
                          <Link href={`/admin/content/affirmations/${item.id}`} className={styles.iconBtn} title="Edit">
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
