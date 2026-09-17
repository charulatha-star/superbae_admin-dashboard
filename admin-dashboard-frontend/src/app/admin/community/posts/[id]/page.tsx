'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Eye, Trash2 } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api/api';
import { NoData } from '../../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../../components/admin/ConfirmModal';
import styles from '../../shared.module.css';

interface Post {
  id: string;
  title?: string;
  content?: string;
  author?: string;
  authorName?: string;
  status?: string;
  likes?: number;
  views?: number;
  createdAt?: string;
}

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

export default function PostDetailsPage() {
  const params = useParams<{ id: string }>();
  const postId = params?.id;
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteComment, setDeleteComment] = useState<Comment | null>(null);

  useEffect(() => {
    if (!postId) return;
    Promise.all([
      fetchApi<Post>(`/posts/${postId}`),
      fetchApi<Comment[]>('/comments').catch(() => [] as Comment[]),
    ])
      .then(([p, allComments]) => {
        setPost(p);
        setComments(allComments.filter((c) => c.postId === postId));
      })
      .catch(() => setError('Failed to load the post. It may have been deleted.'))
      .finally(() => setLoading(false));
  }, [postId]);

  const authorName = (p: Post | Comment) => p.authorName || p.author || 'Unknown';
  const commentText = (c: Comment) => c.content || c.text || '';

  const confirmDeleteComment = async () => {
    if (!deleteComment) return;
    try {
      await fetchApi(`/comments/${deleteComment.id}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== deleteComment.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteComment(null);
    }
  };

  if (loading) return <div className={styles.loading}>Loading post…</div>;
  if (error || !post) return <div className={styles.errorText}>{error || 'Post not found.'}</div>;

  return (
      <div className={styles.detailContainer}>
      <Link href="/admin/community/posts" className={styles.backLink}>
        <ArrowLeft size={16} /> Back to All Posts
      </Link>

      <div className={styles.detailCard}>
        <div className={styles.detailHeader}>
          <div>
            <h1 className={styles.detailTitle}>{post.title || 'Untitled post'}</h1>
            <div className={styles.detailMeta}>
              <span className={styles.detailAuthor}>
                <span className={styles.avatar}>{authorName(post).charAt(0).toUpperCase()}</span>
                {authorName(post)}
              </span>
              {post.createdAt && <span>{new Date(post.createdAt).toLocaleString()}</span>}
              <span className={`${styles.badge} ${styles[post.status || 'active'] || ''}`}>{post.status || 'active'}</span>
            </div>
          </div>
        </div>

        <div className={styles.detailBody}>{post.content || 'No content.'}</div>

        <div className={styles.detailStats}>
          <span><Heart size={14} /> {post.likes ?? 0} likes</span>
          <span><MessageCircle size={14} /> {comments.length} comments</span>
          <span><Eye size={14} /> {post.views ?? 0} views</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Comments ({comments.length})</h2>

      {comments.length === 0 ? (
        <div className={styles.tableContainer}>
          <NoData title="No comments yet" description="This post has no comments." />
        </div>
      ) : (
        <div className={styles.commentsList}>
          {comments.map((comment) => (
            <div key={comment.id} className={styles.commentItem}>
              <div className={styles.commentBody}>
                <span className={styles.commentAuthor}>{authorName(comment)}</span>
                {comment.createdAt && <span className={styles.commentDate}>{new Date(comment.createdAt).toLocaleString()}</span>}
                <p className={styles.commentText}>{commentText(comment)}</p>
              </div>
              <div className={styles.actionButtons}>
                <button type="button" className={`${styles.iconBtn} ${styles.dangerBtn}`} title="Delete comment" onClick={() => setDeleteComment(comment)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteComment}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDeleteComment}
        onCancel={() => setDeleteComment(null)}
      />
    </div>
  );
}
