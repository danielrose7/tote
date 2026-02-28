"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import styles from "./extension-auth.module.css";

/**
 * Extension auth page
 *
 * This page is opened from the Chrome extension when a user needs to sign in.
 * After authentication, Clerk's Sync Host feature automatically syncs the
 * session to the extension, so we just need to show a success message.
 */
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
        <div className={styles.card}>
          <div className={styles.iconCircleSuccess}>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className={styles.heading}>
            Signed in successfully!
          </h1>
          <p className={styles.text}>
            You can now use the Tote extension to save products.
          </p>
          <p className={styles.textSmall}>
            You can close this tab when you're ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.iconCircleBrand}>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h1 className={styles.heading}>
            Sign in to Tote
          </h1>
          <p className={styles.text}>
            Sign in to save products from the Chrome extension
          </p>
        </div>

        <SignIn
          routing="hash"
          afterSignInUrl="/extension-auth"
          appearance={{
            elements: {
              rootBox: styles.clerkBox,
              card: { boxShadow: "none" },
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
