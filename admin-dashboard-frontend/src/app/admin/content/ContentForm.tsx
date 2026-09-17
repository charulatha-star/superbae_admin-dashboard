'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Archive, Send, Trash2 } from 'lucide-react';
import { fetchApi } from '@/src/lib/api/api';
import { Loader } from '@/src/components/admin/Loader';
import { Toast } from '@/src/components/admin/Toast';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import { usePermissions } from '@/src/hooks/usePermissions';
import formStyles from '../admins/create/page.module.css';
import styles from './content.module.css';
import { ContentField, ContentResourceConfig, ContentResourceKey, getContentConfig } from './contentConfig';

export interface ContentDoc {
  id: string;
  status?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

type FormValues = Record<string, string | boolean>;

interface ContentFormProps {
  resource: ContentResourceKey;
  editingId?: string | null;
  /** Called after a successful create/update. */
  onSuccess?: (doc: ContentDoc) => void;
  /** Called after a successful delete. */
  onDeleted?: () => void;
}

function buildInitialValues(config: ContentResourceConfig): FormValues {
  const values: FormValues = {};
  for (const field of config.fields) {
    values[field.name] = field.type === 'checkbox' ? false : '';
  }
  return values;
}

function docToValues(config: ContentResourceConfig, doc: ContentDoc): FormValues {
  const values = buildInitialValues(config);
  for (const field of config.fields) {
    const raw = doc[field.name];
    if (field.type === 'checkbox') {
      values[field.name] = raw === true;
      continue;
    }
    if (raw === null || raw === undefined) continue;
    values[field.name] = field.type === 'date' ? String(raw).slice(0, 10) : String(raw);
  }
  return values;
}

function validateValues(config: ContentResourceConfig, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of config.fields) {
    if (!field.required || field.type === 'checkbox') continue;
    if (!String(values[field.name] ?? '').trim()) {
      errors[field.name] = `${field.label} is required.`;
    }
  }
  return errors;
}

export function statusClassFor(status: string, classes: Record<string, string>): string {
  if (status === 'published') return `${classes.badge} ${classes.badgePublished}`;
  if (status === 'draft') return `${classes.badge} ${classes.badgeDraft}`;
  if (status === 'archived') return `${classes.badge} ${classes.badgeArchived}`;
  return `${classes.badge} ${classes.badgeUnknown}`;
}

