import { Request } from 'express';
import { createId } from '../utils/ids';
import { cleanDoc } from '../utils/clean';
import { LooseDocument, ModelRegistry, TRACKER_TYPES } from '../models/registry';

export const TRACKER_CONFIG_MANAGE_PERMISSION = 'TRACKER_CONFIG_MANAGE' as const;

export class TrackerInputError extends Error {
  statusCode = 400;
}

export class TrackerConflictError extends Error {
  statusCode = 409;
}

export class TrackerNotFoundError extends Error {
  statusCode = 404;
}

const TRACKER_TYPE_SET = new Set<string>([...TRACKER_TYPES]);
const REPEAT_CYCLE_SET = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const CADENCE_SET = new Set(['daily', 'weekly', 'custom']);
const EXPENSE_TYPE_SET = new Set(['expense', 'income']);
const METRIC_UNITS = new Set(['KG', 'CM', 'ML', 'L', 'ml', 'kg', 'cm', 'l', 'g', 'kg', 'km', 'h', 'times', 'steps']);

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new TrackerInputError(`${field} is required.`);
  return text;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function optionalBoolean(value: unknown, def: boolean): boolean {
  if (value === undefined || value === null) return def;
  if (typeof value === 'boolean') return value;
  throw new TrackerInputError('Boolean field must be true or false.');
}

function sortOrderValue(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new TrackerInputError('sortOrder must be a non-negative integer.');
  return n;
}

function trackerTypeValue(value: unknown): string {
  const t = String(value ?? '').trim();
  if (!TRACKER_TYPE_SET.has(t)) {
    throw new TrackerInputError(`trackerType must be one of: ${[...TRACKER_TYPES].join(', ')}.`);
  }
  return t;
}

function labelValue(value: unknown): string {
  return requiredText(value, 'label');
}

function repeatCycleValue(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const s = String(value).trim().toLowerCase();
  if (!REPEAT_CYCLE_SET.has(s)) throw new TrackerInputError('defaultRepeatCycle must be one of: daily, weekly, monthly, yearly.');
  return s;
}

function cadenceValue(value: unknown, def = 'daily'): string {
  if (value === undefined || value === null || String(value).trim() === '') return def;
  const s = String(value).trim().toLowerCase();
  if (!CADENCE_SET.has(s)) throw new TrackerInputError('defaultCadence must be one of: daily, weekly, custom.');
  return s;
}

function expenseTypeValue(value: unknown): string {
  const s = String(value ?? '').trim().toLowerCase();
  if (!EXPENSE_TYPE_SET.has(s)) throw new TrackerInputError(`expenseType must be 'expense' or 'income'.`);
  return s;
}

function severityLevelsValue(value: unknown): string[] {
  if (value === undefined || value === null) return ['Low', 'Moderate', 'Extreme'];
  if (!Array.isArray(value) || value.length === 0) throw new TrackerInputError('severityLevels must be a non-empty array.');
  return value.map((v) => requiredText(v, 'severityLevels entry'));
}

function targetAmountValue(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new TrackerInputError('defaultTarget must be a non-negative number.');
  return n;
}

function configValue(value: unknown): LooseDocument | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new TrackerInputError('config must be an object or null.');
  return value as LooseDocument;
}

export type TrackerOptionResource =
  | 'habitTemplates'
  | 'moodOptions'
  | 'symptoms'
  | 'periodSymptoms'
  | 'medications'
  | 'expenseCategories'
  | 'reminderTemplates';

export const TRACKER_ARRAY_RESOURCES: TrackerOptionResource[] = [
  'habitTemplates',
  'moodOptions',
  'symptoms',
  'periodSymptoms',
  'medications',
  'expenseCategories',
  'reminderTemplates',
];

export function validateTrackerCreate(input: LooseDocument): LooseDocument {
  return {
    trackerType: trackerTypeValue(input.trackerType),
    name: requiredText(input.name, 'name'),
    description: optionalText(input.description),
    category: optionalText(input.category),
    isEnabled: optionalBoolean(input.isEnabled, true),
    sortOrder: sortOrderValue(input.sortOrder),
    config: configValue(input.config),
  };
}

