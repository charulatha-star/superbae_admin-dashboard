'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Archive, Pencil, Send, Trash2 } from 'lucide-react';
import { fetchApi } from '@/src/lib/api/api';
import { Toast } from '@/src/components/admin/Toast';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import styles from './content.module.css';
import { ContentDetailField, ContentResourceKey, getContentConfig } from './contentConfig';
import { ContentDoc, formatDateTime, statusClassFor } from './ContentForm';

interface AuditEntry {
  id: string;
  action?: string;
  description?: string;
  adminName?: string;
  createdAt?: string;
}

interface ContentDetailProps {
  resource: ContentResourceKey;
  id: string;
}

function displayValue(field: ContentDetailField, raw: unknown): string {
  if (field.format === 'boolean') return raw === true ? 'Yes' : 'No';
  if (raw === null || raw === undefined || raw === '') return '';
  if (field.format === 'datetime') return formatDateTime(raw);
  if (field.format === 'date') {
    const date = new Date(String(raw));
    return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString();
  }
  return String(raw);
}

export function ContentDetail({ resource, id }: ContentDetailProps) {
  const config = getContentConfig(resource);
  const router = useRouter();

  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    fetchApi<AuditEntry[]>(`/auditLogs?targetType=${config.key}&targetId=${id}&_sort=createdAt&_order=desc&limit=20`)
      .then((entries) => setActivity(Array.isArray(entries) ? entries : []))
      .catch(() => setActivity([]));
  }, [config, id]);

  useEffect(() => {
    let cancelled = false;

    fetchApi<ContentDoc>(`${config.apiPath}/${id}`)
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setError('');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDoc(null);
        setError(err instanceof Error ? err.message : `Failed to load this ${config.singular.toLowerCase()}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Audit history is best-effort: content audit logging is tracked separately.
    void load();

    return () => {
      cancelled = true;
    };
  }, [config, id, load]);

  const currentStatus = String(doc?.status ?? 'draft');

  const changePublishState = async (action: 'publish' | 'unpublish') => {
    try {
      setWorking(true);
      setError('');
      const updated = await fetchApi<ContentDoc>(`${config.apiPath}/${id}/${action}`, { method: 'POST' });
      setDoc(updated);
      setToast({
        message: action === 'publish' ? `${config.singular} published.` : `${config.singular} unpublished (archived).`,
        type: 'success',
      });
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${action} this ${config.singular.toLowerCase()}.`;
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      setWorking(true);
      setError('');
      await fetchApi(`${config.apiPath}/${id}`, { method: 'DELETE' });
      router.push(config.listHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete this ${config.singular.toLowerCase()}.`;
      setError(message);
      setToast({ message, type: 'error' });
      setWorking(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading {config.singular.toLowerCase()}…</div>;
  }

  if (error || !doc) {
    return (
      <div className={styles.container}>
        <div className={styles.detailCard}>
          <div className={styles.errorBox}>{error || `${config.singular} not found.`}</div>
          <Link href={config.listHref} className={styles.backLink}>
            <ArrowLeft size={16} /> Back to {config.plural}
          </Link>
        </div>
      </div>
    );
  }

  const heading = String(doc[config.titleField] ?? `Untitled ${config.singular.toLowerCase()}`);

  return (
    <div className={styles.container}>
      <div className={styles.detailCard}>
        <Link href={config.listHref} className={styles.backLink}>
          <ArrowLeft size={16} /> Back to {config.plural}
        </Link>

        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.detailTitle}>{heading}</h1>
            <div className={styles.detailMeta}>
              <span className={statusClassFor(currentStatus, styles)}>{currentStatus}</span>
              <span>Created {formatDateTime(doc.createdAt)}</span>
              <span>Updated {formatDateTime(doc.updatedAt)}</span>
              {doc.publishedAt ? <span>Published {formatDateTime(doc.publishedAt)}</span> : null}
              <span>ID {doc.id}</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <PermissionGate permission="CONTENT_MANAGE">
              <Link href={`${config.listHref}/${id}`} className={styles.actionBtn}>
                <Pencil size={15} /> Edit
              </Link>
            </PermissionGate>
            <PermissionGate permission="CONTENT_PUBLISH">
              <button
                type="button"
                className={`${styles.actionBtn} ${
                  currentStatus === 'published' ? styles.unpublishBtn : styles.publishBtn
                }`}
                disabled={working}
                onClick={() => changePublishState(currentStatus === 'published' ? 'unpublish' : 'publish')}
              >
                {currentStatus === 'published' ? <Archive size={15} /> : <Send size={15} />}
                {currentStatus === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </PermissionGate>
            <PermissionGate permission="CONTENT_MANAGE">
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.dangerBtn}`}
                disabled={working}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Delete
              </button>
            </PermissionGate>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.detailGrid}>
          {config.detailFields.map((field) => {
            const value = displayValue(field, doc[field.name]);
            const isWide = value.length > 80;
            return (
              <div key={field.name} className={isWide ? `${styles.detailField} ${styles.detailFieldWide}` : styles.detailField}>
                <span className={styles.detailLabel}>{field.label}</span>
                <span className={value ? styles.detailValue : `${styles.detailValue} ${styles.detailValueMuted}`}>
                  {value || 'Not set'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.detailCard}>
        <h2 className={styles.sectionHeading}>Activity</h2>
        {activity.length === 0 ? (
          <div className={styles.activityEmpty}>
            No audit entries recorded for this {config.singular.toLowerCase()} yet.
          </div>
        ) : (
          <div className={styles.activityList}>
            {activity.map((entry) => (
              <div key={entry.id} className={styles.activityItem}>
                <span className={styles.activityAction}>{entry.action ?? 'action'}</span>
                {entry.description ? <span className={styles.activityText}>{entry.description}</span> : null}
                <span className={styles.activityMeta}>
                  {entry.adminName ? `${entry.adminName} · ` : ''}
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ConfirmModal
        isOpen={confirmDelete}
        title={`Delete ${config.singular}`}
        message={`Are you sure you want to delete this ${config.singular.toLowerCase()}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default ContentDetail;