'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Eye, Trash2, MessageSquare } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../components/admin/ConfirmModal';
import styles from '../shared.module.css';

interface Comment {
  id: string;
  postId?: string;
  author?: string;
  authorName?: string;
  content?: string;
  text?: string;
  status?: string;
  createdAt?: string;
}

export default function CommunityCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Comment[]>('/comments').then(setComments).catch(console.error).finally(() => setLoading(false));
  }, []);

  const authorName = (c: Comment) => c.authorName || c.author || 'Unknown';
  const commentText = (c: Comment) => c.content || c.text || '';

  const filtered = comments.filter((c) => {
    const q = search.toLowerCase();
    return commentText(c).toLowerCase().includes(q) || authorName(c).toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetchApi(`/comments/${deleteTarget.id}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
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
          <h1 className={styles.title}>Comments</h1>
          <p className={styles.subtitle}>Review and moderate post comments.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <MessageSquare size={20} className={styles.statIcon} />
          <div>
            <div className={styles.statValue}>{comments.length}</div>
            <div className={styles.statLabel}>Total Comments</div>
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search comments..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No comments found" description="No comments match your search." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Comment</th>
                  <th>Post</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((comment) => (
                  <tr key={comment.id}>
                    <td>
                      <div className={styles.authorCell}>
                        <span className={styles.avatar}>{authorName(comment).charAt(0).toUpperCase()}</span>
                        {authorName(comment)}
                      </div>
                    </td>
                    <td className={styles.postTitleCell}>
                      <p className={styles.postExcerpt} style={{ whiteSpace: 'normal' }}>{commentText(comment) || '—'}</p>
                    </td>
                    
                    <td>
                      {comment.postId ? (
                        <Link href={`/admin/community/posts/${comment.postId}`} className={styles.backLink} title="View post">View post</Link>
                      ) : '—'}
                    </td>
                    <td><span className={`${styles.badge} ${styles[comment.status || 'active'] || ''}`}>{comment.status || 'active'}</span></td>
                    <td>{comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        {comment.postId && (
                          <Link href={`/admin/community/posts/${comment.postId}`} className={styles.iconBtn} title="View post">
                            <Eye size={16} />
                          </Link>
                        )}
                        <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Delete" onClick={() => setDeleteTarget(comment)}>
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
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

