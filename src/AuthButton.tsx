"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import styles from "./AuthButton.module.css";

export function AuthButton() {
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
        <UserButton />
      </SignedIn>
    </>
  );
}
