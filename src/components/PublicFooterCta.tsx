'use client';

import { SignedIn, SignedOut, SignUpButton } from '@clerk/nextjs';
import Link from 'next/link';
import styles from './PublicFooterCta.module.css';

export function PublicFooterCta({ cloneHref }: { cloneHref?: string }) {
  return (
    <>
      <SignedOut>
        <div className={styles.cta}>
          <p className={styles.ctaText}>
            Like this list? Start your own on Tote.
          </p>
          <SignUpButton
            mode="modal"
            fallbackRedirectUrl={cloneHref ?? '/collections'}
          >
            <button type="button" className={styles.ctaButton}>
              Start for free
            </button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
        <div className={styles.cta}>
          <Link href="/collections" className={styles.ctaLink}>
            Go to your collections →
          </Link>
        </div>
      </SignedIn>
    </>
  );
}
