'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Flag, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface Report {
  id: string;
  reportId: string;
  reporter: string;
  reportedUser: string;
  reason: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function ReportsPage(){
  const [reports,setReports]=useState<Report[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');

  useEffect(()=>{
    fetchApi<Report[]>('/safetyReports').then(setReports).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=reports.filter(r=>{
    const matchSearch=r.reason.toLowerCase().includes(search.toLowerCase()) || r.reporter.toLowerCase().includes(search.toLowerCase());
    const matchFilter=filter==='all' || r.status===filter;
    return matchSearch && matchFilter;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Safety Reports</h1>
          <p className={styles.subtitle}>Review user‑submitted safety reports and take action.</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search reports..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No safety reports" description="No safety reports are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Report ID</th>
                <th>User</th>
                <th>Type (Severity)</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(r=> (
                <tr key={r.id}>
                  <td>{r.reportId}</td>
                  <td>{r.reporter}</td>
                  <td>{r.severity}</td>
                  <td>{r.reason}</td>
                  <td><span className={`${styles.badge} ${r.status==='pending'?styles.suspended:r.status==='resolved'?styles.active:styles.inactive}`}>{r.status}</span></td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
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
