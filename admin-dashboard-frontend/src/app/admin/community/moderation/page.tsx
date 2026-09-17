'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, Check, X } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../components/admin/ConfirmModal';
import styles from '../shared.module.css';

interface QueueItem {
  id: string;
  type: 'Reported Post' | 'Reported Comment' | 'Flagged Content';
  contentId: string;
  content: string;
  reporter: string;
  reason: string;
  resource: string;
}

interface RawReport {
  id: string;
  postId?: string;
  commentId?: string;
  contentId?: string;
  reporter?: string;
  reporterName?: string;
  reportedUser?: string;
  reason?: string;
  content?: string;
  excerpt?: string;
  status?: string;
}

interface RawModeration {
  id: string;
  contentType?: string;
  content?: string;
  reportedBy?: string;
  reason?: string;
  status?: string;
}

export default function ModerationQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmResolve, setConfirmResolve] = useState<QueueItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchApi<RawReport[]>('/reportedPosts').catch(() => [] as RawReport[]),
      fetchApi<RawReport[]>('/reportedComments').catch(() => [] as RawReport[]),
      fetchApi<RawModeration[]>('/safetyModeration').catch(() => [] as RawModeration[]),
    ])
      .then(([reportedPosts, reportedComments, moderation]) => {
        const mapped: QueueItem[] = [];
        for (const r of reportedPosts) {
          if ((r.status || 'pending') === 'pending') {
            mapped.push({
              id: `reportedPosts:${r.id}`,
              type: 'Reported Post',
              contentId: r.postId || r.contentId || r.id,
              content: r.content || r.excerpt || 'No content preview',
              reporter: r.reporterName || r.reporter || r.reportedUser || 'Unknown',
              reason: r.reason || 'Unspecified',
              resource: 'reportedPosts',
            });
          }
        }
        for (const r of reportedComments) {
          if ((r.status || 'pending') === 'pending') {
            mapped.push({
              id: `reportedComments:${r.id}`,
              type: 'Reported Comment',
              contentId: r.commentId || r.contentId || r.id,
              content: r.content || r.excerpt || 'No content preview',
              reporter: r.reporterName || r.reporter || r.reportedUser || 'Unknown',
              reason: r.reason || 'Unspecified',
              resource: 'reportedComments',
            });
          }
        }
        for (const m of moderation) {
          if ((m.status || 'pending') === 'pending') {
            mapped.push({
              id: `safetyModeration:${m.id}`,
              type: 'Flagged Content',
              contentId: m.id,
              content: m.content || 'No content preview',
              reporter: m.reportedBy || 'System',
              reason: m.reason || (m.contentType ? `Flagged ${m.contentType}` : 'Unspecified'),
              resource: 'safetyModeration',
            });
          }
        }
        setItems(mapped);
      })
      .catch(() => setError('Failed to load the moderation queue.'))
      .finally(() => setLoading(false));
  }, []);

  const resolve = async () => {
    if (!confirmResolve) return;
    const { resource, id } = confirmResolve;
    const realId = id.split(':')[1];
    try {
      await fetchApi(`/${resource}/${realId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'removed', resolvedAt: new Date().toISOString() }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmResolve(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Moderation Queue</h1>
          <p className={styles.subtitle}>Review all pending flagged content and take action.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <ShieldAlert size={20} className={styles.statIcon} style={{ color: '#d97706' }} />
          <div>
            <div className={styles.statValue} style={{ color: '#d97706' }}>{items.length}</div>
            <div className={styles.statLabel}>Awaiting Action</div>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : error ? (
          <div className={styles.errorText}>{error}</div>
        ) : items.length === 0 ? (
          <NoData title="Queue is clear" description="There is no flagged content awaiting moderation." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Content</th>
                <th>Reported By</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><span className={`${styles.badge} ${styles.flagged}`}>{item.type}</span></td>
                  <td className={styles.postTitleCell}>
                    <p className={styles.postExcerpt} style={{ whiteSpace: 'normal' }}>{item.content}</p>
                  </td>
                  <td>{item.reporter}</td>
                  <td>{item.reason}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      {item.type === 'Reported Post' && (
                        <Link href={`/admin/community/posts/${item.contentId}`} className={styles.iconBtn} title="View post">
                          <ShieldAlert size={16} />
                        </Link>
                      )}
                      <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Remove content" onClick={() => setConfirmResolve(item)}>
                        <X size={16} />
                      </button>
                      <button type="button" className={`${styles.iconBtn} ${styles.successBtn}`} title="Mark resolved" onClick={() => setConfirmResolve(item)}>
                        <Check size={16} />
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
        isOpen={!!confirmResolve}
        title="Resolve Queue Item"
        message="Are you sure you want to resolve this item? The reported content will be marked as removed."
        confirmText="Resolve"
        onConfirm={resolve}
        onCancel={() => setConfirmResolve(null)}
      />
    </div>
  );
}
