'use client';

import { SignedOut, SignUpButton } from '@clerk/nextjs';
import styles from './PreFooterCta.module.css';

export function PreFooterCta({ cloneHref }: { cloneHref?: string }) {
  return (
    <SignedOut>
      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardInner}>
            <h2 className={styles.headline}>Keep your own list like this.</h2>
            <p className={styles.sub}>
              Save from any store and come back when you&apos;re ready to
              decide.
            </p>
            <div className={styles.actions}>
              <SignUpButton
                mode="modal"
                fallbackRedirectUrl={cloneHref ?? '/collections'}
              >
                <button type="button" className={styles.primaryBtn}>
                  Save your first item
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
        </div>
      </section>
    </SignedOut>
  );
}
