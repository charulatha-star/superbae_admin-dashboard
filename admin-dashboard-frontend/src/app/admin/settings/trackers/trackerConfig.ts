// Trackers Configuration hub — shared types, enums, and resource definitions.
// Mirrors the Phase 2 backend contract exactly (services/trackerConfig.ts).
// Do not invent enum values or fields: every entry below matches backend validation.

export const MANAGE_PERMISSION = 'TRACKER_CONFIG_MANAGE';

export const TRACKER_TYPES = [
  'habit', 'mood', 'water', 'sleep', 'expense',
  'sickness', 'measure', 'period', 'intimacy', 'bmi',
] as const;

export type TrackerType = (typeof TRACKER_TYPES)[number];

export const TRACKER_TYPE_LABELS: Record<TrackerType, string> = {
  habit: 'Habit',
  mood: 'Mood',
  water: 'Water',
  sleep: 'Sleep',
  expense: 'Expense',
  sickness: 'Sickness',
  measure: 'Measure',
  period: 'Period',
  intimacy: 'Intimacy',
  bmi: 'BMI',
};

export const REPEAT_CYCLES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export const EXPENSE_TYPES = ['expense', 'income'] as const;
export const CADENCES = ['daily', 'weekly', 'custom'] as const;
export const DEFAULT_SEVERITY_LEVELS = ['Low', 'Moderate', 'Extreme'];

// ---------------- Documents ----------------

export interface TrackerDoc {
  id: string;
  trackerType: TrackerType;
  name: string;
  description: string | null;
  category: string | null;
  isEnabled: boolean;
  sortOrder: number;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// One loose row type covering every option resource + reminder templates.
export interface OptionRow {
  id: string;
  trackerType: TrackerType;
  label?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
  // habitTemplates
  defaultTarget?: number | null;
  defaultUnit?: string | null;
  defaultRepeatCycle?: string | null;
  // moodOptions
  emoji?: string | null;
  // symptoms / periodSymptoms
  severityLevels?: string[] | null;
  // medications
  dosage?: string | null;
  // expenseCategories
  expenseType?: string | null;
  // reminderTemplates
  defaultMessage?: string | null;
  defaultCadence?: string | null;
  enabledByDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SingletonDoc = Record<string, unknown>;

// ---------------- Form field definitions ----------------

export type FieldKind = 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'stringList';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  kind?: 'text' | 'type' | 'number' | 'list' | 'bool';
}

export interface OptionResourceDef {
  key: string; // backend resource name, e.g. 'habitTemplates'
  tabLabel: string;
  singular: string;
  trackerType: TrackerType; // trackerType applied to rows of this resource
  columns: ColumnDef[];
  fields: FieldDef[];
  reminder?: boolean; // reminderTemplates shape (own fields, one row per tracker type)
}

const trackerTypeField: FieldDef = {
  key: 'trackerType',
  label: 'Tracker Type',
  kind: 'select',
  required: true,
  options: TRACKER_TYPES.map((t) => ({ value: t, label: TRACKER_TYPE_LABELS[t] })),
};

const repeatCycleField: FieldDef = {
  key: 'defaultRepeatCycle',
  label: 'Default Repeat Cycle',
  kind: 'select',
  options: REPEAT_CYCLES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
};

const expenseTypeField: FieldDef = {
  key: 'expenseType',
  label: 'Expense Type',
  kind: 'select',
  required: true,
  options: EXPENSE_TYPES.map((t) => ({ value: t, label: t === 'income' ? 'Income' : 'Expense' })),
};

const cadenceField: FieldDef = {
  key: 'defaultCadence',
  label: 'Default Cadence',
  kind: 'select',
  options: CADENCES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
};

const sharedOptionFields: FieldDef[] = [
  { key: 'label', label: 'Label', kind: 'text', required: true },
  { key: 'sortOrder', label: 'Sort Order', kind: 'number', placeholder: '0' },
  { key: 'isActive', label: 'Active', kind: 'boolean' },
];

const moodOptionFields: FieldDef[] = [
  { key: 'label', label: 'Label', kind: 'text', required: true },
  { key: 'sortOrder', label: 'Sort Order', kind: 'number', placeholder: '0' },
  { key: 'isActive', label: 'Active', kind: 'boolean' },
];

export const OPTION_RESOURCES: OptionResourceDef[] = [
  {
    key: 'habitTemplates',
    tabLabel: 'Habit Templates',
    singular: 'Habit Template',
    trackerType: 'habit',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'defaultTarget', label: 'Target', kind: 'number' },
      { key: 'defaultUnit', label: 'Unit' },
      { key: 'defaultRepeatCycle', label: 'Repeat' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...sharedOptionFields,
      { key: 'defaultTarget', label: 'Default Target', kind: 'number', placeholder: 'e.g. 5' },
      { key: 'defaultUnit', label: 'Default Unit', kind: 'text', placeholder: 'e.g. km, g, hours' },
      repeatCycleField,
    ],
  },
  {
    key: 'moodOptions',
    tabLabel: 'Mood Options',
    singular: 'Mood Option',
    trackerType: 'mood',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'emoji', label: 'Emoji' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...moodOptionFields,
      { key: 'emoji', label: 'Emoji', kind: 'text', placeholder: 'e.g. 😊' },
    ],
  },
  {
    key: 'symptoms',
    tabLabel: 'Symptoms',
    singular: 'Symptom',
    trackerType: 'sickness',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'severityLevels', label: 'Severity Levels', kind: 'list' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...sharedOptionFields,
      { key: 'severityLevels', label: 'Severity Levels', kind: 'stringList', help: 'Comma separated, e.g. Low, Moderate, Extreme' },
    ],
  },
  {
    key: 'periodSymptoms',
    tabLabel: 'Period Symptoms',
    singular: 'Period Symptom',
    trackerType: 'period',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'severityLevels', label: 'Severity Levels', kind: 'list' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...sharedOptionFields,
      { key: 'severityLevels', label: 'Severity Levels', kind: 'stringList', help: 'Comma separated, e.g. Low, Moderate, Extreme' },
    ],
  },
  {
    key: 'medications',
    tabLabel: 'Medications',
    singular: 'Medication',
    trackerType: 'sickness',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'dosage', label: 'Dosage' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...sharedOptionFields,
      { key: 'dosage', label: 'Dosage', kind: 'text', placeholder: 'e.g. 500mg' },
    ],
  },
  {
    key: 'expenseCategories',
    tabLabel: 'Expense Categories',
    singular: 'Expense Category',
    trackerType: 'expense',
    columns: [
      { key: 'label', label: 'Label' },
      { key: 'expenseType', label: 'Type' },
      { key: 'sortOrder', label: 'Order', kind: 'number' },
      { key: 'isActive', label: 'Active', kind: 'bool' },
    ],
    fields: [
      ...sharedOptionFields,
      expenseTypeField,
    ],
  },
  {
    key: 'reminderTemplates',
    tabLabel: 'Reminder Templates',
    singular: 'Reminder Template',
    trackerType: 'water', // unused for reminder rows — the form selects the type (one template per type)
    reminder: true,
    columns: [
      { key: 'trackerType', label: 'Tracker Type', kind: 'type' },
      { key: 'defaultMessage', label: 'Default Message' },
      { key: 'defaultCadence', label: 'Cadence' },
      { key: 'enabledByDefault', label: 'On By Default', kind: 'bool' },
    ],
    fields: [
      trackerTypeField,
      { key: 'defaultMessage', label: 'Default Message', kind: 'text', required: true },
      cadenceField,
      { key: 'enabledByDefault', label: 'Enabled By Default', kind: 'boolean' },
    ],
  },
];

