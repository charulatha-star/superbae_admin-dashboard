/**
 * TEMP AUDIT SCRIPT (read-only, no DB connection, no writes).
 * Calls the real validation functions to prove invalid enums throw 400-mapped errors.
 * Deleted immediately after running.
 */
import {
  TrackerInputError,
  validateOptionCreate,
  validateOptionUpdates,
  validateTrackerCreate,
  validateMeasurementUnits,
  validateWaterUnits,
} from './src/services/trackerConfig';

function probe(label: string, fn: () => unknown): void {
  try {
    const out = fn();
    console.log(`NOT_REJECTED ${label} -> ${JSON.stringify(out)}`);
  } catch (e) {
    const err = e as TrackerInputError;
    console.log(`REJECTED ${label} -> status=${String(err.statusCode)} msg=${err.message}`);
  }
}

probe('trackerType=bogus', () => validateTrackerCreate({ trackerType: 'bogus', name: 'X' }));
probe('expenseType=refund', () => validateOptionCreate('expenseCategories', { trackerType: 'expense', label: 'X', expenseType: 'refund' }));
probe('expenseType missing', () => validateOptionCreate('expenseCategories', { trackerType: 'expense', label: 'X' }));
probe('defaultRepeatCycle=hourly', () => validateOptionCreate('habitTemplates', { trackerType: 'habit', label: 'X', defaultRepeatCycle: 'hourly' }));
probe('defaultCadence=monthly', () => validateOptionCreate('reminderTemplates', { trackerType: 'water', defaultMessage: 'M', defaultCadence: 'monthly' }));
probe('severityLevels=[]', () => validateOptionUpdates('symptoms', { severityLevels: [] }));
probe('isActive="yes"(string)', () => validateOptionUpdates('moodOptions', { isActive: 'yes' }));
probe('sortOrder=-1', () => validateOptionUpdates('medications', { sortOrder: -1 }));
probe('unitSystem=imperial', () => validateMeasurementUnits({ unitSystem: 'imperial' }));
probe('unit=inch', () => validateMeasurementUnits({ fields: [{ field: 'waist', unit: 'inch' }] }));
probe('waterUnit imperial', () => validateWaterUnits({ unitSystem: 'imperial' }));
probe('color-only update (removed field)', () => validateOptionUpdates('habitTemplates', { color: '#fff' }));
probe('valid mood create', () => validateOptionCreate('moodOptions', { trackerType: 'mood', label: 'Happy', emoji: 'x', sortOrder: 1, isActive: true }));
