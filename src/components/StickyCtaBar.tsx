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
        <p className={styles.text}>
          Save products like these to your own Tote list
        </p>
        <SignUpButton
          mode="modal"
          fallbackRedirectUrl={cloneHref ?? '/collections'}
        >
          <button type="button" className={styles.btn}>
            Try Tote free
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
    </SignedOut>
  );
}
