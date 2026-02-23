"use client";

import { Suspense } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import Link from "next/link";
import styles from "../AuthButton.module.css";

function AuthButtonsFallback() {
  return (
    <div className={styles.buttons}>
      <button className={styles.button} disabled>Log in</button>
      <button className={`${styles.button} ${styles.buttonPrimary}`} disabled>Sign up</button>
    </div>
  );
}

function LandingAuthButtonsInner() {
  return (
    <>
      <SignedOut>
        <div className={styles.buttons}>
          <SignInButton mode="modal">
            <button className={styles.button}>Log in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className={`${styles.button} ${styles.buttonPrimary}`}>
              Sign up
            </button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
        <Link href="/collections" className={`${styles.button} ${styles.buttonPrimary}`}>
          Open Tote
        </Link>
      </SignedIn>
    </>
  );
}

export function LandingAuthButtons() {
  return (
    <Suspense fallback={<AuthButtonsFallback />}>
      <LandingAuthButtonsInner />
    </Suspense>
  );
}
