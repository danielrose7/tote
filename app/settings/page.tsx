"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAccount, useAgent, useIsAuthenticated } from "jazz-tools/react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { JazzAccount } from "../../src/schema";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const { userId } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "synced" | "error">("idle");

  const agent = useAgent();
  const isAuthenticated = useIsAuthenticated();
  // Check if guest mode is enabled in JazzReactProvider
  const isGuest = agent.$type$ !== "Account";

  // Anonymous authentication: has an account but not fully authenticated
  const isAnonymous = agent.$type$ === "Account" && !isAuthenticated;
  

  const me = useAccount(JazzAccount, {
    resolve: {
      root: true,
    },
  });

  // Auto-check and sync metadata on page load
  useEffect(() => {
    if (me.$jazz?.id) {
      checkAndSyncMetadata();
    }
  }, [me.$jazz?.id]);

  const checkAndSyncMetadata = async () => {
    setDebugLoading(true);
    setSyncStatus("idle");
    try {
      // First, check current metadata
      const response = await fetch("/api/user/debug-metadata");
      const data = await response.json();
      setDebugInfo(data);
      console.log("Clerk metadata:", data);

      // If not synced, auto-sync
      if (!data.publicMetadata?.jazzAccountId && me.$jazz?.id) {
        console.log("Jazz account not synced, auto-syncing...");
        await syncMetadataNow(data);
      } else if (data.publicMetadata?.jazzAccountId) {
        setSyncStatus("synced");
      }
    } catch (error) {
      setDebugInfo({ error: String(error) });
      setSyncStatus("error");
      console.error("Error checking metadata:", error);
    } finally {
      setDebugLoading(false);
    }
  };

  const syncMetadataNow = async (currentInfo?: any) => {
    setDebugLoading(true);
    try {
      console.log("Syncing metadata with Jazz account ID:", me.$jazz?.id);
      const response = await fetch("/api/user/sync-metadata-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jazzAccountId: me.$jazz?.id }),
      });
      const data = await response.json();
      setDebugInfo(data);
      console.log("Sync result:", data);

      if (response.ok) {
        setSyncStatus("synced");
        console.log("✓ Metadata synced successfully!");
      } else {
        setSyncStatus("error");
      }
    } catch (error) {
      setDebugInfo({ error: String(error) });
      setSyncStatus("error");
      console.error("Error syncing metadata:", error);
    } finally {
      setDebugLoading(false);
    }
  };

  const checkClerkMetadata = async () => {
    setDebugLoading(true);
    try {
      const response = await fetch("/api/user/debug-metadata");
      const data = await response.json();
      setDebugInfo(data);
      console.log("Clerk metadata:", data);

      if (data.publicMetadata?.jazzAccountId) {
        setSyncStatus("synced");
      } else {
        setSyncStatus("idle");
      }
    } catch (error) {
      setDebugInfo({ error: String(error) });
      setSyncStatus("error");
      console.error("Error checking metadata:", error);
    } finally {
      setDebugLoading(false);
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
        <div className={styles.header}>
          <Link href="/" className={styles.backLink}>← Back</Link>
          <h1>Settings</h1>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>Account</h2>
            <div className={styles.accountInfo}>
              <div className={styles.userProfile}>
                <UserButton />
              </div>
              <div>
                <p className={styles.userId}>User ID: <code>{userId}</code></p>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            {isGuest && <span>Guest Mode</span>}
            {isAnonymous && <span>Anonymous Account</span>}
            {isAuthenticated && <span>Authenticated</span>}
          </section>

          <section className={styles.section}>
            <h2>Jazz & Clerk Sync</h2>
            <p className={styles.description}>
              Sync your Jazz account with Clerk to enable server-side link saving from the extension.
            </p>

            <div className={styles.syncInfo}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Jazz Account ID:</span>
                <code className={styles.value}>{me.$jazz?.id || "Loading..."}</code>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.label}>Status:</span>
                <span className={
                  syncStatus === "synced" ? styles.statusSynced :
                  syncStatus === "error" ? styles.statusError :
                  styles.statusIdle
                }>
                  {syncStatus === "synced" ? "✓ Synced" :
                   syncStatus === "error" ? "✕ Error" :
                   debugLoading ? "⏳ Loading..." : "◯ Idle"}
                </span>
              </div>
            </div>

            <div className={styles.buttonGroup}>
              <button
                onClick={syncMetadataNow}
                disabled={debugLoading || !me.$jazz?.id}
                className={styles.buttonPrimary}
              >
                {debugLoading ? "Syncing..." : "Sync Now"}
              </button>

              <button
                onClick={checkClerkMetadata}
                disabled={debugLoading}
                className={styles.buttonSecondary}
              >
                {debugLoading ? "Checking..." : "Check Metadata"}
              </button>
            </div>

            {debugInfo && (
              <div className={styles.debugOutput}>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </section>
        </div>
      </SignedIn>
    </div>
  );
}
