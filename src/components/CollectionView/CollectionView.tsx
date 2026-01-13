import { useState, useEffect } from "react";
import type { Block } from "../../schema.ts";
import type { co } from "jazz-tools";
import { ProductCard } from "../ProductCard/ProductCard";
import { SlotSection } from "../SlotSection/SlotSection";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import { TableView } from "./TableView";
import {
  getSlotsForCollection,
  getProductsForSlot,
  getUngroupedProducts,
  removeFromSelection,
} from "../../lib/slotHelpers";
import styles from "./CollectionView.module.css";

const VIEW_MODE_STORAGE_KEY = "tote:viewMode";

type LoadedBlock = co.loaded<typeof Block>;

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

async function refreshBlockMetadata(
  block: LoadedBlock,
  useExtension: boolean
): Promise<boolean> {
  const productData = block.productData;
  if (!productData) return false;

  try {
    // Try extension first if available, then fall back to server
    let metadata: ExtractedMetadata | null = null;

    if (useExtension) {
      metadata = await refreshViaExtension(productData.url);
    }

    if (!metadata) {
      metadata = await refreshViaServer(productData.url);
    }

    if (!metadata) return false;

    // Update the block with new metadata
    const updatedProductData = { ...productData };
    if (metadata.title) {
      block.$jazz.set("name", metadata.title);
    }
    if (metadata.description) {
      updatedProductData.description = metadata.description;
    }
    if (metadata.imageUrl) {
      updatedProductData.imageUrl = metadata.imageUrl;
    }
    if (metadata.price) {
      updatedProductData.price = metadata.price;
    }
    block.$jazz.set("productData", updatedProductData);

    return true;
  } catch (error) {
    console.error("[Tote] Failed to refresh block:", error);
    return false;
  }
}

interface CollectionViewProps {
  collectionBlock: LoadedBlock;
  allBlocks: LoadedBlock[];  // All blocks to find children by parentId
  onEditBlock?: (block: LoadedBlock) => void;
  onDeleteBlock?: (block: LoadedBlock) => void;
  onEditCollection?: (block: LoadedBlock) => void;
  onShareCollection?: () => void;
}

