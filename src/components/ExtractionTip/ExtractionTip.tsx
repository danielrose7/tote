'use client';

import { useState } from 'react';
import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';
import {
  isExtractionHintSnoozed,
  snoozeExtractionHint,
} from '@/lib/extractionHint';
import styles from './ExtractionTip.module.css';

/**
 * Shown when we could only partly read a page. Saving is never blocked; this
 * points to the routes that read the page in the user's own browser. Dismissal is remembered for a few days.
 */
export function ExtractionTip() {
  const [dismissed, setDismissed] = useState(() =>
    typeof window === 'undefined' ? true : isExtractionHintSnoozed(),
  );
  if (dismissed) return null;

  return (
    <div className={styles.tip} role="status">
      <p className={styles.message}>
        We couldn&apos;t read everything from this site. You can still add it as
        is. The Tote extension and iOS app read pages in your own browser, so
        you usually get the image and price too.
        <span className={styles.links}>
          <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer">
            Get the extension
          </a>
          {APP_STORE_URL && (
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
              iOS app
            </a>
          )}
        </span>
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => {
          snoozeExtractionHint();
          setDismissed(true);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
