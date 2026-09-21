'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchApi } from '../../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../../components/admin/Skeleton';
import { Toast } from '../../../../../components/admin/Toast';
import { PermissionGate } from '../../../../../components/admin/PermissionGate';
import styles from '../trackers.module.css';
import {
  MANAGE_PERMISSION,
  METRIC_UNIT_OPTIONS,
  MeasurementUnitsDoc,
  WaterUnitsDoc,
  WaterPresetRow,
  fieldLabel,
} from '../trackerConfig';
import { OptionFieldInput } from './TrackersTable';

/**
 * Units tab: measurement + water singleton settings. Metric-only, no add,
 * no delete. GET returns 404 until first save; PATCH partial-merges and
 * upserts, so the forms PATCH a full valid payload either way.
 */

const MEASUREMENT_FIELDS = [
  'weight', 'bust', 'waist', 'height', 'hip',
  'thighLeft', 'thighRight', 'armLeft', 'armRight',
] as const;

const EMPTY_MEASUREMENT: MeasurementUnitsDoc = { unitSystem: 'metric' };
const EMPTY_WATER: WaterUnitsDoc = { unitSystem: 'metric', presets: [], customUnit: 'ml', customDefaultMl: 300, dailyGoalMl: 1000 };

export function UnitsSettings() {
  const [units, setUnits] = useState<MeasurementUnitsDoc | null>(null);
  const [water, setWater] = useState<WaterUnitsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // GET returns 404 when not yet saved — treat as "defaults, unsaved".
      const [u, w] = await Promise.allSettled([
        fetchApi<MeasurementUnitsDoc>('/measurementUnits'),
        fetchApi<WaterUnitsDoc>('/waterUnits'),
      ]);
      setUnits(u.status === 'fulfilled' ? u.value : null);
      setWater(w.status === 'fulfilled' ? w.value : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load unit settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFieldError = (key: string, message: string | null) =>
    setErrors((prev) => ({ ...prev, [key]: message }));

  const saveMeasurement = async () => {
    if (!units) return;
    setSavingKey('measurement');
    setFieldError('measurement', null);
    try {
      const saved = await fetchApi<MeasurementUnitsDoc>('/measurementUnits', {
        method: 'PATCH',
        body: JSON.stringify({ unitSystem: 'metric', fields: units.fields ?? [] }),
      });
      setUnits(saved);
      showToast('Measurement units saved.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save measurement units.';
      setFieldError('measurement', message);
      showToast(message, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const saveWater = async () => {
    if (!water) return;
    setSavingKey('water');
    setFieldError('water', null);
    try {
      const saved = await fetchApi<WaterUnitsDoc>('/waterUnits', {
        method: 'PATCH',
        body: JSON.stringify({
          unitSystem: 'metric',
          presets: (water.presets ?? []).map((p) => ({ label: p.label, amountMl: Number(p.amountMl) })),
          customUnit: water.customUnit ?? 'ml',
          customDefaultMl: Number(water.customDefaultMl ?? 300),
          dailyGoalMl: Number(water.dailyGoalMl ?? 1000),
        }),
      });
      setWater(saved);
      showToast('Water units saved.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save water units.';
      setFieldError('water', message);
      showToast(message, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const updateMeasurementUnit = (field: string, unit: string) => {
    if (!units) return;
    const existing = units.fields ?? MEASUREMENT_FIELDS.map((f) => ({ field: f, unit: 'CM' }));
    setUnits({
      ...units,
      fields: existing.map((row) => (row.field === field ? { ...row, unit } : row)),
    });
  };

  const updatePreset = (index: number, patch: Partial<WaterPresetRow>) => {
    if (!water) return;
    setWater({
      ...water,
      presets: (water.presets ?? []).map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  };


  if (loading) {
    return <div className={styles.loadingBox}><AdminTableSkeleton /></div>;
  }
  if (loadError) {
    return <p className={styles.modalError}>{loadError}</p>;
  }

  const unitRows = units?.fields ?? [];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.unitCards}>
        <section className={styles.unitCard}>
          <h3 className={styles.unitCardTitle}>Measurement Units</h3>
          <p className={styles.unitCardNote}>Metric only in this phase. Applies to body measurements recorded in the app.</p>
          {unitRows.length === 0 && (
            <p className={styles.emptyHint}>No measurement units saved yet. Load defaults below, then save.</p>
          )}
          {unitRows.map((row) => (
            <div key={row.field} className={styles.unitRow}>
              <span className={styles.formField} style={{ flex: 1 }}>{fieldLabel(row.field)}</span>
              <select
                className={`${styles.fieldSelect} ${styles.unitRowSmall}`}
                value={row.unit}
                onChange={(e) => updateMeasurementUnit(row.field, e.target.value)}
              >
                {METRIC_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          ))}
          {unitRows.length === 0 && (
            <button
              type="button"
              className={`${styles.btnSecondary} ${styles.addRowBtn}`}
              onClick={() => setUnits({ unitSystem: 'metric', fields: MEASUREMENT_FIELDS.map((f) => ({ field: f, unit: f === 'weight' ? 'KG' : 'CM' })) })}
            >
              Load default fields
            </button>
          )}
          {errors.measurement && <p className={styles.modalError}>{errors.measurement}</p>}
          <PermissionGate permission={MANAGE_PERMISSION}>
            <div className={styles.unitSaveRow}>
              <button type="button" className={styles.btnPrimary} disabled={savingKey === 'measurement'} onClick={saveMeasurement}>
                {savingKey === 'measurement' ? 'Saving...' : 'Save Measurement Units'}
              </button>
            </div>
          </PermissionGate>
        </section>

        <section className={styles.unitCard}>
          <h3 className={styles.unitCardTitle}>Water Units</h3>
          <p className={styles.unitCardNote}>Metric only. Presets shown on the water tracker tile.</p>
          {(water?.presets ?? []).length === 0 && (
            <p className={styles.emptyHint}>No presets saved yet. Add at least one preset before saving.</p>
          )}
          {(water?.presets ?? []).map((p, i) => (
            <div key={i} className={styles.unitRow}>
              <input
                className={`${styles.fieldInput} ${styles.unitRowSmall}`}
                style={{ width: 140 }}
                value={p.label}
                onChange={(e) => updatePreset(i, { label: e.target.value })}
                placeholder="Label"
              />
              <input
                className={`${styles.fieldInput} ${styles.unitRowSmall}`}
                type="number"
                min={1}
                value={p.amountMl}
                onChange={(e) => updatePreset(i, { amountMl: Number(e.target.value) })}
                placeholder="ml"
              />
              <span className={styles.mutedText}>ml</span>
            </div>
          ))}
          <div className={styles.unitRow}>
            <span className={styles.formField}>Custom cup default (ml)</span>
            <input
              className={`${styles.fieldInput} ${styles.unitRowSmall}`}
              type="number"
              min={1}
              value={water?.customDefaultMl ?? 300}
              onChange={(e) => setWater((prev) => (prev ? { ...prev, customDefaultMl: Number(e.target.value) } : prev))}
            />
          </div>
          <div className={styles.unitRow}>
            <span className={styles.formField}>Daily goal (ml)</span>
            <input
              className={`${styles.fieldInput} ${styles.unitRowSmall}`}
              type="number"
              min={1}
              value={water?.dailyGoalMl ?? 1000}
              onChange={(e) => setWater((prev) => (prev ? { ...prev, dailyGoalMl: Number(e.target.value) } : prev))}
            />
          </div>
          {errors.water && <p className={styles.modalError}>{errors.water}</p>}
          <PermissionGate permission={MANAGE_PERMISSION}>
            <div className={styles.unitSaveRow}>
              <button type="button" className={styles.btnPrimary} disabled={savingKey === 'water'} onClick={saveWater}>
                {savingKey === 'water' ? 'Saving...' : 'Save Water Units'}
              </button>
            </div>
          </PermissionGate>
        </section>
      </div>
    </div>
  );
}
