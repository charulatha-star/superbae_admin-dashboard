'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { Users, Search, Plus, Edit2, Trash2 } from 'lucide-react';
import styles from '../users/page.module.css';

interface Group {
  id: string;
  name: string;
  description?: string;
  category: string;
  memberCount: number;
  status: string;
  createdAt: string;
  owner: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchGroups = () => {
    setLoading(true);
    fetchApi<{ data: Group[] }>('/groups')
      .then(res => setGroups(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { setCurrentPage(1); }, [search]);
  useEffect(() => { fetchGroups(); }, []);

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      setIsDeleting(true);
      await fetchApi(`/groups/${groupToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      setGroupToDelete(null);
      fetchGroups();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = groups.filter(g =>
    (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Groups</h1>
          <p className={styles.subtitle}>Manage and monitor all platform groups.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statValue}>{groups.length}</div>
            <div className={styles.statLabel}>Total Groups</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#16a34a' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#16a34a' }}>{groups.filter(g => g.status === 'active' || g.status === 'approved').length}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#dc2626' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#dc2626' }}>{groups.filter(g => g.status === 'suspended' || g.status === 'rejected').length}</div>
            <div className={styles.statLabel}>Suspended</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#7c3aed' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#7c3aed' }}>{groups.reduce((s, g) => s + (g.memberCount || 0), 0)}</div>
            <div className={styles.statLabel}>Total Members</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar} style={{ justifyContent: "space-between" }}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <button className={styles.primaryBtn} onClick={() => router.push('/admin/groups/create')}>
          <Plus size={16} />
          Create Group
        </button>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No groups" description="No community groups are available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Group Name</th>
                  <th>Category</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(group => (
                  <tr key={group.id}>
                    <td><strong>{group.name || 'Unnamed'}</strong></td>
                    <td>{group.category || '-'}</td>
                    <td>{group.owner || 'System'}</td>
                    <td>{(group.memberCount || 0).toLocaleString()}</td>
                    <td><span className={`${styles.badge} ${styles[group.status] || ''}`}>{group.status || 'pending'}</span></td>
                    <td>{group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => router.push(`/admin/groups/${group.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} title="Edit Group">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => { setGroupToDelete(group); setIsDeleteModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete Group">
                          <Trash2 size={16} />
                        </button>
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

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Group"
        message={<p>Are you sure you want to delete <strong>{groupToDelete?.name}</strong>? This action cannot be undone.</p>}
        onConfirm={handleDeleteGroup}
        onCancel={() => setIsDeleteModalOpen(false)}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}
