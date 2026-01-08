"use client";

import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignOutButton, UserProfile } from "@clerk/nextjs";
import { useAccount } from "jazz-tools/react";
import Link from "next/link";
import { Header } from "../../components/Header/Header";
import { JazzAccount } from "../../schema";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "error">("loading");

  const me = useAccount(JazzAccount, {
    resolve: {
      root: true,
    },
  });

  // Auto-sync metadata on page load
  useEffect(() => {
    if (me.$jazz?.id) {
      syncMetadata();
    }
  }, [me.$jazz?.id]);

  const syncMetadata = async () => {
    setSyncStatus("loading");
    try {
      // Check current metadata
      const checkResponse = await fetch("/api/user/debug-metadata");
      const data = await checkResponse.json();

      // If not synced, auto-sync
      if (!data.publicMetadata?.jazzAccountId && me.$jazz?.id) {
        const syncResponse = await fetch("/api/user/sync-metadata-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jazzAccountId: me.$jazz?.id }),
        });

        if (syncResponse.ok) {
          setSyncStatus("synced");
        } else {
          setSyncStatus("error");
        }
      } else if (data.publicMetadata?.jazzAccountId) {
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
      }
    } catch (error) {
      console.error("Error syncing metadata:", error);
      setSyncStatus("error");
    }
  };

  return (
    <div className={styles.container}>
      <SignedOut>
        <div className={styles.center}>
          <p>Please sign in to access settings.</p>
          <Link href="/">Back to home</Link>
        </div>
      </SignedOut>

      <SignedIn>
        <Header />

        <main className={styles.main}>
          <div className={styles.settingsRow}>
            <div className={styles.syncStatus}>
              <span className={styles.syncLabel}>Extension sync:</span>
              <span className={
                syncStatus === "synced" ? styles.statusSynced :
                syncStatus === "error" ? styles.statusError :
                styles.statusLoading
              }>
                {syncStatus === "synced" && "Ready"}
                {syncStatus === "error" && "Error - please refresh"}
                {syncStatus === "loading" && "Syncing..."}
              </span>
              {syncStatus === "error" && (
                <button onClick={syncMetadata} className={styles.retryButton}>
                  Retry
                </button>
              )}
            </div>
            <SignOutButton>
              <button className={styles.logoutButton}>Log out</button>
            </SignOutButton>
          </div>

          <div className={styles.profileWrapper}>
            <UserProfile
              routing="hash"
              appearance={{
                elements: {
                  rootBox: styles.clerkRootBox,
                  card: styles.clerkCard,
                }
              }}
            />
          </div>
        </main>
      </SignedIn>
    </div>
  );
}
