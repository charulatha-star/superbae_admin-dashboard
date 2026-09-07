'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { Users, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface Group {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  status: string;
  createdAt: string;
  owner: string;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Group[]>('/groups').then(setGroups).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.category.toLowerCase().includes(search.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Community Groups</h1>
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
            <div className={styles.statValue} style={{ color: '#16a34a' }}>{groups.filter(g => g.status === 'active').length}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#dc2626' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#dc2626' }}>{groups.filter(g => g.status === 'suspended').length}</div>
            <div className={styles.statLabel}>Suspended</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={20} className={styles.statIcon} style={{ color: '#7c3aed' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#7c3aed' }}>{groups.reduce((s, g) => s + g.memberCount, 0)}</div>
            <div className={styles.statLabel}>Total Members</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
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
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(group => (
                <tr key={group.id}>
                  <td><strong>{group.name}</strong></td>
                  <td>{group.category}</td>
                  <td>{group.owner}</td>
                  <td>{group.memberCount.toLocaleString()}</td>
                  <td><span className={`${styles.badge} ${styles[group.status]}`}>{group.status}</span></td>
                  <td>{new Date(group.createdAt).toLocaleDateString()}</td>
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
