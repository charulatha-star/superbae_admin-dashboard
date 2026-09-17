'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Eye, Trash2, FileText, MessageCircle, Heart } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../components/admin/ConfirmModal';
import styles from '../shared.module.css';
import { PermissionGate } from '@/src/components/admin/PermissionGate';

interface Post {
  id: string;
  title?: string;
  content?: string;
  author?: string;
  authorName?: string;
  status?: string;
  commentsCount?: number;
  likes?: number;
  createdAt?: string;
}

export default function CommunityPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  useEffect(() => {
    fetchApi<Post[]>('/posts').then(setPosts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const authorName = (p: Post) => p.authorName || p.author || 'Unknown';

  const filtered = posts.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (p.title || '').toLowerCase().includes(q) ||
      (p.content || '').toLowerCase().includes(q) ||
      authorName(p).toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetchApi(`/posts/${deleteTarget.id}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>All Posts</h1>
          <p className={styles.subtitle}>Browse and manage every community post.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <FileText size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statValue}>{posts.length}</div>
            <div className={styles.statLabel}>Total Posts</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <MessageCircle size={20} className={styles.statIcon} style={{ color: '#2563eb' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#2563eb' }}>
              {posts.reduce((s, p) => s + (p.commentsCount || 0), 0)}
            </div>
            <div className={styles.statLabel}>Comments</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Heart size={20} className={styles.statIcon} style={{ color: '#e83e8c' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#e83e8c' }}>
              {posts.reduce((s, p) => s + (p.likes || 0), 0)}
            </div>
            <div className={styles.statLabel}>Total Likes</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="flagged">Flagged</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No posts found" description="No community posts match your filters." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Post</th>
                  <th>Comments</th>
                  <th>Likes</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((post) => (
                  <tr key={post.id}>
                      <td>
                      <div className={styles.authorCell}>
                        <span className={styles.avatar}>{authorName(post).charAt(0).toUpperCase()}</span>
                        {authorName(post)}
                      </div>
                    </td>
                    <td className={styles.postTitleCell}>
                      <p className={styles.postTitle}>{post.title || 'Untitled post'}</p>
                      <p className={styles.postExcerpt}>{post.content || ''}</p>
                    </td>
                  
                    <td>{post.commentsCount ?? 0}</td>
                    <td>{post.likes ?? 0}</td>
                    <td><span className={`${styles.badge} ${styles[post.status || 'active'] || ''}`}>{post.status || 'active'}</span></td>
                    <td>{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '—'}</td>
                    <td>

                      <div className={styles.actionButtons}>
                        <PermissionGate permission="community.posts.view">
                        <Link href={`/admin/community/posts/${post.id}`} className={styles.iconBtn} title="View">
                          <Eye size={16} />
                        </Link>
                          </PermissionGate>
                          <PermissionGate permission="community.posts.view">
                        <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Delete" onClick={() => setDeleteTarget(post)}>
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
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</button>
                <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Post"
        message={`Are you sure you want to delete "${deleteTarget?.title || 'this post'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

