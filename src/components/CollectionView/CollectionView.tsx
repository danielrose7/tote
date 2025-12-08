import type { Collection, JazzAccount, ProductLink } from "../../schema.ts";
import type { co } from "jazz-tools";
import { ProductCard } from "../ProductCard/ProductCard";
import styles from "./CollectionView.module.css";

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
            return (
              <ProductCard
                key={link.$jazz.id}
                link={link}
                onEdit={onEditLink}
                onDelete={onDeleteLink}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
