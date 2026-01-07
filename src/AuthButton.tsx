"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import styles from "./AuthButton.module.css";

interface AuthButtonProps {
  variant?: "landing" | "app";
}

export function AuthButton({ variant = "app" }: AuthButtonProps) {
  const { user, isLoaded } = useUser();

  return (
    <>
      <SignedOut>
        <div className={styles.buttons}>
          <SignInButton mode="modal">
            <button className={styles.button}>Log in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className={`${styles.button} ${styles.buttonPrimary}`}>Sign up</button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
        {variant === "landing" ? (
          <Link href="/collections" className={`${styles.button} ${styles.buttonPrimary}`}>
            Open Tote
          </Link>
        ) : (
          <Link href="/settings" className={styles.avatarLink}>
            {isLoaded && user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.firstName || "Account"}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {user?.firstName?.[0] || "?"}
              </div>
            )}
          </Link>
        )}
      </SignedIn>
    </>
  );
}
