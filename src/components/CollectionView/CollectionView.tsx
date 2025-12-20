import { useState, useEffect } from "react";
import type { Collection, JazzAccount, ProductLink } from "../../schema.ts";
import type { co } from "jazz-tools";
import { ProductCard } from "../ProductCard/ProductCard";
import styles from "./CollectionView.module.css";

interface ExtractedMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
}

// Extension ID - set via env var or hardcode after publishing
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

// Check if the Tote extension is available
async function checkExtensionAvailable(): Promise<boolean> {
  if (!EXTENSION_ID || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return false;
  }

  try {
    const response = await new Promise<{ success: boolean } | undefined>((resolve) => {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: "PING" }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
        } else {
          resolve(resp);
        }
      });
    });
    return response?.success === true;
  } catch {
    return false;
  }
}

// Refresh using the extension (opens page in background tab, extracts with full DOM)
async function refreshViaExtension(url: string): Promise<ExtractedMetadata | null> {
  if (!EXTENSION_ID) return null;

  try {
    const response = await new Promise<{ success: boolean; metadata?: ExtractedMetadata; error?: string }>((resolve) => {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "REFRESH_LINK", url },
        (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp);
          }
        }
      );
    });

    if (response.success && response.metadata) {
      return response.metadata;
    }
    console.warn("[Tote] Extension refresh failed:", response.error);
    return null;
  } catch (error) {
    console.error("[Tote] Extension communication error:", error);
    return null;
  }
}

// Fallback: server-side extraction
async function refreshViaServer(url: string): Promise<ExtractedMetadata | null> {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function refreshLinkMetadata(
  link: co.loaded<typeof ProductLink>,
  useExtension: boolean
): Promise<boolean> {
  try {
    // Try extension first if available, then fall back to server
    let metadata: ExtractedMetadata | null = null;

    if (useExtension) {
      metadata = await refreshViaExtension(link.url);
    }

    if (!metadata) {
      metadata = await refreshViaServer(link.url);
    }

    if (!metadata) return false;

    // Update the link with new metadata
    if (metadata.title) link.$jazz.set("title", metadata.title);
    if (metadata.description) link.$jazz.set("description", metadata.description);
    if (metadata.imageUrl) link.$jazz.set("imageUrl", metadata.imageUrl);
    if (metadata.price) link.$jazz.set("price", metadata.price);

    return true;
  } catch (error) {
    console.error("[Tote] Failed to refresh link:", error);
    return false;
  }
}

interface CollectionViewProps {
  account: co.loaded<typeof JazzAccount>;
  collectionId: string;
  onEditLink?: (link: co.loaded<typeof ProductLink>) => void;
  onDeleteLink?: (link: co.loaded<typeof ProductLink>) => void;
  onEditCollection?: (collection: co.loaded<typeof Collection>) => void;
  onBackToCollections?: () => void;
}

export function CollectionView({
  account,
  collectionId,
  onEditLink,
  onDeleteLink,
  onEditCollection,
  onBackToCollections,
}: CollectionViewProps) {
  const [refreshingLinkId, setRefreshingLinkId] = useState<string | null>(null);
  const [refreshAllProgress, setRefreshAllProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);

  // Check if extension is available on mount
  useEffect(() => {
    checkExtensionAvailable().then(setExtensionAvailable);
  }, []);

  const handleRefreshLink = async (link: co.loaded<typeof ProductLink>) => {
    setRefreshingLinkId(link.$jazz.id);
    await refreshLinkMetadata(link, extensionAvailable);
    setRefreshingLinkId(null);
  };

  const handleRefreshAll = async (links: co.loaded<typeof ProductLink>[]) => {
    const validLinks = links.filter((l) => l && l.$isLoaded);
    setRefreshAllProgress({ current: 0, total: validLinks.length });

    for (let i = 0; i < validLinks.length; i++) {
      const link = validLinks[i];
      setRefreshingLinkId(link.$jazz.id);
      await refreshLinkMetadata(link, extensionAvailable);
      setRefreshAllProgress({ current: i + 1, total: validLinks.length });
    }

    setRefreshingLinkId(null);
    setRefreshAllProgress(null);
  };

  if (!account.root || !account.root.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const collections = account.root.collections;

  if (!collections.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  // Find the collection by ID
  const collection = collections.find(
    (c) => c && c.$isLoaded && c.$jazz.id === collectionId
  ) as co.loaded<typeof Collection> | undefined;

  if (!collection) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Collection not found</h2>
          <p>This collection may have been deleted or does not exist.</p>
          {onBackToCollections && (
            <button
              type="button"
              onClick={onBackToCollections}
              className={styles.backButton}
            >
              ← Back to Collections
            </button>
          )}
        </div>
      </div>
    );
  }

  const links = collection.links;

  if (!links.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading links...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Collection Header */}
      <div className={styles.header}>
        {onBackToCollections && (
          <button
            type="button"
            onClick={onBackToCollections}
            className={styles.backButton}
          >
            ← Back to Collections
          </button>
        )}
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            {collection.color && (
              <div
                className={styles.colorIndicator}
                style={{ backgroundColor: collection.color }}
              />
            )}
            <h1 className={styles.title}>{collection.name}</h1>
            {onEditCollection && (
              <button
                type="button"
                onClick={() => onEditCollection(collection)}
                className={styles.settingsButton}
                aria-label="Edit collection"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          {collection.description && (
            <p className={styles.description}>{collection.description}</p>
          )}
          <div className={styles.meta}>
            <span className={styles.count}>
              {links.length} {links.length === 1 ? 'item' : 'items'}
            </span>
            <span className={styles.date}>
              Created {collection.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {links.length > 0 && (
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => handleRefreshAll(links as co.loaded<typeof ProductLink>[])}
                className={styles.refreshAllButton}
                disabled={refreshAllProgress !== null}
              >
                {refreshAllProgress ? (
                  <>
                    <svg className={styles.spinningIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refreshing {refreshAllProgress.current}/{refreshAllProgress.total}
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh All
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Links Grid */}
      {links.length === 0 ? (
        <div className={styles.empty}>
          <svg
            className={styles.emptyIcon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h2 className={styles.emptyTitle}>No links in this collection</h2>
          <p className={styles.emptyDescription}>
            Add links to this collection to get started
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {links.map((link) => {
            if (!link || !link.$isLoaded) return null;
            const isRefreshing = refreshingLinkId === link.$jazz.id;
            return (
              <ProductCard
                key={link.$jazz.id}
                link={link}
                onEdit={onEditLink}
                onDelete={onDeleteLink}
                onRefresh={handleRefreshLink}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
