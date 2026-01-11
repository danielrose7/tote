import { useCoState } from "jazz-tools/react";
import type { Block, JazzAccount, SharedCollectionRef } from "../../schema.ts";
import { Block as BlockSchema } from "../../schema.ts";
import type { co } from "jazz-tools";
import { CollectionCard } from "../CollectionCard/CollectionCard";
import styles from "./CollectionList.module.css";

type LoadedBlock = co.loaded<typeof Block>;
type LoadedSharedRef = co.loaded<typeof SharedCollectionRef>;

interface CollectionListProps {
  account: co.loaded<typeof JazzAccount>;
  onEditCollection?: (block: LoadedBlock) => void;
  onDeleteCollection?: (block: LoadedBlock) => void;
  onSelectCollection?: (block: LoadedBlock) => void;
}

export function CollectionList({
  account,
  onEditCollection,
  onDeleteCollection,
  onSelectCollection,
}: CollectionListProps) {
  if (!account.root || !account.root.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const blocks = account.root.blocks;

  if (!blocks || !blocks.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  // Filter to only top-level collection blocks (no parentId)
  const collectionBlocks: LoadedBlock[] = [];
  for (const block of blocks) {
    if (block && block.$isLoaded && block.type === "collection" && !block.parentId) {
      collectionBlocks.push(block);
    }
  }

  if (collectionBlocks.length === 0) {
    return (
      <div className={styles.container}>
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h2 className={styles.emptyTitle}>No collections yet</h2>
          <p className={styles.emptyDescription}>
            Create a collection to organize your product links
          </p>
        </div>
      </div>
    );
  }

  // Get all loaded blocks for child lookup
  const allBlocks: LoadedBlock[] = [];
  for (const block of blocks) {
    if (block && block.$isLoaded) {
      allBlocks.push(block);
    }
  }

  // Get shared collection references
  const sharedRefs: LoadedSharedRef[] = [];
  if (account.root.sharedWithMe?.$isLoaded) {
    for (const ref of account.root.sharedWithMe) {
      if (ref && ref.$isLoaded) {
        sharedRefs.push(ref);
      }
    }
  }

  return (
    <div className={styles.container}>
      {/* My Collections */}
      <div className={styles.grid}>
        {collectionBlocks.map((block) => (
          <CollectionCard
            key={block.$jazz.id}
            block={block}
            allBlocks={allBlocks}
            onEdit={onEditCollection}
            onDelete={onDeleteCollection}
            onClick={onSelectCollection}
          />
        ))}
      </div>

      {/* Shared With Me */}
      {sharedRefs.length > 0 && (
        <div className={styles.sharedSection}>
          <h2 className={styles.sectionTitle}>Shared with me</h2>
          <div className={styles.grid}>
            {sharedRefs.map((ref) => (
              <SharedCollectionCard
                key={ref.collectionId}
                collectionId={ref.collectionId}
                sharedRef={ref}
                onClick={onSelectCollection}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Card component that loads a shared collection by ID */
function SharedCollectionCard({
  collectionId,
  sharedRef,
  onClick,
}: {
  collectionId: string;
  sharedRef: LoadedSharedRef;
  onClick?: (block: LoadedBlock) => void;
}) {
  const collection = useCoState(BlockSchema, collectionId as `co_z${string}`, {});

  if (!collection || collection.type !== "collection") {
    return (
      <div className={styles.sharedCard}>
        <div className={styles.sharedCardLoading}>
          {sharedRef.name || "Loading..."}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.sharedCard}
      onClick={() => onClick?.(collection)}
    >
      <div
        className={styles.sharedCardColor}
        style={{ backgroundColor: collection.collectionData?.color || "#6366f1" }}
      />
      <div className={styles.sharedCardContent}>
        <h3 className={styles.sharedCardTitle}>{collection.name}</h3>
        {collection.collectionData?.description && (
          <p className={styles.sharedCardDescription}>
            {collection.collectionData.description}
          </p>
        )}
        <span className={styles.sharedBadge}>Shared</span>
      </div>
    </button>
  );
}
