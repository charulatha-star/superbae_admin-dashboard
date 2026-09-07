'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { BarChart2, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AnalyticsUser {
  id: string;
  date: string;
  newUsers: number;
  activeUsers: number;
  churned: number;
  sessions: number;
  avgSessionTime: number;
}

export default function AnalyticsUsersPage(){
  const [data,setData]=useState<AnalyticsUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<AnalyticsUser[]>('/analyticsUsers').then(setData).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const normalizedSearch = search.toLowerCase();
  const filtered=data.filter(u=>u.date.toLowerCase().includes(normalizedSearch));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Analytics</h1>
          <p className={styles.subtitle}>Overview of user activity and engagement metrics.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          {label:'Total Users',value:data.length,color: 'var(--primary)'},
          {label:'Avg Sessions',value:data.length ? Math.round(data.reduce((s,u)=>s+u.sessions,0)/data.length) : 0,color: 'var(--success)'},
          {label:'Avg Active Users',value:data.length ? Math.round(data.reduce((s,u)=>s+u.activeUsers,0)/data.length) : 0,color: 'var(--warning)'},
          {label:'Avg Session Time',value:data.length ? `${Math.round(data.reduce((s,u)=>s+u.avgSessionTime,0)/data.length)}m` : '0m',color: 'var(--primary-dark)'}
        ].map(stat=>(
          <div key={stat.label} className={styles.statCard}>
            <BarChart2 size={20} className={styles.statIcon} style={{color:stat.color}}/>
            <div>
              <div className={styles.statValue} style={{color:stat.color}}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search date..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No analytics data" description="No user analytics are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>New Users</th>
                <th>Active Users</th>
                <th>Churned</th>
                <th>Sessions</th>
                <th>Avg Session Time</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(u=>(
                <tr key={u.id}>
                  <td>{new Date(u.date).toLocaleDateString()}</td>
                  <td>{u.newUsers}</td>
                  <td>{u.activeUsers}</td>
                  <td>{u.churned}</td>
                  <td>{u.sessions}</td>
                  <td>{u.avgSessionTime}m</td>
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
