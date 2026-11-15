'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/client';
import { APP_STORE_URL } from '@/lib/constants';
import { isIosAppPromptSnoozed, snoozeIosAppPrompt } from '@/lib/iosAppPrompt';
import { isIOS, isStandalonePwa } from '@/lib/isIOS';
import styles from './IosAppBanner.module.css';

/**
 * Nudges signed-in visitors on an iPhone/iPad browser toward the App Store
 * app, which is where saving from Safari (Share → Tote) actually works.
 * Starts hidden so server-rendered HTML matches, then decides after mount —
 * same tradeoff InstallCta makes. Dismissing snoozes it for a month.
 */
export function IosAppBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(
      Boolean(APP_STORE_URL) &&
        isIOS() &&
        !isStandalonePwa() &&
        !isIosAppPromptSnoozed(),
    );
  }, []);

  if (!visible || !APP_STORE_URL) return null;

  return (
    <aside className={styles.banner} aria-label={t('shell.iosAppBanner.label')}>
      <p className={styles.message}>{t('shell.iosAppBanner.message')}</p>
      <a
        className={styles.cta}
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('shell.iosAppBanner.cta')}
      </a>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => {
          snoozeIosAppPrompt();
          setVisible(false);
        }}
      >
        {t('shell.dismiss')}
      </button>
    </aside>
  );
}
