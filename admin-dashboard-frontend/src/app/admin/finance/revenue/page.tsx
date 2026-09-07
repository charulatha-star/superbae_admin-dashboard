'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { DollarSign, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface Revenue {
  id: string;
  month: string;
  gross: number;
  refunds: number;
  net: number;
}

export default function RevenuePage() {
  const [data, setData] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Revenue[]>('/revenue').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(r => r.month.includes(search));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Revenue</h1>
          <p className={styles.subtitle}>Financial revenue overview and breakdowns.</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search by date (YYYY-MM-DD)" value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No revenue data" description="No revenue records are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Gross Revenue (USD)</th>
                <th>Net Revenue (USD)</th>
                <th>Refunds (USD)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.month}</td>
                  <td>${entry.gross.toLocaleString()}</td>
                  <td>${entry.net.toLocaleString()}</td>
                  <td>${entry.refunds.toLocaleString()}</td>
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
