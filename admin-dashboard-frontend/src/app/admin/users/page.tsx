'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import {
  getUsers,
  deleteUser,
  type User,
} from '../../../lib/api/users';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { Users, Search, UserCheck, UserX, Crown, ArrowUpDown, AlertCircle, Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import styles from './page.module.css';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { NoData } from '@/src/components/admin/NoData/NoData';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import { Toast } from '@/src/components/admin/Toast';
import Link from 'next/link';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState<keyof User>('name');
  const [sortDesc, setSortDesc] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => setCurrentPage(1), [search, filter, sortKey, sortDesc]);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((e) => {
        console.error(e);
        setError('Failed to load users');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: keyof User) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setToast({ message: 'User deleted successfully', type: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to delete user', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const sorted = [...users].sort((a, b) => {
    const aVal = a[sortKey] ?? '';
    const bVal = b[sortKey] ?? '';
    if (aVal < bVal) return sortDesc ? 1 : -1;
    if (aVal > bVal) return sortDesc ? -1 : 1;
    return 0;
  });

const filtered = sorted.filter((u) => {
  const searchTerm = search.toLowerCase();

  const matchSearch =
    (u.name?.toLowerCase() ?? '').includes(searchTerm) ||
    (u.email?.toLowerCase() ?? '').includes(searchTerm);

  const matchFilter = filter === 'all' || u.status === filter;

  return matchSearch && matchFilter;
});

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    premium: users.filter((u) => u.plan === 'premium').length,
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>Manage and monitor all platform users.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Users</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <UserCheck size={20} className={styles.statIcon} style={{ color: '#16a34a' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#16a34a' }}>{stats.active}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <UserX size={20} className={styles.statIcon} style={{ color: '#dc2626' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#dc2626' }}>{stats.suspended}</div>
            <div className={styles.statLabel}>Suspended</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Crown size={20} className={styles.statIcon} style={{ color: '#d97706' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#d97706' }}>{stats.premium}</div>
            <div className={styles.statLabel}>Premium</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <AdminTableSkeleton />
        ) : error ? (
          <div className={styles.errorState}>
            <AlertCircle size={48} className={styles.errorIcon} />
            <p className={styles.errorMessage}>{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {editingUser && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <h2>Edit User</h2>
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                  <label>Email</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                  <label>Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <label>Plan</label>
                  <select
                    value={editingUser.plan}
                    onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                  <div className={styles.modalActions}>
                    <button onClick={() => setEditingUser(null)}>Cancel</button>
                    <button
                      onClick={async () => {
                        try {
                          await fetchApi(`/users/${editingUser.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify(editingUser),
                          });
                          setEditingUser(null);
                          fetchApi<User[]>('/users').then(setUsers);
                        } catch (e) {
                          console.error(e);
                          alert('Failed to save changes');
                        }
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
            <NoData />
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                    User <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('status')} className={styles.sortableHeader}>
                    Status <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('plan')} className={styles.sortableHeader}>
                    Plan <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('posts')} className={styles.sortableHeader}>
                    Posts <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('groups')} className={styles.sortableHeader}>
                    Groups <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('joinedAt')} className={styles.sortableHeader}>
                    Joined <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th onClick={() => handleSort('lastSeen')} className={styles.sortableHeader}>
                    Last Seen <ArrowUpDown size={14} className={styles.sortIcon} />
                  </th>
                  <th className={styles.sortableHeader} style={{ textAlign: 'center' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{user?.name?.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className={styles.userName}>{user.name}</div>
                          <div className={styles.userEmail}>{user.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[user.status]}`}>{user.status}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${user.plan === 'premium' ? styles.premium : styles.free}`}> {user.plan} </span>
                    </td>
                    <td>{user.posts}</td>
                    <td>{user.groups}</td>
                    <td>{new Date(user.joinedAt).toLocaleDateString()}</td>
                    <td>{new Date(user.lastSeen).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <PermissionGate permission="users.view">
                          <Link href={`/admin/users/${user.id}/view`} className={styles.iconBtn} title="View">
                            <Eye size={16} />
                          </Link>
                        </PermissionGate>
                        <PermissionGate permission="users.edit">
                          <Link href={`/admin/users/${user.id}`} className={styles.iconBtn} title="Edit">
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
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ← Previous
                </button>
                <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {deleteTarget && (
        <ConfirmModal
          isOpen
          variant="danger"
          title="Delete User"
          message={
            <>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot
              be undone.

            </>
          }
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
