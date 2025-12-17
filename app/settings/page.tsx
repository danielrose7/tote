"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAccount } from "jazz-tools/react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { JazzAccount } from "../../src/schema";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const { userId } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "synced" | "error">("idle");

  // Extension token state
  const [extensionTokenLoading, setExtensionTokenLoading] = useState(false);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [showExtensionToken, setShowExtensionToken] = useState(false);
  const [extensionTokenError, setExtensionTokenError] = useState<string | null>(null);
  const [extensionTokens, setExtensionTokens] = useState<any[]>([]);
  const [extensionTokenCopied, setExtensionTokenCopied] = useState(false);

  const me = useAccount(JazzAccount, {
    resolve: {
      root: true,
    },
  });

  // Auto-check and sync on page load
  useEffect(() => {
    if (me.$jazz?.id) {
      checkAndSyncMetadata();
      // Load extension tokens
      if (me?.root?.apiTokens?.$isLoaded) {
        setExtensionTokens(Array.from(me.root.apiTokens));
      }
    }
  }, [me.$jazz?.id]);

  // Load existing tokens when they're available
  useEffect(() => {
    if (me?.root?.apiTokens) {
      try {
        let tokens: any[] = [];
        if (Array.isArray(me.root.apiTokens)) {
          tokens = me.root.apiTokens;
        } else if (me.root.apiTokens && typeof me.root.apiTokens[Symbol.iterator] === 'function') {
          // It's iterable (co.list)
          tokens = Array.from(me.root.apiTokens);
        } else if (me.root.apiTokens && me.root.apiTokens.$listContents) {
          // Try accessing internal list contents
          tokens = Array.from(me.root.apiTokens.$listContents.values());
        }
        setExtensionTokens(tokens);
      } catch (err) {
        console.log("Could not load tokens:", err);
        setExtensionTokens([]);
      }
    }
  }, [me?.root?.apiTokens]);

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

  const generateSecureToken = (): string => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  };

  const handleGenerateExtensionToken = async () => {
    if (!me?.$jazz?.id || !me?.root?.$isLoaded) {
      setExtensionTokenError("Account not loaded yet. Please wait...");
      return;
    }

    setExtensionTokenLoading(true);
    setExtensionTokenError(null);

    try {
      // Generate secure random token
      const newToken = generateSecureToken();

      // Create ApiToken record in Jazz
      const { ApiToken } = await import("../../src/schema");
      const apiToken = ApiToken.create(
        {
          token: newToken,
          name: "Chrome Extension",
          createdAt: new Date(),
          isActive: true,
        },
        me.$jazz
      );

      // Ensure apiTokens array exists and add the token
      if (!me.root!.apiTokens || !me.root!.apiTokens.$jazz) {
        // If apiTokens doesn't exist, create it and add the token
        const newList = [apiToken];
        me.root!.$jazz.set("apiTokens", newList);
      } else {
        // If apiTokens exists, push to it
        me.root!.apiTokens.$jazz.push(apiToken);
      }

      // Also store the token in Clerk's private metadata for server-side lookups
      try {
        await fetch("/api/user/store-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: newToken,
            tokenId: apiToken.$jazz.id,
            jazzAccountId: me.$jazz.id,
          }),
        });
      } catch (err) {
        console.error("Failed to store token in Clerk:", err);
        // Don't fail the token generation if this fails
      }

      // Store token in localStorage for web app
      if (typeof window !== "undefined") {
        localStorage.setItem("tote_extension_token", newToken);
        localStorage.setItem("tote_extension_generated_at", new Date().toISOString());

        // Try to send token to extension via Chrome Extension messaging
        if ((window as any).chrome?.runtime?.sendMessage) {
          try {
            (window as any).chrome.runtime.sendMessage(
              {
                type: "STORE_TOKEN",
                token: newToken,
              },
              (response: any) => {
                if ((window as any).chrome.runtime.lastError) {
                  console.log("Extension not available or not responding");
                } else {
                  console.log("Token stored in extension:", response);
                }
              }
            );
          } catch (err) {
            console.log("Could not send message to extension:", err);
          }
        }
      }

      setExtensionToken(newToken);
      setShowExtensionToken(true);
      setExtensionTokens([...extensionTokens, apiToken]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate token";
      setExtensionTokenError(message);
      console.error("Token generation error:", err);
    } finally {
      setExtensionTokenLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (extensionToken) {
      await navigator.clipboard.writeText(extensionToken);
      setExtensionTokenCopied(true);
      setTimeout(() => setExtensionTokenCopied(false), 2000);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      if (!me.root?.apiTokens) return;

      // Convert to array if needed
      let tokensArray: any[] = [];
      if (Array.isArray(me.root.apiTokens)) {
        tokensArray = me.root.apiTokens;
      } else if (me.root.apiTokens && typeof me.root.apiTokens[Symbol.iterator] === 'function') {
        tokensArray = Array.from(me.root.apiTokens);
      }

      const tokenIndex = tokensArray.findIndex(
        (t: any) => t.$jazz.id === tokenId
      );

      if (tokenIndex >= 0 && me.root.apiTokens?.$jazz?.splice) {
        me.root.apiTokens.$jazz.splice(tokenIndex, 1);
        setExtensionTokens(
          extensionTokens.filter((t) => t.$jazz.id !== tokenId)
        );
      }
    } catch (err) {
      setExtensionTokenError("Failed to revoke token");
      console.error("Revoke error:", err);
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

          <section className={styles.section}>
            <h2>Chrome Extension Setup</h2>
            <p className={styles.description}>
              Generate API tokens for your Chrome extension to save products directly from any website.
            </p>

            {showExtensionToken && extensionToken ? (
              <div className={styles.tokenDisplay}>
                <div className={styles.tokenBox}>
                  <p className={styles.tokenLabel}>Your API Token:</p>
                  <code className={styles.token}>{extensionToken}</code>
                  <button
                    className={styles.copyButton}
                    onClick={handleCopyToken}
                    disabled={extensionTokenCopied}
                  >
                    {extensionTokenCopied ? "✓ Copied!" : "Copy to Clipboard"}
                  </button>
                </div>
                <div className={styles.warning}>
                  <p>
                    <strong>⚠️ Important:</strong> This token will only be shown once.
                    Copy it now and paste it into your extension settings.
                  </p>
                </div>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowExtensionToken(false)}
                >
                  Generate Another Token
                </button>
              </div>
            ) : (
              <div className={styles.generateSection}>
                <p>
                  Generate a secure API token to use with your Chrome extension. Each
                  token is unique and can be revoked at any time.
                </p>
                <button
                  className={styles.buttonPrimary}
                  onClick={handleGenerateExtensionToken}
                  disabled={extensionTokenLoading || !me?.$jazz?.id || !me?.root?.$isLoaded}
                >
                  {extensionTokenLoading ? "Generating..." : "Generate New Token"}
                </button>
                {extensionTokenError && <p className={styles.error}>{extensionTokenError}</p>}
              </div>
            )}

            {extensionTokens.length > 0 && (
              <div className={styles.tokensSection}>
                <h3>Active Tokens</h3>
                <div className={styles.tokensList}>
                  {extensionTokens.map((t: any) => (
                    <div key={t.$jazz.id} className={styles.tokenItem}>
                      <div className={styles.tokenInfo}>
                        <p className={styles.tokenName}>{t.name}</p>
                        <p className={styles.tokenMeta}>
                          Created {new Date(t.createdAt).toLocaleDateString()}
                          {t.lastUsedAt &&
                            ` • Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        className={styles.revokeButton}
                        onClick={() => handleRevokeToken(t.$jazz.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.instructions}>
              <h3>How to use your token:</h3>
              <ol>
                <li>Generate a token on this page</li>
                <li>Copy the token to your clipboard</li>
                <li>The token is automatically sent to your extension if installed</li>
                <li>Visit any product page and click the Tote extension icon</li>
                <li>Your extension will now authenticate and show your collections</li>
              </ol>
            </div>
          </section>
        </div>
      </SignedIn>
    </div>
  );
}