// ---------------- Trackers tab (form fields minus trackerType, which gets
// special disabled/used-type handling in the table component) ----------------

export const TRACKER_FORM_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', kind: 'text', required: true },
  { key: 'description', label: 'Description', kind: 'textarea' },
  { key: 'category', label: 'Category', kind: 'text', placeholder: 'Free text, e.g. Wellness' },
  { key: 'isEnabled', label: 'Enabled', kind: 'boolean' },
  { key: 'sortOrder', label: 'Sort Order', kind: 'number', placeholder: '0' },
];

// ---------------- Units tab (singleton docs, metric-only) ----------------

export interface MeasurementFieldRow {
  field: string;
  unit: string;
}

export interface MeasurementUnitsDoc {
  unitSystem: string;
  fields?: MeasurementFieldRow[];
}

export interface WaterPresetRow {
  label: string;
  amountMl: number;
}

export interface WaterUnitsDoc {
  unitSystem: string;
  presets?: WaterPresetRow[];
  customUnit?: string | null;
  customDefaultMl?: number | null;
  dailyGoalMl?: number | null;
}

// Exact whitelist from the backend METRIC_UNITS set (services/trackerConfig.ts).
// Values outside this list are rejected with 400 by the backend.
export const METRIC_UNIT_OPTIONS = ['KG', 'CM', 'ML', 'L', 'g', 'km', 'h', 'times', 'steps'];

// Display labels for the fixed measurement body fields (Phase 1 seed).
export const MEASUREMENT_FIELD_LABELS: Record<string, string> = {
  weight: 'Weight',
  bust: 'Bust',
  waist: 'Waist',
  height: 'Height',
  hip: 'Hip',
  thighLeft: 'Thigh (L)',
  thighRight: 'Thigh (R)',
  armLeft: 'Arm (L)',
  armRight: 'Arm (R)',
};

export function fieldLabel(field: string): string {
  return MEASUREMENT_FIELD_LABELS[field] ?? field;
}

// Rows per page for client-side pagination (lists are small config lists).
export const OPTION_PAGE_SIZE = 8;
