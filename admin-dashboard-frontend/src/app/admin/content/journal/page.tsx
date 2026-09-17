'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { BookOpen, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface JournalPrompt {
  id: string;
  text: string;
  category: string;
  status: string;
}

export default function JournalPage(){
  const [prompts,setPrompts]=useState<JournalPrompt[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(()=>{
    fetchApi<JournalPrompt[]>('/journalPrompts').then(setPrompts).catch(console.error).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{ setCurrentPage(1); },[search]);

  const filtered=prompts.filter(p=>p.text.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Journal &amp; Wellness Content</h1>
        <p className={styles.subtitle}>Manage daily journal prompts and mental wellness insights.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search prompts..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No journal prompts" description="No journal prompts are available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Prompt Text</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(p=> (
                  <tr key={p.id}>
                    <td>{p.text}</td>
                    <td>{p.category}</td>
                    <td><span className={`${styles.statusBadge} ${p.status==='active'?styles.active:styles.suspended}`}>{p.status}</span></td>
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