export function CollectionView({
  collectionBlock,
  allBlocks,
  onEditBlock,
  onDeleteBlock,
  onEditCollection,
  onShareCollection,
}: CollectionViewProps) {
  const [refreshingBlockId, setRefreshingBlockId] = useState<string | null>(null);
  const [enqueuedBlockIds, setEnqueuedBlockIds] = useState<string[]>([]);
  const [refreshAllProgress, setRefreshAllProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Load view mode preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "grid" || stored === "table") {
      setViewMode(stored);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  // Check if extension is available on mount
  useEffect(() => {
    checkExtensionAvailable().then(setExtensionAvailable);
  }, []);

  const handleRefreshBlock = async (block: LoadedBlock) => {
    setRefreshingBlockId(block.$jazz.id);
    await refreshBlockMetadata(block, extensionAvailable);
    setRefreshingBlockId(null);
  };

  const handleRefreshAll = async (blocks: LoadedBlock[]) => {
    const validBlocks = blocks.filter((b) => b && b.$isLoaded && b.type === "product");

    // Set all blocks as enqueued first
    const allIds = validBlocks.map((b) => b.$jazz.id);
    setEnqueuedBlockIds(allIds);
    setRefreshAllProgress({ current: 0, total: validBlocks.length });

    for (let i = 0; i < validBlocks.length; i++) {
      const block = validBlocks[i];
      const blockId = block.$jazz.id;

      // Move from enqueued to refreshing
      setEnqueuedBlockIds((prev) => prev.filter((id) => id !== blockId));
      setRefreshingBlockId(blockId);

      await refreshBlockMetadata(block, extensionAvailable);
      setRefreshAllProgress({ current: i + 1, total: validBlocks.length });
    }

    setRefreshingBlockId(null);
    setEnqueuedBlockIds([]);
    setRefreshAllProgress(null);
  };

  const collectionData = collectionBlock.collectionData;
  const collectionId = collectionBlock.$jazz.id;

  // Get children from the collection's children list (new pattern)
  // Fall back to parentId-based lookup for old data
  const childrenFromList: LoadedBlock[] = [];
  if (collectionBlock.children?.$isLoaded) {
    for (const child of collectionBlock.children) {
      if (child && child.$isLoaded) {
        childrenFromList.push(child);
      }
    }
  }

  // Get slots - from children list or fallback to parentId
  const slots = childrenFromList.length > 0
    ? childrenFromList.filter((b) => b.type === "slot")
    : getSlotsForCollection(allBlocks, collectionId);

  // Get ungrouped products - from children list or fallback to parentId
  const ungroupedProducts = childrenFromList.length > 0
    ? childrenFromList.filter((b) => b.type === "product")
    : getUngroupedProducts(allBlocks, collectionId);

  // Get all products (for total count and refresh all)
  const allProducts: LoadedBlock[] = [...ungroupedProducts];
  for (const slot of slots) {
    // Get products from slot's children list or fallback to parentId
    const slotProducts: LoadedBlock[] = [];
    if (slot.children?.$isLoaded) {
      for (const child of slot.children) {
        if (child && child.$isLoaded && child.type === "product") {
          slotProducts.push(child);
        }
      }
    } else {
      slotProducts.push(...getProductsForSlot(allBlocks, slot.$jazz.id));
    }
    allProducts.push(...slotProducts);
  }

  // Handle slot deletion - moves products back to collection
  const handleDeleteSlot = (slot: LoadedBlock) => {
    const slotProducts = getProductsForSlot(allBlocks, slot.$jazz.id);

    // Move all products to the collection
    for (const product of slotProducts) {
      // Remove from slot's selection if selected
      removeFromSelection(product.$jazz.id, slot);
      // Move to collection
      product.$jazz.set("parentId", collectionId);
    }

    // Find and remove the slot from the blocks list
    // Note: In Jazz, we'd typically soft-delete or just orphan it
    // For now, we'll just set parentId to undefined to "remove" it
    slot.$jazz.set("parentId", undefined);
  };

  return (
    <div className={styles.container}>
      {/* Collection Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            {collectionData?.color && (
              <div
                className={styles.colorIndicator}
                style={{ backgroundColor: collectionData.color }}
              />
            )}
            <h1 className={styles.title}>{collectionBlock.name}</h1>
            {onShareCollection && (
              <button
                type="button"
                onClick={onShareCollection}
                className={styles.settingsButton}
                aria-label="Share collection"
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
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            )}
            {onEditCollection && (
              <button
                type="button"
                onClick={() => onEditCollection(collectionBlock)}
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
          {collectionData?.description && (
            <p className={styles.description}>{collectionData.description}</p>
          )}
          <div className={styles.meta}>
            <span className={styles.count}>
              {allProducts.length} {allProducts.length === 1 ? 'item' : 'items'}
              {slots.length > 0 && ` in ${slots.length} ${slots.length === 1 ? 'slot' : 'slots'}`}
            </span>
            <span className={styles.date}>
              Created {collectionBlock.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {allProducts.length > 0 && (
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => handleRefreshAll(allProducts)}
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
              <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      {allProducts.length === 0 && slots.length === 0 ? (
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
          <h2 className={styles.emptyTitle}>No items in this collection</h2>
          <p className={styles.emptyDescription}>
            Add items to this collection to get started
          </p>
        </div>
      ) : viewMode === "table" ? (
        <TableView
          blocks={allProducts}
          allBlocks={allBlocks}
          onEdit={onEditBlock}
          onDelete={onDeleteBlock}
          onRefresh={handleRefreshBlock}
          refreshingBlockId={refreshingBlockId}
          enqueuedBlockIds={enqueuedBlockIds}
        />
      ) : (
        <>
          {/* Slots */}
          {slots.map((slot) => {
            // Get products from slot's children list or fallback to parentId
            const slotProducts: LoadedBlock[] = [];
            if (slot.children?.$isLoaded) {
              for (const child of slot.children) {
                if (child && child.$isLoaded && child.type === "product") {
                  slotProducts.push(child);
                }
              }
            } else {
              slotProducts.push(...getProductsForSlot(allBlocks, slot.$jazz.id));
            }
            return (
              <SlotSection
                key={slot.$jazz.id}
                slotBlock={slot}
                products={slotProducts}
                onEditProduct={onEditBlock}
                onDeleteProduct={onDeleteBlock}
                onRefreshProduct={handleRefreshBlock}
                onDeleteSlot={handleDeleteSlot}
                refreshingBlockId={refreshingBlockId}
                enqueuedBlockIds={enqueuedBlockIds}
              />
            );
          })}

          {/* Ungrouped Products */}
          {ungroupedProducts.length > 0 && (
            <div className={styles.ungroupedSection}>
              {slots.length > 0 && (
                <h3 className={styles.ungroupedTitle}>Ungrouped</h3>
              )}
              <div className={styles.grid}>
                {ungroupedProducts.map((block) => {
                  const blockId = block.$jazz.id;
                  return (
                    <ProductCard
                      key={blockId}
                      block={block}
                      onEdit={onEditBlock}
                      onDelete={onDeleteBlock}
                      onRefresh={handleRefreshBlock}
                      isRefreshing={refreshingBlockId === blockId}
                      isEnqueued={enqueuedBlockIds.includes(blockId)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
