import type { Collection, JazzAccount } from "../../schema.ts";
import type { co } from "jazz-tools";
import { CollectionCard } from "../CollectionCard/CollectionCard";
import styles from "./CollectionList.module.css";

interface CollectionListProps {
  account: co.loaded<typeof JazzAccount>;
  onEditCollection?: (collection: co.loaded<typeof Collection>) => void;
  onDeleteCollection?: (collection: co.loaded<typeof Collection>) => void;
  onSelectCollection?: (collection: co.loaded<typeof Collection>) => void;
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

  const collections = account.root.collections;

  if (!collections.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (collections.length === 0) {
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

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {collections.map((collection) => {
          if (!collection || !collection.$isLoaded) return null;
          return (
            <CollectionCard
              key={collection.$jazz.id}
              collection={collection}
              onEdit={onEditCollection}
              onDelete={onDeleteCollection}
              onClick={onSelectCollection}
            />
          );
        })}
      </div>
    </div>
  );
}
