'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/client';
import styles from './MaintenanceBanner.module.css';

const EXPIRES = new Date('2026-07-01');
const DISMISSED_KEY = 'maintenance-banner-jun-2026-dismissed';

export function MaintenanceBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === '1';
  });

  if (Date.now() >= EXPIRES.getTime()) return null;
  if (dismissed) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span>{t('shell.maintenance.message')}</span>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, '1');
            setDismissed(true);
          }}
        >
          {t('shell.dismiss')}
        </button>
      </div>
    </div>
  );
}
