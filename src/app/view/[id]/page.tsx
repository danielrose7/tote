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

  // Load the published collection in guest mode (with children)
  const collection = useCoState(Block, collectionId as `co_z${string}`, {
    resolve: {
      children: {
        $each: {
          children: { $each: {} }, // For slots containing products
        },
      },
    },
  });

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

      {/* Content - Load child blocks (using children list or fallback to childBlockIds) */}
      <main className={styles.main}>
        <ChildBlocksLoader
          collection={collection}
          childBlockIds={collection.collectionData?.childBlockIds || []}
        />
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
 * Component to load and display child blocks.
 * Uses collection.children list (new pattern) with fallback to childBlockIds (legacy).
 */
function ChildBlocksLoader({
  collection,
  childBlockIds,
}: {
  collection: React.ComponentProps<typeof Block> & { children?: { $isLoaded?: boolean } & Iterable<any> };
  childBlockIds: string[];
}) {
  // Get children from the collection's children list (new pattern)
  const childrenFromList: any[] = [];
  if (collection.children?.$isLoaded) {
    for (const child of collection.children) {
      if (child && child.$isLoaded) {
        childrenFromList.push(child);
      }
    }
  }

  // Use children list if available, otherwise fall back to childBlockIds
  const hasChildrenList = childrenFromList.length > 0;

  if (!hasChildrenList && childBlockIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>This collection is empty.</p>
      </div>
    );
  }

  // Render from children list (new pattern)
  if (hasChildrenList) {
    // Separate slots from products
    const slots = childrenFromList.filter((b) => b.type === "slot");
    const products = childrenFromList.filter((b) => b.type === "product");

    return (
      <>
        {/* Slots with their products */}
        {slots.map((slot) => (
          <SlotRenderer key={slot.$jazz.id} slot={slot} />
        ))}

        {/* Ungrouped products */}
        {products.length > 0 && (
          <div className={styles.productGrid}>
            {products.map((block) => (
              <ProductRenderer key={block.$jazz.id} block={block} />
            ))}
          </div>
        )}
      </>
    );
  }

  // Fallback: render from childBlockIds (legacy pattern)
  return (
    <div className={styles.productGrid}>
      {childBlockIds.map((blockId) => (
        <ChildBlockRenderer key={blockId} blockId={blockId} />
      ))}
    </div>
  );
}

/**
 * Renders a slot section with its products (from children list).
 */
function SlotRenderer({ slot }: { slot: any }) {
  // Get products from slot's children list
  const products: any[] = [];
  if (slot.children?.$isLoaded) {
    for (const child of slot.children) {
      if (child && child.$isLoaded && child.type === "product") {
        products.push(child);
      }
    }
  }

  if (products.length === 0) {
    return null; // Don't render empty slots in public view
  }

  return (
    <div className={styles.slotSection}>
      <h3 className={styles.slotTitle}>{slot.name || "Unnamed slot"}</h3>
      <div className={styles.productGrid}>
        {products.map((block) => (
          <ProductRenderer key={block.$jazz.id} block={block} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a product block (from children list - already loaded).
 */
function ProductRenderer({ block }: { block: any }) {
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

/**
 * Renders a single child block by ID (legacy pattern - loads block by ID).
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
