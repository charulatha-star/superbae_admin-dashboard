'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../components/admin/PermissionGate';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { Toast } from '../../../components/admin/Toast';
import { Bell, Search, Plus, Edit2, Trash2 } from 'lucide-react';
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<Notification[]>('/notifications');
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setToast({ message: 'Failed to load notifications', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    fetchData();
  },[]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetchApi(`/notifications/${deleteId}`, { method: 'DELETE' });
      setNotifications(notifications.filter(n => n.id !== deleteId));
      setToast({ message: 'Notification deleted successfully', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to delete notification', type: 'error' });
    } finally {
      setDeleteId(null);
    }
  };



  const filtered=notifications.filter(n=>n.title.toLowerCase().includes(search.toLowerCase()));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Notification"
        message="Are you sure you want to delete this notification/campaign? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
        confirmText="Delete"
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications & Campaigns</h1>
          <p className={styles.subtitle}>Manage push notifications, emails, and marketing campaigns.</p>
        </div>
        <PermissionGate permission="notifications.manage">
          <Link href="/admin/notifications/create" className={styles.createBtn}>
            <Plus size={16} /> Create Notification
          </Link>
        </PermissionGate>
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
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(n=> (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  <td>{n.type}</td>
                  <td>{n.targetSegment}</td>
                  <td>{n.scheduledFor ? new Date(n.scheduledFor).toLocaleString() : 'Immediate'}</td>
                  <td><span className={`${styles.statusBadge} ${n.status==='scheduled'?styles.active:styles.suspended}`}>{n.status}</span></td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionButtons}>
                      <PermissionGate permission="notifications.manage">
                        <Link href={`/admin/notifications/${n.id}`} className={styles.iconBtn} title="Edit">
                          <Edit2 size={16} />
                        </Link>
                        <button 
                          className={`${styles.iconBtn} ${styles.danger}`} 
                          onClick={() => setDeleteId(n.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
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
