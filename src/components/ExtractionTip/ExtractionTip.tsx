'use client';

import { useTranslation } from '@/i18n/client';
import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';
import { snoozeExtractionHint } from '@/lib/extractionHint';
import styles from './ExtractionTip.module.css';

/**
 * Inline hint for pages we could only partly read. Saving is never blocked;
 * this points to the routes that read the page in the user's own browser.
 * Controlled: the parent decides when to show it and hides it in onDismiss.
 * Dismissing also snoozes the hint for a few days (see extractionHint.ts).
 */
export function ExtractionTip({
  message,
  showLinks = true,
  onDismiss,
}: {
  message?: string;
  showLinks?: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <output className={styles.tip}>
      <p className={styles.message}>
        {message ?? t('shell.extractionTip.message')}
        {showLinks && (
          <span className={styles.links}>
            <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
              {t('shell.extractionTip.getExtension')}
            </a>
            {APP_STORE_URL && (
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
                {t('shell.extractionTip.iosApp')}
              </a>
            )}
          </span>
        )}
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => {
          snoozeExtractionHint();
          onDismiss();
        }}
      >
        {t('shell.dismiss')}
      </button>
    </output>
  );
}
