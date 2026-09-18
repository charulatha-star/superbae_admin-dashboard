/**
 * Shared formatting helpers for CMS content list pages.
 *
 * Content documents are not guaranteed to match the Phase 1 schema — leftover or
 * partially-migrated records can be missing fields entirely (e.g. a doc with a
 * `name` field instead of `title`, or no timestamp at all). These helpers never
 * assume a value is present or parseable, so a single malformed document can
 * never break rendering or turn a displayed value into "Invalid Date".
 */

/** Formats a date-ish value, returning an em dash placeholder when it is missing or invalid. */
export function formatContentDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}