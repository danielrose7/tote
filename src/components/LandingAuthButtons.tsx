'use client';

import { Show, SignInButton, SignUpButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';
import { useTranslation } from '@/i18n/client';
import styles from '../AuthButton.module.css';

interface LandingAuthButtonsProps {
  showSignIn?: boolean;
  signInLabel?: string;
  signUpLabel?: string;
  signedInLabel?: string;
}

function AuthButtonsFallback() {
  const { t } = useTranslation();
  return (
    <div className={styles.buttons}>
      <button type="button" className={styles.button} disabled>
        {t('site.auth.logIn')}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.buttonPrimary}`}
        disabled
      >
        {t('site.auth.signUp')}
      </button>
    </div>
  );
}

function LandingAuthButtonsInner({
  showSignIn = true,
  signInLabel,
  signUpLabel,
  signedInLabel,
}: LandingAuthButtonsProps) {
  const { t } = useTranslation();
  return (
    <>
      <Show when="signed-out">
        <div className={styles.buttons}>
          {showSignIn ? (
            <SignInButton mode="modal" fallbackRedirectUrl="/collections">
              <button type="button" className={styles.button}>
                {signInLabel ?? t('site.auth.logIn')}
              </button>
            </SignInButton>
          ) : null}
          <SignUpButton mode="modal" fallbackRedirectUrl="/collections">
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              {signUpLabel ?? t('site.auth.signUp')}
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <Link
          href="/collections"
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          {signedInLabel ?? t('site.auth.openTote')}
        </Link>
      </Show>
    </>
  );
}

export function LandingAuthButtons(props: LandingAuthButtonsProps) {
  return (
    <Suspense fallback={<AuthButtonsFallback />}>
      <LandingAuthButtonsInner {...props} />
    </Suspense>
  );
}
