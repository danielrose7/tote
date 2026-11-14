'use client';

import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';
import { snoozeExtractionHint } from '@/lib/extractionHint';
import styles from './ExtractionTip.module.css';

const DEFAULT_MESSAGE =
  "We couldn't read everything from this site. You can still add it as is. The Tote extension and iOS app read pages in your own browser, so you usually get the image and price too.";

/**
 * Inline hint for pages we could only partly read. Saving is never blocked;
 * this points to the routes that read the page in the user's own browser.
 * Controlled: the parent decides when to show it and hides it in onDismiss.
 * Dismissing also snoozes the hint for a few days (see extractionHint.ts).
 */
export function ExtractionTip({
  message = DEFAULT_MESSAGE,
  showLinks = true,
  onDismiss,
}: {
  message?: string;
  showLinks?: boolean;
  onDismiss: () => void;
}) {
  return (
    <output className={styles.tip}>
      <p className={styles.message}>
        {message}
        {showLinks && (
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
        Dismiss
      </button>
    </output>
  );
}
