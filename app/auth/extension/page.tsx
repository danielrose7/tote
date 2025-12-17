"use client";

import { useAuth } from "@clerk/nextjs";
import { useAccount } from "jazz-tools/react";
import { useState, useEffect } from "react";
import { JazzAccount } from "../../../src/schema";
import styles from "./extension-auth.module.css";

export default function ExtensionAuthPage() {
  const { isSignedIn, userId } = useAuth();
  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        apiTokens: { $each: {} },
      },
    },
  });

  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  // Load existing tokens
  useEffect(() => {
    if (me?.root?.apiTokens?.$isLoaded) {
      setTokens(Array.from(me.root.apiTokens));
    }
  }, [me?.root?.apiTokens]);

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Chrome Extension Setup</h1>
          <p>Please sign in to your Tote account to generate an extension token.</p>
          <p className={styles.hint}>
            Use the sign-in button in the top right corner of this page.
          </p>
        </div>
      </div>
    );
  }

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

  const handleGenerateToken = async () => {
    if (!me?.root?.$isLoaded) {
      setError("Account not loaded yet. Please wait...");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate secure random token
      const newToken = generateSecureToken();

      // Create ApiToken record in Jazz
      const { ApiToken } = await import("../../../src/schema");
      const apiToken = ApiToken.create(
        {
          token: newToken,
          name: "Chrome Extension",
          createdAt: new Date(),
          isActive: true,
        },
        me.$jazz
      );

      // Add to user's apiTokens list
      if (!me.root!.apiTokens) {
        me.root!.apiTokens = [];
      }
      me.root!.apiTokens!.$jazz.push(apiToken);

      // Store token in localStorage for web app
      if (typeof window !== "undefined") {
        localStorage.setItem("tote_extension_token", newToken);
        localStorage.setItem("tote_extension_generated_at", new Date().toISOString());

        // Try to send token to extension via Chrome Extension messaging
        // This will work if the extension is installed and has proper permissions
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

      setToken(newToken);
      setShowToken(true);
      setTokens([...tokens, apiToken]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate token";
      setError(message);
      console.error("Token generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    try {
      if (!me.root?.apiTokens) return;

      const tokenIndex = Array.from(me.root.apiTokens).findIndex(
        (t: any) => t.$jazz.id === tokenId
      );

      if (tokenIndex >= 0) {
        me.root.apiTokens!.$jazz.splice(tokenIndex, 1);
        setTokens(tokens.filter((t) => t.$jazz.id !== tokenId));
      }
    } catch (err) {
      setError("Failed to revoke token");
      console.error("Revoke error:", err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Chrome Extension Setup</h1>
          <p className={styles.subtitle}>Generate API tokens for your extension</p>
        </div>

        {showToken && token ? (
          <div className={styles.tokenDisplay}>
            <div className={styles.tokenBox}>
              <p className={styles.tokenLabel}>Your API Token:</p>
              <code className={styles.token}>{token}</code>
              <button
                className={styles.copyButton}
                onClick={handleCopyToken}
                disabled={copied}
              >
                {copied ? "✓ Copied!" : "Copy to Clipboard"}
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
              onClick={() => setShowToken(false)}
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
              className={styles.primaryButton}
              onClick={handleGenerateToken}
              disabled={loading || !me?.root?.$isLoaded}
            >
              {loading ? "Generating..." : "Generate New Token"}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

        {tokens.length > 0 && (
          <div className={styles.tokensSection}>
            <h2>Active Tokens</h2>
            <div className={styles.tokensList}>
              {tokens.map((t: any) => (
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
            <li>Open your Chrome extension settings</li>
            <li>Paste the token into the token input field</li>
            <li>Your extension is now authenticated!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
