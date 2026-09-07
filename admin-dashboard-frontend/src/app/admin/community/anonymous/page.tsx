'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Search, Eye, AlertTriangle } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AnonymousPost {
  id: string;
  content: string;
  status: string;
  reportCount?: number;
  riskScore?: number;
  createdAt: string;
  updatedAt?: string;
}

interface QueueResponse {
  data: AnonymousPost[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const tabs = ['all', 'reported', 'flagged', 'removed', 'hidden'] as const;
type QueueFilter = (typeof tabs)[number];

export default function AnonymousForumPage() {
  const [response, setResponse] = useState<QueueResponse>({ data: [], total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(()=>{
    setLoading(true);
    fetchApi<QueueResponse>(`/anonymousPosts?filter=${filter}&search=${encodeURIComponent(search)}&page=${page}&limit=10`, {}, true)
      .then(setResponse).catch(console.error).finally(()=>setLoading(false));
  }, [filter, page, search]);

  const setTab = (next: QueueFilter) => { setFilter(next); setPage(1); };

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Anonymous Forum Moderation</h1>
          <p className={styles.subtitle}>Review anonymous posts by risk, reports, and status.</p>
        </div>
        <Link href="/admin/community/anonymous/history" className={styles.secondaryBtn}>Moderation History</Link>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search posts..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Anonymous post status">
        {tabs.map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={filter === tab} className={`${styles.tab} ${filter === tab ? styles.tabActive : ''}`} onClick={() => setTab(tab)}>
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : response.data.length === 0 ? (
          <NoData title="No posts" description="No anonymous posts are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Content Snippet</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Risk</th>
                <th>Date Posted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {response.data.map(p=> (
                <tr key={p.id}>
                  <td>{p.content.length > 64 ? p.content.slice(0, 64) + '...' : p.content}</td>
                  <td><span className={`${styles.statusBadge} ${p.status === 'active' || p.status === 'approved' ? styles.active : p.status === 'hidden' ? styles.inactive : styles.suspended}`}>{p.status}</span></td>
                  <td style={{color: (p.reportCount || 0) > 0 ? '#ef4444' : 'inherit', fontWeight: (p.reportCount || 0) > 0 ? 'bold' : 'normal'}}>{p.reportCount || 0}</td>
                  <td>{p.riskScore == null ? '—' : <span className={p.riskScore >= 70 ? styles.riskHigh : p.riskScore >= 40 ? styles.riskMedium : styles.riskLow}><AlertTriangle size={13} /> {p.riskScore}</span>}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td><Link href={`/admin/community/anonymous/${p.id}/view`} className={styles.iconBtn} title="View post"><Eye size={16} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
            {response.pages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Previous</button>
                <span className={styles.paginationText}>Page {response.page} of {response.pages}</span>
                <button className={styles.paginationBtn} onClick={() => setPage(p => Math.min(response.pages, p + 1))} disabled={page === response.pages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
