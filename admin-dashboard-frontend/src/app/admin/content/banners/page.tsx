'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../../components/admin/PermissionGate';
import { Edit2, Eye, Image, Plus, Search } from 'lucide-react';
import styles from '../../users/page.module.css';
import ContentStatusBadge from '../ContentStatusBadge';

interface Banner {
  id: string;
  title: string;
  placement: string;
  status: string;
  scheduledAt?: string | null;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
}

export default function BannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApi<Banner[]>('/banners').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.placement.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Banners</h1>
          <p className={styles.subtitle}>Manage promotional banners across the platform.</p>
        </div>
        <PermissionGate permission="CONTENT_MANAGE">
          <Link href="/admin/content/banners/new" className={styles.createBtn}>
            <Plus size={16} /> Create Banner
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Banners', value: items.length, color: '#0891b2' },
          { label: 'Active', value: items.filter(i => i.status === 'active').length, color: '#16a34a' },
          { label: 'Total Clicks', value: items.reduce((s, i) => s + i.clicks, 0), color: '#7c3aed' },
          { label: 'Total Impressions', value: items.reduce((s, i) => s + i.impressions, 0), color: '#d97706' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <Image size={20} className={styles.statIcon} style={{ color: stat.color }} />
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
          <input type="text" placeholder="Search banners..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No banners" description="No promotional banners are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Placement</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(banner => (
                <tr key={banner.id}>
                  <td><strong>{banner.title}</strong></td>
                  <td><code style={{ fontSize: '0.8rem' }}>{banner.placement}</code></td>
                  <td><ContentStatusBadge status={banner.status} scheduledAt={banner.scheduledAt} /></td>
                  <td>{banner.startDate}</td>
                  <td>{banner.endDate}</td>
                  <td>{banner.clicks.toLocaleString()}</td>
                  <td>{banner.impressions.toLocaleString()}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionButtons}>
                      <Link href={`/admin/content/banners/${banner.id}/view`} className={styles.iconBtn} title="View">
                        <Eye size={16} />
                      </Link>
                      <PermissionGate permission="CONTENT_MANAGE">
                        <Link href={`/admin/content/banners/${banner.id}`} className={styles.iconBtn} title="Edit">
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