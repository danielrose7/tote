'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './extension-auth.module.css';

function ExtensionAuthContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setShowSuccess(true);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className={styles.page}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.nav}>
          <Link href="/" className={styles.wordmark}>
            tote
          </Link>
        </div>
        <div className={styles.content}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className={styles.heading}>You&apos;re signed in</h1>
            <p className={styles.text}>
              The Tote extension is ready to save products from any store.
            </p>
            <p className={styles.textSmall}>You can close this tab.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden="true" />
      <div className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          tote
        </Link>
      </div>
      <div className={styles.content}>
        <div className={styles.logoMark}>
          <img src="/favicon.svg" alt="Tote" width={52} height={52} />
        </div>
        <h1 className={styles.heading}>Sign in to Tote</h1>
        <p className={styles.text}>
          Save products from any store with the Chrome extension
        </p>
        <SignIn
          routing="hash"
          afterSignInUrl="/extension-auth"
          appearance={{
            elements: {
              rootBox: styles.clerkBox,
              card: styles.clerkCard,
              headerTitle: styles.clerkHide,
              headerSubtitle: styles.clerkHide,
              header: styles.clerkHide,
            },
          }}
        />
      </div>
    </div>
  );
}

export default function ExtensionAuthPage() {
  return <ExtensionAuthContent />;
}
