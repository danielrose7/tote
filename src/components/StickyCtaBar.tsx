'use client';

import { SignedOut, SignUpButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import styles from './StickyCtaBar.module.css';

export function StickyCtaBar({ cloneHref }: { cloneHref?: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) {
        setVisible(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <SignedOut>
      <div
        className={`${styles.bar} ${visible ? styles.barVisible : ''}`}
        aria-hidden={!visible}
      >
        <div className={styles.inner}>
          <p className={styles.text}>
            Save from any store and come back when you&apos;re ready to decide.
          </p>
          <SignUpButton
            mode="modal"
            fallbackRedirectUrl={cloneHref ?? '/collections'}
          >
            <button type="button" className={styles.btn}>
              Save your first item
            </button>
          </SignUpButton>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </SignedOut>
  );
}
