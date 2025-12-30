"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import Link from "next/link";
import styles from "./AuthButton.module.css";

export function AuthButton() {
  const { user, isLoaded } = useUser();

  return (
    <>
      <SignedOut>
        <div className={styles.buttons}>
          <SignInButton mode="modal">
            <button className={styles.button}>Log in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className={styles.button}>Sign up</button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
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
      </SignedIn>
    </>
  );
}
