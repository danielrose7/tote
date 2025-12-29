import type { Block, JazzAccount } from "../../schema.ts";
import type { co } from "jazz-tools";
import { CollectionCard } from "../CollectionCard/CollectionCard";
import styles from "./CollectionList.module.css";

type LoadedBlock = co.loaded<typeof Block>;

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

  return (
    <div className={styles.container}>
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
    </div>
  );
}
