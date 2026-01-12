"use client";

import { useParams } from "next/navigation";
import { JazzReactProvider, useCoState } from "jazz-tools/react";
import { Block } from "../../../schema";
import { apiKey } from "../../../apiKey";
import styles from "./page.module.css";

/**
 * Public view page wrapper.
 * Creates its own guest mode Jazz context independent of the main app.
 */
export default function PublicViewPage() {
  return (
    <JazzReactProvider
      guestMode
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
      }}
    >
      <PublicViewContent />
    </JazzReactProvider>
  );
}

/**
 * Inner content component that uses the guest mode Jazz context.
 */
function PublicViewContent() {
  const params = useParams();
  const collectionId = params.id as string;

  // Load the published collection in guest mode
  const collection = useCoState(Block, collectionId as `co_z${string}`, {});

  // Show loading state while collection is loading or not yet fully available
  // We need to wait for both the collection AND its collectionData to be present
  // before we can determine if it's a valid published collection
  const isLoading = !collection || !collection.$isLoaded || collection.type === undefined;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading collection...</p>
        </div>
      </div>
    );
  }

  // Now we know the collection is loaded, check if it's actually a collection
  if (collection.type !== "collection") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Not Found</h1>
          <p className={styles.description}>This is not a valid collection.</p>
        </div>
      </div>
    );
  }

  // Check if this is a published collection (has sourceId pointing to a draft)
  const isPublishedCollection = !!collection.collectionData?.sourceId;
  if (!isPublishedCollection) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Private Collection</h1>
          <p className={styles.description}>
            This collection is not publicly viewable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            {collection.collectionData?.color && (
              <div
                className={styles.colorIndicator}
                style={{ backgroundColor: collection.collectionData.color }}
              />
            )}
            <h1 className={styles.pageTitle}>{collection.name}</h1>
          </div>
          {collection.collectionData?.description && (
            <p className={styles.pageDescription}>
              {collection.collectionData.description}
            </p>
          )}
        </div>
      </header>

      {/* Content - Load child blocks */}
      <main className={styles.main}>
        <ChildBlocksLoader childBlockIds={collection.collectionData?.childBlockIds || []} />
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          Powered by <a href="/" className={styles.footerLink}>Tote</a>
        </p>
      </footer>
    </div>
  );
}

/**
 * Component to load and display child blocks using the stored childBlockIds.
 */
function ChildBlocksLoader({ childBlockIds }: { childBlockIds: string[] }) {
  if (childBlockIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>This collection is empty.</p>
      </div>
    );
  }

  // Separate slots from products (we'll need to organize them)
  return (
    <div className={styles.productGrid}>
      {childBlockIds.map((blockId) => (
        <ChildBlockRenderer key={blockId} blockId={blockId} />
      ))}
    </div>
  );
}

/**
 * Renders a single child block (product or slot).
 */
function ChildBlockRenderer({ blockId }: { blockId: string }) {
  const block = useCoState(Block, blockId as `co_z${string}`, {});

  if (!block) {
    return <div className={styles.productCard}>Loading...</div>;
  }

  // Only render products for now (slots would need their own handling)
  if (block.type !== "product") {
    return null;
  }

  const productData = block.productData;

  return (
    <a
      href={productData?.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.productCard}
    >
      {productData?.imageUrl && (
        <div className={styles.productImage}>
          <img src={productData.imageUrl} alt={block.name} />
        </div>
      )}
      <div className={styles.productInfo}>
        <h3 className={styles.productName}>{block.name}</h3>
        {productData?.price && (
          <p className={styles.productPrice}>{productData.price}</p>
        )}
        {productData?.description && (
          <p className={styles.productDescription}>{productData.description}</p>
        )}
      </div>
    </a>
  );
}
