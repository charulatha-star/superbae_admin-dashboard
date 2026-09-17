'use client';

import { useState, useEffect } from 'react';
import { Search, Ban, CheckCircle } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../components/admin/ConfirmModal';
import styles from '../shared.module.css';

interface BlockedUser {
  id: string;
  name: string;
  email: string;
  status?: string;
  blocked?: boolean;
  blockReason?: string;
  blockedAt?: string;
}

export default function BlockedUsersPage() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi<BlockedUser[]>('/users')
      .then((all) => setUsers(all.filter((u) => u.blocked === true)))
      .catch(() => setError('Failed to load blocked users.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const confirmUnblock = async () => {
    if (!unblockTarget) return;
    try {
      await fetchApi(`/users/${unblockTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', blocked: false }),
      });
      setUsers((prev) => prev.filter((u) => u.id !== unblockTarget.id));
    } catch (err) {
      console.error(err);
    } finally {
      setUnblockTarget(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Blocked Users</h1>
          <p className={styles.subtitle}>Manage users blocked from the community.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Ban size={20} className={styles.statIcon} style={{ color: '#64748b' }} />
          <div>
            <div className={styles.statValue}>{users.length}</div>
            <div className={styles.statLabel}>Blocked Users</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search blocked users..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : error ? (
          <div className={styles.errorText}>{error}</div>
        ) : filtered.length === 0 ? (
          <NoData title="No blocked users" description="No users are currently blocked from the community." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Reason</th>
                <th>Blocked On</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.authorCell}>
                      <span className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</span>
                      <strong>{user.name}</strong>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.blockReason || '—'}</td>
                  <td>{user.blockedAt ? new Date(user.blockedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button type="button" className={`${styles.iconBtn} ${styles.successBtn}`} title="Unblock user" onClick={() => setUnblockTarget(user)}>
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={!!unblockTarget}
        title="Unblock User"
        message={`Are you sure you want to unblock ${unblockTarget?.name}? They will regain full access to the community.`}
        confirmText="Unblock"
        onConfirm={confirmUnblock}
        onCancel={() => setUnblockTarget(null)}
      />
    </div>
  );
}
