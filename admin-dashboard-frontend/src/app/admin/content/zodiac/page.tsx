'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../../components/admin/PermissionGate';
import { Edit2, Eye, Plus, Search } from 'lucide-react';
import styles from '../../users/page.module.css';
import ContentStatusBadge from '../ContentStatusBadge';

interface ZodiacEntry {
  id: string;
  sign: string;
  date: string;
  horoscope: string;
  love: string;
  career: string;
  status: string;
  scheduledAt?: string | null;
}

export default function ZodiacPage() {
  const [items, setItems] = useState<ZodiacEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApi<ZodiacEntry[]>('/zodiac').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(z => z.sign.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Zodiac Content</h1>
          <p className={styles.subtitle}>Manage daily horoscope and zodiac content.</p>
        </div>
        <PermissionGate permission="CONTENT_MANAGE">
          <Link href="/admin/content/zodiac/new" className={styles.createBtn}>
            <Plus size={16} /> Create Zodiac Entry
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search zodiac sign..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No zodiac content" description="No zodiac content is available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Sign</th>
                <th>Date</th>
                <th>Horoscope</th>
                <th>Love</th>
                <th>Career</th>
                <th>Status</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.sign}</strong></td>
                  <td>{item.date}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.horoscope}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.love}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.career}</td>
                  <td><ContentStatusBadge status={item.status} scheduledAt={item.scheduledAt} /></td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionButtons}>
                      <Link href={`/admin/content/zodiac/${item.id}/view`} className={styles.iconBtn} title="View">
                        <Eye size={16} />
                      </Link>
                      <PermissionGate permission="CONTENT_MANAGE">
                        <Link href={`/admin/content/zodiac/${item.id}`} className={styles.iconBtn} title="Edit">
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
