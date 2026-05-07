'use client';

import { SignedOut, SignUpButton } from '@clerk/nextjs';
import styles from './PreFooterCta.module.css';

export function PreFooterCta({ cloneHref }: { cloneHref?: string }) {
  return (
    <SignedOut>
      <section className={styles.section}>
        <div className={styles.card}>
          <h2 className={styles.headline}>Like this list? Start your own.</h2>
          <p className={styles.sub}>
            Try Tote free — it takes about 30 seconds to get started.
          </p>
          <div className={styles.actions}>
            <SignUpButton
              mode="modal"
              fallbackRedirectUrl={cloneHref ?? '/collections'}
            >
              <button type="button" className={styles.primaryBtn}>
                Start for free
              </button>
            </SignUpButton>
            {cloneHref && (
              <SignUpButton mode="modal" fallbackRedirectUrl={cloneHref}>
                <button type="button" className={styles.secondaryBtn}>
                  Save a copy of this list
                </button>
              </SignUpButton>
            )}
          </div>
        </div>
      </section>
    </SignedOut>
  );
}