export function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function ContentForm({ resource, editingId, onSuccess, onDeleted }: ContentFormProps) {
  const config = getContentConfig(resource);
  const { hasPermission } = usePermissions();
  const canPublish = hasPermission('CONTENT_PUBLISH');

  const [values, setValues] = useState<FormValues>(() => buildInitialValues(config));
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [loading, setLoading] = useState(!!editingId);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    fetchApi<ContentDoc>(`${config.apiPath}/${editingId}`)
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setValues(docToValues(config, data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : `Failed to load this ${config.singular.toLowerCase()}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, editingId]);

  const currentStatus = String(doc?.status ?? 'draft');

  const changeField = (field: ContentField, value: string | boolean) => {
    setValues((previous) => ({ ...previous, [field.name]: value }));
    if (fieldErrors[field.name]) {
      setFieldErrors((previous) => ({ ...previous, [field.name]: '' }));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateValues(config, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields before saving.');
      return;
    }

    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      // Publishing state is controlled by CONTENT_PUBLISH, not CONTENT_MANAGE.
      if (field.name === 'status' && !canPublish) continue;
      if (field.type === 'checkbox') {
        payload[field.name] = values[field.name] === true;
        continue;
      }
      const text = String(values[field.name] ?? '').trim();
      if (!text) {
        // Optional selects are omitted rather than nulled so a blank selection
        // can never overwrite a stored enum value (e.g. banners.type).
        if (!field.required && field.type !== 'select') payload[field.name] = null;
        continue;
      }
      payload[field.name] = field.type === 'number' ? Number(text) : text;
    }

    try {
      setSaving(true);
      setError('');
      const saved = editingId
        ? await fetchApi<ContentDoc>(`${config.apiPath}/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await fetchApi<ContentDoc>(config.apiPath, { method: 'POST', body: JSON.stringify(payload) });
      setToast({ message: editingId ? `${config.singular} saved.` : `${config.singular} created.`, type: 'success' });
      if (onSuccess) {
        onSuccess(saved);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to save this ${config.singular.toLowerCase()}.`;
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const changePublishState = async (action: 'publish' | 'unpublish') => {
    if (!editingId) return;
    try {
      setWorking(true);
      setError('');
      const updated = await fetchApi<ContentDoc>(`${config.apiPath}/${editingId}/${action}`, { method: 'POST' });
      setDoc(updated);
      setValues((previous) => ({ ...previous, status: String(updated.status ?? previous.status) }));
      setToast({
        message: action === 'publish' ? `${config.singular} published.` : `${config.singular} unpublished (archived).`,
        type: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${action} this ${config.singular.toLowerCase()}.`;
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    setConfirmDelete(false);
    try {
      setWorking(true);
      setError('');
      await fetchApi(`${config.apiPath}/${editingId}`, { method: 'DELETE' });
      setToast({ message: `${config.singular} deleted.`, type: 'success' });
      if (onDeleted) onDeleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete this ${config.singular.toLowerCase()}.`;
      setError(message);
      setToast({ message, type: 'error' });
      setWorking(false);
    }
  };

  const renderField = (field: ContentField) => {
    const inputClass = `${formStyles.input} ${fieldErrors[field.name] ? formStyles.inputError : ''}`;

    if (field.type === 'checkbox') {
      return (
        <div key={field.name} className={styles.checkboxRow}>
          <label className={formStyles.checkboxLabel}>
            <input
              type="checkbox"
              className={formStyles.checkbox}
              checked={values[field.name] === true}
              onChange={(event) => changeField(field, event.target.checked)}
            />
            {field.label}
          </label>
          {field.helpText && <span className={styles.fieldHint}>{field.helpText}</span>}
        </div>
      );
    }

    // Status is only editable with CONTENT_PUBLISH, mirroring the API split
    // between CONTENT_MANAGE and CONTENT_PUBLISH.
    if (field.name === 'status' && !canPublish) {
      return (
        <div key={field.name} className={formStyles.field}>
          <label className={formStyles.label}>{field.label}</label>
          <span className={statusClassFor(currentStatus, styles)}>{currentStatus}</span>
          <span className={styles.fieldHint}>
            Publishing and unpublishing require the CONTENT_PUBLISH permission.
          </span>
        </div>
      );
    }

    const currentValue = String(values[field.name] ?? '');
    const hasCurrentOption = (field.options ?? []).some((option) => option.value === currentValue);

    return (
      <div
        key={field.name}
        className={formStyles.field}
        style={field.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}
      >
        <label className={formStyles.label}>
          {field.label}
          {field.required ? ' *' : ''}
        </label>

        {field.type === 'textarea' ? (
          <textarea
            className={`${inputClass} ${styles.textarea}`}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            value={currentValue}
            onChange={(event) => changeField(field, event.target.value)}
          />
        ) : field.type === 'select' ? (
          <select
            className={inputClass}
            value={currentValue}
            onChange={(event) => changeField(field, event.target.value)}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {currentValue && !hasCurrentOption ? <option value={currentValue}>{currentValue}</option> : null}
          </select>
        ) : (
          <input
            className={inputClass}
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder}
            value={currentValue}
            onChange={(event) => changeField(field, event.target.value)}
          />
        )}

        {fieldErrors[field.name] ? (
          <span className={formStyles.errorText}>{fieldErrors[field.name]}</span>
        ) : field.helpText ? (
          <span className={styles.fieldHint}>{field.helpText}</span>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading {config.singular.toLowerCase()}…</div>;
  }

  return (
    <PermissionGate
      permission="CONTENT_MANAGE"
      fallback={
        <div className={styles.accessDenied}>
          You need the CONTENT_MANAGE permission to create or edit {config.plural.toLowerCase()}.
        </div>
      }
    >
      <div className={formStyles.container}>
        <div className={formStyles.header}>
          <Link href={config.listHref} className={styles.backLink}>
            <ArrowLeft size={16} /> Back to {config.plural}
          </Link>
          <div className={styles.headerRow}>
            <div>
              <h1 className={formStyles.title}>
                {editingId ? `Edit ${config.singular}` : `Create ${config.singular}`}
              </h1>
              <p className={formStyles.subtitle}>
                {editingId
                  ? `Update this ${config.singular.toLowerCase()} and manage its publishing state.`
                  : config.description}
              </p>
            </div>

            {editingId && (
              <div className={styles.headerActions}>
                <span className={statusClassFor(currentStatus, styles)}>{currentStatus}</span>
                {doc?.publishedAt ? (
                  <span className={styles.activityMeta}>Published {formatDateTime(doc.publishedAt)}</span>
                ) : null}
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
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.dangerBtn}`}
                  disabled={working}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={formStyles.content}>
          <form className={formStyles.form} onSubmit={handleSubmit}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={formStyles.formSection}>
              <h3 className={formStyles.sectionTitle}>{config.singular} details</h3>
              <div className={formStyles.grid}>{config.fields.map(renderField)}</div>
            </div>

            <div className={formStyles.formActions}>
              <Link href={config.listHref} className={formStyles.cancelBtn}>
                Cancel
              </Link>
              <button type="submit" className={formStyles.submitBtn} disabled={saving}>
                {saving ? <Loader /> : editingId ? 'Save Changes' : `Create ${config.singular}`}
              </button>
            </div>
          </form>
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
    </PermissionGate>
  );
}

export default ContentForm;