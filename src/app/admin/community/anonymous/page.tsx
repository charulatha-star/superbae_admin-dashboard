'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { MessageSquare, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AnonymousPost {
  id: string;
  content: string;
  status: string;
  reportCount: number;
  createdAt: string;
}

export default function AnonymousForumPage(){
  const [posts,setPosts]=useState<AnonymousPost[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<AnonymousPost[]>('/anonymousPosts').then(setPosts).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=posts.filter(p=>p.content.toLowerCase().includes(search.toLowerCase()));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Anonymous Forum Moderation</h1>
        <p className={styles.subtitle}>Review flagged posts and manage the anonymous community.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search posts..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No posts" description="No anonymous posts are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Content Snippet</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Date Posted</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(p=> (
                <tr key={p.id}>
                  <td>{p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content}</td>
                  <td><span className={`${styles.statusBadge} ${p.status==='approved'?styles.active:styles.suspended}`}>{p.status}</span></td>
                  <td style={{color: p.reportCount > 0 ? '#ef4444' : 'inherit', fontWeight: p.reportCount > 0 ? 'bold' : 'normal'}}>{p.reportCount}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
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
