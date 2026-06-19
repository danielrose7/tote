'use client';

import { useAuth } from '@clerk/nextjs';
import { useIsMutating } from '@tanstack/react-query';
import dayjs from '../../../../lib/dayjs';
import { useEffect, useRef, useState } from 'react';
import {
  type CollectionSyncIssue,
  dismissCollectionSyncIssue,
  getCollectionSyncIssues,
} from '../../../../lib/collections/queryPersistence';
import {
  collectionSyncIssueEvent,
  notifyCollectionSyncIssues,
} from '../../../../lib/collections/syncStatus';
import styles from './SyncStatus.module.css';

type Status = 'idle' | 'syncing' | 'saved' | 'stable';

function useCollectionSyncIssues(userId: string | null) {
  const [issues, setIssues] = useState<CollectionSyncIssue[]>([]);

  useEffect(() => {
    if (!userId) {
      setIssues([]);
      return;
    }
    const refresh = () => {
      void getCollectionSyncIssues(userId).then(setIssues);
    };
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === userId) refresh();
    };
    refresh();
    window.addEventListener(collectionSyncIssueEvent, handleChange);
    return () =>
      window.removeEventListener(collectionSyncIssueEvent, handleChange);
  }, [userId]);

  return issues;
}

export function SyncStatus({
  collectionId: _collectionId,
  initialSavedAt,
}: {
  collectionId: string;
  initialSavedAt?: string | Date | null;
}) {
  const { userId } = useAuth();
  const issues = useCollectionSyncIssues(userId);
  const isMutating = useIsMutating({
    mutationKey: ['collections', 'nodes'],
    exact: false,
  });
  const [status, setStatus] = useState<Status>(() =>
    initialSavedAt ? 'stable' : 'idle',
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() =>
    initialSavedAt ? new Date(initialSavedAt) : null,
  );
  const [, setTick] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMutating = useRef(0);

  useEffect(() => {
    if (status !== 'stable' || !lastSavedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [status, lastSavedAt]);

  useEffect(() => {
    if (isMutating > 0) {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
        savedTimer.current = null;
      }
      setStatus('syncing');
    } else if (prevMutating.current > 0) {
      setLastSavedAt(new Date());
      setStatus('saved');
      savedTimer.current = setTimeout(() => setStatus('stable'), 3000);
    }
    prevMutating.current = isMutating;
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [isMutating]);

  const latestIssue = issues[0];
  if (latestIssue && userId) {
    return (
      <span className={`${styles.status} ${styles.error}`} aria-live="polite">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Sync failed · {latestIssue.operation}
        {issues.length > 1 && ` (${issues.length})`}
        <button
          type="button"
          className={styles.dismissButton}
          aria-label="Dismiss sync error"
          onClick={() => {
            void dismissCollectionSyncIssue(userId, latestIssue.id).then(() =>
              notifyCollectionSyncIssues(userId),
            );
          }}
        >
          ×
        </button>
      </span>
    );
  }

  if (status === 'syncing') {
    return (
      <span className={styles.status} aria-live="polite">
        <svg
          className={styles.spinner}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Saving...
      </span>
    );
  }

  if (status === 'saved' && lastSavedAt) {
    return (
      <span className={`${styles.status} ${styles.saved}`} aria-live="polite">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Saved {dayjs(lastSavedAt).fromNow()}
      </span>
    );
  }

  if (status === 'stable' && lastSavedAt) {
    return (
      <span className={`${styles.status} ${styles.stable}`}>
        Last saved {dayjs(lastSavedAt).fromNow()}
      </span>
    );
  }

  return null;
}
