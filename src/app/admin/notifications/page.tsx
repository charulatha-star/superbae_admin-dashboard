'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { Bell, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface Notification {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledFor: string;
  targetSegment: string;
}

export default function NotificationsPage(){
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<Notification[]>('/notifications').then(setNotifications).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=notifications.filter(n=>n.title.toLowerCase().includes(search.toLowerCase()));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notifications & Campaigns</h1>
        <p className={styles.subtitle}>Manage push notifications, emails, and marketing campaigns.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search campaigns..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No notifications" description="No notifications or campaigns are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Target Segment</th>
                <th>Scheduled For</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(n=> (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  <td>{n.type}</td>
                  <td>{n.targetSegment}</td>
                  <td>{new Date(n.scheduledFor).toLocaleString()}</td>
                  <td><span className={`${styles.statusBadge} ${n.status==='scheduled'?styles.active:styles.suspended}`}>{n.status}</span></td>
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
