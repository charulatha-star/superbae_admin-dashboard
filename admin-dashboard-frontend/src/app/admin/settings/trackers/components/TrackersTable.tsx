'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchApi } from '../../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../../components/admin/Skeleton';
import { NoData } from '../../../../../components/admin/NoData/NoData';
import { Toast } from '../../../../../components/admin/Toast';
import { ConfirmModal } from '../../../../../components/admin/ConfirmModal';
import { PermissionGate } from '../../../../../components/admin/PermissionGate';
import styles from '../trackers.module.css';
import {
  MANAGE_PERMISSION,
  TRACKER_TYPES,
  TRACKER_TYPE_LABELS,
  TRACKER_FORM_FIELDS,
  TrackerDoc,
  TrackerType,
  FieldDef,
  OPTION_PAGE_SIZE,
} from '../trackerConfig';

/** Create/edit modal state. Create allows only unused types; edit keeps type locked. */
interface FormState {
  mode: 'create' | 'edit';
  doc: TrackerDoc | null;
  trackerType: TrackerType | '';
  values: Record<string, string | boolean | number>;
}

const EMPTY_FORM: FormState = {
  mode: 'create',
  doc: null,
  trackerType: '',
  values: { isEnabled: true, sortOrder: 0 },
};

export function TrackersTable() {
  const [rows, setRows] = useState<TrackerDoc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<TrackerDoc | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Dedicated list returns a PLAIN ARRAY (no {data,total,pages} envelope).
      const data = await fetchApi<TrackerDoc[]>('/trackers');
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load trackers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Null-safe search across name / type label / category / description.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows ?? [];
    if (!q) return list;
    return list.filter((r) =>
      [r.name, TRACKER_TYPE_LABELS[r.trackerType] ?? r.trackerType, r.category, r.description]
        .some((v) => typeof v === 'string' && v.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / OPTION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * OPTION_PAGE_SIZE, safePage * OPTION_PAGE_SIZE);

  const openCreate = () => {
    setFormError(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (doc: TrackerDoc) => {
    setFormError(null);
    setForm({
      mode: 'edit',
      doc,
      trackerType: doc.trackerType,
      values: {
        name: doc.name ?? '',
        description: doc.description ?? '',
        category: doc.category ?? '',
        isEnabled: doc.isEnabled,
        sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : 0,
      },
    });
  };

  const setFieldValue = (key: string, value: string | boolean | number) => {
    setForm((prev) => (prev ? { ...prev, values: { ...prev.values, [key]: value } } : prev));
  };

  const usedTypes = useMemo(() => new Set((rows ?? []).map((r) => r.trackerType)), [rows]);

  const validate = (): string | null => {
    if (!form) return null;
    if (form.mode === 'create' && !form.trackerType) return 'Tracker type is required.';
    if (!String(form.values.name ?? '').trim()) return 'Name is required.';
    const sortOrder = Number(form.values.sortOrder ?? 0);
    if (!Number.isFinite(sortOrder) || sortOrder < 0) return 'Sort order must be 0 or greater.';
    if (form.mode === 'create' && form.trackerType && usedTypes.has(form.trackerType as TrackerType)) {
      return `A tracker of type '${form.trackerType}' already exists.`;
    }
    return null;
  };

  const save = async () => {
    if (!form) return;
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: String(form.values.name ?? '').trim(),
        description: String(form.values.description ?? '').trim() || null,
        category: String(form.values.category ?? '').trim() || null,
        isEnabled: Boolean(form.values.isEnabled),
        sortOrder: Number(form.values.sortOrder ?? 0),
      };
      if (form.mode === 'create') {
        await fetchApi('/trackers', {
          method: 'POST',
          body: JSON.stringify({ ...payload, trackerType: form.trackerType }),
        });
        showToast('Tracker created.', 'success');
      } else if (form.doc) {
        // PATCH only â€” the backend exposes no PUT for trackers.
        await fetchApi(`/trackers/${form.doc.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Tracker updated.', 'success');
      }
      setForm(null);
      await load();
    } catch (error) {
      // Backend 400/403/409 messages (e.g. duplicate trackerType) shown verbatim.
      setFormError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (doc: TrackerDoc) => {
    setConfirmToggle(null);
    try {
      await fetchApi(`/trackers/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !doc.isEnabled }),
      });
      showToast(`${doc.name} ${doc.isEnabled ? 'disabled' : 'enabled'}.`, 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Update failed.', 'error');
    }
  };
  const formTitle = form ? (form.mode === 'create' ? 'Add Tracker' : `Edit ${form.doc?.name ?? 'Tracker'}`) : '';
  const usedTypesForCreate = form?.mode === 'create' ? usedTypes : new Set<TrackerType>();

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {loadError && <p className={styles.errorBanner}>{loadError}</p>}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Search trackersâ€¦"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <PermissionGate permission={MANAGE_PERMISSION}>
          <button type="button" className={styles.addBtn} onClick={openCreate}>+ Add Tracker</button>
        </PermissionGate>
      </div>
      {loading ? (
        <div className={styles.loadingBox}><AdminTableSkeleton /></div>
      ) : filtered.length === 0 ? (
        <NoData title="No trackers" description="No trackers match the current search." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th><th>Type</th><th>Category</th><th>Enabled</th><th>Sort Order</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.name}</td>
                    <td><span className={styles.typeBadge}>{TRACKER_TYPE_LABELS[doc.trackerType] ?? doc.trackerType}</span></td>
                    <td>{doc.category ?? <span className={styles.mutedText}>â€”</span>}</td>
                    <td><span className={doc.isEnabled ? styles.badgeOn : styles.badgeOff}>{doc.isEnabled ? 'Enabled' : 'Disabled'}</span></td>
                    <td>{doc.sortOrder}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <PermissionGate permission={MANAGE_PERMISSION}>
                          <button type="button" className={styles.linkBtn} onClick={() => openEdit(doc)}>Edit</button>
                          <button
                            type="button"
                            className={`${styles.linkBtn} ${doc.isEnabled ? styles.toggleOff : styles.toggleOn}`}
                            onClick={() => setConfirmToggle(doc)}
                          >
                            {doc.isEnabled ? 'Disable' : 'Enable'}
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <span>{filtered.length} tracker(s)</span>
            <button type="button" className={styles.pageBtn} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Prev</button>
            <span>Page {safePage} of {totalPages}</span>
            <button type="button" className={styles.pageBtn} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={confirmToggle !== null}
        title={confirmToggle?.isEnabled ? 'Disable tracker' : 'Enable tracker'}
        message={confirmToggle ? `${confirmToggle.isEnabled ? 'Disable' : 'Enable'} the "${confirmToggle.name}" tracker?` : ''}
        confirmText={confirmToggle?.isEnabled ? 'Disable' : 'Enable'}
        variant={confirmToggle?.isEnabled ? 'danger' : 'primary'}
        onConfirm={() => confirmToggle && void toggleEnabled(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
      />
      {form && <TrackerFormModal form={form} formError={formError} saving={saving} usedTypes={usedTypesForCreate} onField={setFieldValue} onType={(t) => setForm({ ...form, trackerType: t })} onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}

interface ModalProps {
  form: FormState;
  formError: string | null;
  saving: boolean;
  usedTypes: Set<TrackerType>;
  onField: (key: string, value: string | boolean | number) => void;
  onType: (t: TrackerType | '') => void;
  onClose: () => void;
  onSave: () => void;
}

function TrackerFormModal({ form, formError, saving, usedTypes, onField, onType, onClose, onSave }: ModalProps) {
  const title = form.mode === 'create' ? 'Add Tracker' : `Edit ${form.doc?.name ?? 'Tracker'}`;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>{title}</h3>
        {formError && <p className={styles.modalError}>{formError}</p>}
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="trk_type">Tracker Type</label>
            {form.mode === 'edit' ? (
              <input id="trk_type" className={styles.fieldInput} value={TRACKER_TYPE_LABELS[form.trackerType as TrackerType] ?? form.trackerType} disabled />
            ) : (
              <select id="trk_type" className={styles.fieldSelect} value={form.trackerType} onChange={(e) => onType(e.target.value as TrackerType | '')}>
                <option value="">Select type…</option>
                {TRACKER_TYPES.filter((t) => !usedTypes.has(t)).map((t) => (
                  <option key={t} value={t}>{TRACKER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            )}
            {form.mode === 'edit' && <small className={styles.fieldHelp}>Type is fixed once created.</small>}
          </div>
          {TRACKER_FORM_FIELDS.map((f) => (
            <OptionFieldInput key={f.key} field={f} value={form.values[f.key]} onChange={(v) => onField(f.key, v)} />
          ))}
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

/** Shared small input renderer (text / number / textarea / boolean). */
export function OptionFieldInput({ field, value, onChange }: { field: FieldDef; value: string | boolean | number | undefined; onChange: (v: string | boolean | number) => void }) {
  const id = `fld_${field.key}`;
  if (field.kind === 'boolean') {
    return (
      <div className={styles.checkboxRow}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <label htmlFor={id}>{field.label}</label>
      </div>
    );
  }
  return (
    <div className={field.kind === 'textarea' ? styles.formFieldFull : styles.formField}>
      <label className={styles.fieldLabel} htmlFor={id}>{field.label}</label>
      {field.kind === 'textarea' ? (
        <textarea id={id} className={styles.fieldTextarea} placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          id={id}
          className={styles.fieldInput}
          type={field.kind === 'number' ? 'number' : 'text'}
          min={field.kind === 'number' ? 0 : undefined}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.kind === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        />
      )}
      {field.help ? <small className={styles.fieldHelp}>{field.help}</small> : null}
    </div>
  );
}
