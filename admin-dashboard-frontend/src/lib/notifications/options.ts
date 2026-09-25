// src/lib/notifications/options.ts
import { useEffect, useState } from 'react';
import { fetchApi } from '../api/api';
import {
  friendlyError,
  type NotificationOptions,
  type SegmentOption,
} from './helpers';

let optionsPromise: Promise<NotificationOptions> | null = null;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * Defensive normalization: the endpoint is the source of truth, but the UI
 * must keep working even if a field is missing (treated as an empty list —
 * never replaced with hard-coded values).
 */
function normalizeOptions(raw: Partial<NotificationOptions>): NotificationOptions {
  const rawSegments: unknown[] = Array.isArray(raw.segments) ? raw.segments : [];
  const segments: SegmentOption[] = [];
  for (const entry of rawSegments) {
    if (entry && typeof entry === 'object') {
      const candidate = entry as Partial<SegmentOption>;
      if (typeof candidate.value === 'string' && candidate.value) {
        segments.push({
          value: candidate.value,
          label: typeof candidate.label === 'string' && candidate.label ? candidate.label : candidate.value,
        });
      }
    }
  }
  return {
    channels: asStringArray(raw.channels),
    sendableChannels: asStringArray(raw.sendableChannels),
    statuses: asStringArray(raw.statuses),
    clientEditableStatuses: asStringArray(raw.clientEditableStatuses),
    segments,
  };
}

/**
 * GET /notifications/options — the single source of truth for the channel /
 * status / segment vocabulary (never hard-coded in the UI). The first
 * successful response is cached for the session; a failure is never cached
 * and `force` clears the cache for an explicit retry.
 */
export function fetchNotificationOptions(force = false): Promise<NotificationOptions> {
  if (force) optionsPromise = null;
  if (!optionsPromise) {
    optionsPromise = fetchApi<Partial<NotificationOptions>>('/notifications/options')
      .then(normalizeOptions)
      .catch((error: unknown) => {
        optionsPromise = null;
        throw error;
      });
  }
  return optionsPromise;
}

export interface NotificationOptionsState {
  options: NotificationOptions | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Shared loading/error/retry state for the options endpoint. The initial
 * values cover the first render, and every setState happens only after the
 * awaited fetch, so effects stay free of synchronous state updates.
 */
export function useNotificationOptions(): NotificationOptionsState {
  const [attempt, setAttempt] = useState(0);
  const [options, setOptions] = useState<NotificationOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchNotificationOptions(attempt > 0);
        if (!cancelled) {
          setOptions(loaded);
          setError(null);
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(friendlyError(loadError, 'Failed to load notification options.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = (): void => {
    setLoading(true);
    setError(null);
    setAttempt((current) => current + 1);
  };

  return { options, loading, error, retry };
}
