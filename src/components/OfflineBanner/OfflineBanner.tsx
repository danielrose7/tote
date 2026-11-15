'use client';

import { useMutationState } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTranslation } from '@/i18n/client';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import styles from './OfflineBanner.module.css';

export function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const pausedStates = useMutationState({
    filters: {
      mutationKey: collectionQueryKeys.all,
      status: 'pending',
    },
    select: (mutation) => mutation.state.isPaused,
  });
  const [mounted, setMounted] = useState(false);
  const pendingCount = pausedStates.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <div className={`${styles.banner} ${styles.offline}`}>
        <div className={styles.content}>
          <span>
            {pendingCount > 0
              ? t('shell.offline.pending', { count: pendingCount })
              : t('shell.offline.cached')}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
