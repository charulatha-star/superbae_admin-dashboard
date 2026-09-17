'use client';

import styles from './content.module.css';

// Captured once per module load. Date.now() is impure and cannot be called
// during render (react-hooks/purity); a page reload refreshes the snapshot.
const NOW = Date.now();

interface ContentStatusBadgeProps {
  status?: string | null;
  scheduledAt?: string | Date | null;
}

/**
 * Status badge shared by all CMS content list pages. A draft with a future
 * scheduledAt renders as "Scheduled for <date>" (Phase 5) — distinct from the
 * plain draft/published/archived badges. Once the time passes (or the item is
 * published by the scheduler), the regular status badge returns.
 */
export function ContentStatusBadge({ status, scheduledAt }: ContentStatusBadgeProps) {
  const scheduled = scheduledAt ? new Date(String(scheduledAt)) : null;
  if (scheduled && !Number.isNaN(scheduled.getTime()) && scheduled.getTime() > NOW) {
    return (
      <span className={`${styles.badge} ${styles.badgeScheduled}`}>
        Scheduled for {scheduled.toLocaleString()}
      </span>
    );
  }

  const current = String(status ?? 'draft');
  if (current === 'published') return <span className={`${styles.badge} ${styles.badgePublished}`}>{current}</span>;
  if (current === 'archived') return <span className={`${styles.badge} ${styles.badgeArchived}`}>{current}</span>;
  if (current === 'draft') return <span className={`${styles.badge} ${styles.badgeDraft}`}>{current}</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>{current}</span>;
}

export default ContentStatusBadge;
