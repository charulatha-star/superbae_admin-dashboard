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
  OPTION_PAGE_SIZE,
  DEFAULT_SEVERITY_LEVELS,
  OptionRow,
  OptionResourceDef,
  ColumnDef,
} from '../trackerConfig';
import { OptionFieldInput } from './TrackersTable';

/**
 * Reusable option-list manager (habit templates, mood options, symptoms,
 * period symptoms, medications, expense categories, reminder templates).
 * Plain-array list responses, client-side search/pagination, POST/PATCH/DELETE,
 * every write gated by TRACKER_CONFIG_MANAGE.
 */

type CellValue = string | number | boolean | null | undefined | string[];

function renderCell(row: OptionRow, col: ColumnDef) {
  const v = (row as unknown as Record<string, CellValue>)[col.key];
  if (col.kind === 'bool') {
    return <span className={v ? styles.badgeOn : styles.badgeOff}>{v ? 'Yes' : 'No'}</span>;
  }
  if (col.kind === 'type') {
    return <span className={styles.typeBadge}>{String(v ?? '')}</span>;
  }
  if (col.kind === 'list') {
    return Array.isArray(v) && v.length ? v.join(', ') : <span className={styles.mutedText}>—</span>;
  }
  const text = v === null || v === undefined || v === '' ? null : String(v);
  return text ?? <span className={styles.mutedText}>—</span>;
}

export function OptionManager({ def }: { def: OptionResourceDef }) {
  const [rows, setRows] = useState<OptionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ row: OptionRow | null } | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean | number | string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OptionRow | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Dedicated option lists also return PLAIN ARRAYS.
      const data = await fetchApi<OptionRow[]>(`/${def.key}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : `Failed to load ${def.tabLabel}.`);
    } finally {
      setLoading(false);
    }
  }, [def.key, def.tabLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows ?? [];
    if (!q) return list;
    return list.filter((r) =>
      Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / OPTION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * OPTION_PAGE_SIZE, safePage * OPTION_PAGE_SIZE);

  const initialValues = (row: OptionRow | null): Record<string, string | boolean | number | string[]> => {
    const v: Record<string, string | boolean | number | string[]> = {};
    for (const f of def.fields) {
      const cur = row ? (row as unknown as Record<string, unknown>)[f.key] : undefined;
      if (f.kind === 'boolean') v[f.key] = cur === undefined ? (f.key === 'enabledByDefault' ? false : true) : Boolean(cur);
      else if (f.kind === 'stringList') v[f.key] = Array.isArray(cur) ? (cur as string[]) : DEFAULT_SEVERITY_LEVELS.slice();
      else if (f.kind === 'number') v[f.key] = typeof cur === 'number' ? cur : 0;
      else v[f.key] = cur === undefined || cur === null ? '' : String(cur);
    }
    if (!def.reminder) v.sortOrder = typeof row?.sortOrder === 'number' ? row.sortOrder : 0;
    v.isActive = row ? row.isActive !== false : true;
    return v;
  };

  const openForm = (row: OptionRow | null) => {
    setFormError(null);
    setValues(initialValues(row));
    setEditing({ row });
  };

  const validate = (): string | null => {
    for (const f of def.fields) {
      const v = values[f.key];
      if (f.required && (v === undefined || v === null || String(v).trim() === '')) return `${f.label} is required.`;
      if (f.kind === 'stringList' && (!Array.isArray(v) || v.length === 0)) return `${f.label} must have at least one value.`;
      if (f.kind === 'number' && v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return `${f.label} must be 0 or greater.`;
    }
    if (!def.reminder) {
      const sortOrder = Number(values.sortOrder ?? 0);
      if (!Number.isFinite(sortOrder) || sortOrder < 0) return 'Sort order must be 0 or greater.';
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setFormError(problem); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (def.reminder) {
        payload.trackerType = values.trackerType;
        payload.defaultMessage = String(values.defaultMessage ?? '').trim();
        payload.defaultCadence = values.defaultCadence;
        payload.enabledByDefault = Boolean(values.enabledByDefault);
      } else {
        payload.trackerType = def.trackerType;
        payload.label = String(values.label ?? '').trim();
        payload.sortOrder = Number(values.sortOrder ?? 0);
        payload.isActive = Boolean(values.isActive);
        if (def.key === 'habitTemplates') {
          payload.defaultTarget = values.defaultTarget === '' ? null : Number(values.defaultTarget);
          payload.defaultUnit = String(values.defaultUnit ?? '').trim() || null;
          payload.defaultRepeatCycle = values.defaultRepeatCycle || null;
        } else if (def.key === 'moodOptions') {
          payload.emoji = String(values.emoji ?? '').trim() || null;
        } else if (def.key === 'symptoms' || def.key === 'periodSymptoms') {
          payload.severityLevels = values.severityLevels;
        } else if (def.key === 'medications') {
          payload.dosage = String(values.dosage ?? '').trim() || null;
        } else if (def.key === 'expenseCategories') {
          payload.expenseType = values.expenseType;
        }
      }
      const row = editing?.row;
      if (row) {
        await fetchApi(`/${def.key}/${row.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast(`${def.singular} updated.`, 'success');
      } else {
        await fetchApi(`/${def.key}`, { method: 'POST', body: JSON.stringify(payload) });
        showToast(`${def.singular} created.`, 'success');
      }
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const row = pendingDelete;
    setPendingDelete(null);
    if (!row) return;
    try {
      await fetchApi(`/${def.key}/${row.id}`, { method: 'DELETE' });
      showToast(`${def.singular} deleted.`, 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Delete failed.', 'error');
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {loadError && <p className={styles.errorBanner}>{loadError}</p>}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder={`Search ${def.tabLabel.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <PermissionGate permission={MANAGE_PERMISSION}>
          <button type="button" className={styles.addBtn} onClick={() => openForm(null)}>+ Add {def.singular}</button>
        </PermissionGate>
      </div>
      {loading ? (
        <div className={styles.loadingBox}><AdminTableSkeleton /></div>
      ) : filtered.length === 0 ? (
        <NoData title={`No ${def.tabLabel.toLowerCase()}`} description="Nothing matches the current search." />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>{def.columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id}>
                    {def.columns.map((c) => <td key={c.key}>{renderCell(row, c)}</td>)}
                    <td>
                      <div className={styles.actionCell}>
                        <PermissionGate permission={MANAGE_PERMISSION}>
                          <button type="button" className={styles.btnSecondary} onClick={() => openForm(row)}>Edit</button>
                          <button type="button" className={styles.btnDanger} onClick={() => setPendingDelete(row)}>Delete</button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button type="button" className={styles.btnSecondary} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Prev</button>
              <span>Page {safePage} of {totalPages}</span>
              <button type="button" className={styles.btnSecondary} disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {editing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{editing.row ? `Edit ${def.singular}` : `Add ${def.singular}`}</h3>
            {formError && <p className={styles.modalError}>{formError}</p>}
            <div className={styles.formGrid}>
              {def.fields.map((f) => (
                <OptionFieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] as string | boolean | number | undefined}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className={styles.btnPrimary} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title={`Delete ${def.singular}`}
          message={`Delete "${pendingDelete.label ?? pendingDelete.trackerType}"? This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={remove}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