export function validateTrackerUpdates(input: LooseDocument): LooseDocument {
  const updates: LooseDocument = {};
  if (input.trackerType !== undefined) updates.trackerType = trackerTypeValue(input.trackerType);
  if (input.name !== undefined) updates.name = requiredText(input.name, 'name');
  if (input.description !== undefined) updates.description = optionalText(input.description);
  if (input.category !== undefined) updates.category = optionalText(input.category);
  if (input.isEnabled !== undefined) updates.isEnabled = optionalBoolean(input.isEnabled, true);
  if (input.sortOrder !== undefined) updates.sortOrder = sortOrderValue(input.sortOrder);
  if (input.config !== undefined) updates.config = configValue(input.config);
  if (Object.keys(updates).length === 0) throw new TrackerInputError('At least one tracker field is required.');
  return updates;
}

function sharedOptionBase(input: LooseDocument): LooseDocument {
  return {
    trackerType: trackerTypeValue(input.trackerType),
    label: labelValue(input.label),
    sortOrder: sortOrderValue(input.sortOrder),
    isActive: optionalBoolean(input.isActive, true),
  };
}

export function validateOptionCreate(resource: TrackerOptionResource, input: LooseDocument): LooseDocument {
  const base = sharedOptionBase(input);
  if (resource === 'habitTemplates') {
    return { ...base, defaultTarget: targetAmountValue(input.defaultTarget), defaultUnit: optionalText(input.defaultUnit), defaultRepeatCycle: repeatCycleValue(input.defaultRepeatCycle) };
  }
  if (resource === 'moodOptions') return { ...base, emoji: optionalText(input.emoji) };
  if (resource === 'symptoms' || resource === 'periodSymptoms') {
    return { ...base, severityLevels: severityLevelsValue(input.severityLevels) };
  }
  if (resource === 'medications') {
    return { ...base, dosage: optionalText(input.dosage) };
  }
  if (resource === 'expenseCategories') {
    return { ...base, expenseType: expenseTypeValue(input.expenseType) };
  }
  return {
    trackerType: trackerTypeValue(input.trackerType),
    defaultMessage: requiredText(input.defaultMessage, 'defaultMessage'),
    defaultCadence: cadenceValue(input.defaultCadence),
    enabledByDefault: optionalBoolean(input.enabledByDefault, false),
  };
}

export function validateOptionUpdates(resource: TrackerOptionResource, input: LooseDocument): LooseDocument {
  const updates: LooseDocument = {};
  const shared = resource !== 'reminderTemplates';
  if (input.trackerType !== undefined) updates.trackerType = trackerTypeValue(input.trackerType);
  if (shared && input.label !== undefined) updates.label = labelValue(input.label);
  if (input.sortOrder !== undefined) updates.sortOrder = sortOrderValue(input.sortOrder);
  if (shared && input.isActive !== undefined) updates.isActive = optionalBoolean(input.isActive, true);
  if (resource === 'habitTemplates') {
    if (input.defaultTarget !== undefined) updates.defaultTarget = targetAmountValue(input.defaultTarget);
    if (input.defaultUnit !== undefined) updates.defaultUnit = optionalText(input.defaultUnit);
    if (input.defaultRepeatCycle !== undefined) updates.defaultRepeatCycle = repeatCycleValue(input.defaultRepeatCycle);
  }
  if (resource === 'moodOptions' && input.emoji !== undefined) updates.emoji = optionalText(input.emoji);
  if ((resource === 'symptoms' || resource === 'periodSymptoms') && input.severityLevels !== undefined) {
    updates.severityLevels = severityLevelsValue(input.severityLevels);
  }
  if (resource === 'medications' && input.dosage !== undefined) updates.dosage = optionalText(input.dosage);
  if (resource === 'expenseCategories' && input.expenseType !== undefined) updates.expenseType = expenseTypeValue(input.expenseType);
  if (resource === 'reminderTemplates') {
    if (input.defaultMessage !== undefined) updates.defaultMessage = requiredText(input.defaultMessage, 'defaultMessage');
    if (input.defaultCadence !== undefined) updates.defaultCadence = cadenceValue(input.defaultCadence);
    if (input.enabledByDefault !== undefined) updates.enabledByDefault = optionalBoolean(input.enabledByDefault, false);
  }
  if (Object.keys(updates).length === 0) throw new TrackerInputError('At least one field is required to update.');
  return updates;
}

export function validateMeasurementUnits(input: LooseDocument): LooseDocument {
  const unitSystem = String(input.unitSystem ?? 'metric').trim().toLowerCase();
  if (unitSystem !== 'metric') throw new TrackerInputError('unitSystem must be metric in this phase.');
  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      throw new TrackerInputError('fields must be a non-empty array.');
    }
    for (const entry of input.fields) {
      if (!entry || typeof entry !== 'object') throw new TrackerInputError('Each field entry must be an object.');
      requiredText((entry as LooseDocument).field, 'fields[].field');
      const unit = String((entry as LooseDocument).unit ?? '').trim();
      if (!METRIC_UNITS.has(unit) && !METRIC_UNITS.has(unit.toUpperCase())) {
        throw new TrackerInputError(`Unsupported unit '${unit}'. Metric-only units in this phase.`);
      }
    }
  }
  const out: LooseDocument = { unitSystem: 'metric' };
  if (input.fields !== undefined) out.fields = input.fields;
  return out;
}

export function validateWaterUnits(input: LooseDocument): LooseDocument {
  const unitSystem = String(input.unitSystem ?? 'metric').trim().toLowerCase();
  if (unitSystem !== 'metric') throw new TrackerInputError('unitSystem must be metric in this phase.');
  const out: LooseDocument = { unitSystem: 'metric' };
  if (input.presets !== undefined) {
    if (!Array.isArray(input.presets) || input.presets.length === 0) {
      throw new TrackerInputError('presets must be a non-empty array.');
    }
    for (const p of input.presets) {
      if (!p || typeof p !== 'object') throw new TrackerInputError('Each preset must be an object.');
      requiredText((p as LooseDocument).label, 'presets[].label');
      const ml = Number((p as LooseDocument).amountMl);
      if (!Number.isFinite(ml) || ml <= 0) throw new TrackerInputError('presets[].amountMl must be greater than 0.');
    }
    out.presets = input.presets;
  }
  if (input.customUnit !== undefined) out.customUnit = requiredText(input.customUnit, 'customUnit');
  if (input.customDefaultMl !== undefined) {
    const n = Number(input.customDefaultMl);
    if (!Number.isFinite(n) || n <= 0) throw new TrackerInputError('customDefaultMl must be greater than 0.');
    out.customDefaultMl = n;
  }
  if (input.dailyGoalMl !== undefined) {
    const n = Number(input.dailyGoalMl);
    if (!Number.isFinite(n) || n <= 0) throw new TrackerInputError('dailyGoalMl must be greater than 0.');
    out.dailyGoalMl = n;
  }
  return out;
}

export async function writeTrackerAudit(
  models: ModelRegistry,
  req: Request,
  action: string,
  resource: string,
  targetId: string,
  description: string,
): Promise<LooseDocument> {
  try {
    const result = await models.auditLogs.create({
      id: createId('audit'),
      adminId: typeof req.currentAdmin?.id === 'string' ? req.currentAdmin.id : 'unknown',
      adminName: typeof req.currentAdmin?.name === 'string' ? req.currentAdmin.name : 'Unknown Admin',
      action,
      target: targetId,
      description,
      createdAt: new Date(),
      targetType: resource,
      targetId,
      reason: null,
    });
    return cleanDoc(result);
  } catch (e) {
    console.error(`[TRACKER AUDIT] Failed to write audit entry for ${action}:`, e);
    throw e;
  }
}




