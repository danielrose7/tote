import { useState } from "react";
import type { Collection } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./CollectionCard.module.css";

interface CollectionCardProps {
  collection: co.loaded<typeof Collection>;
  onEdit?: (collection: co.loaded<typeof Collection>) => void;
  onDelete?: (collection: co.loaded<typeof Collection>) => void;
  onClick?: (collection: co.loaded<typeof Collection>) => void;
}

export function CollectionCard({
  collection,
  onEdit,
  onDelete,
  onClick,
}: CollectionCardProps) {
  const [showActions, setShowActions] = useState(false);

  const formattedDate = collection.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const linkCount = collection.links?.$isLoaded ? collection.links.length : 0;

  // Get preview images from first few links
  const previewImages = collection.links?.$isLoaded
    ? collection.links
        .slice(0, 4)
        .map((link) => link?.$isLoaded ? link.imageUrl : undefined)
        .filter((url): url is string => !!url)
    : [];

  return (
    <article
      className={styles.card}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => onClick?.(collection)}
      style={
        {
          "--collection-color": collection.color || "var(--color-accent)",
        } as React.CSSProperties
      }
    >
      {/* Preview Grid */}
      <div className={styles.previewContainer}>
        {previewImages.length > 0 ? (
          <div className={`${styles.previewGrid} ${styles[`grid-${Math.min(previewImages.length, 4)}`]}`}>
            {previewImages.map((imageUrl: string, idx: number) => (
              <div key={idx} className={styles.previewImage}>
                <img src={imageUrl} alt="" />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.previewPlaceholder}>
            <svg
              className={styles.placeholderIcon}
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
          </div>
        )}

        {/* Link Count Badge */}
        <div className={styles.countBadge}>
          <span>{linkCount} {linkCount === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      {/* Quick Actions Menu */}
      {showActions && (onEdit || onDelete) && (
        <div className={styles.actionsMenu}>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(collection);
              }}
              className={styles.actionButton}
              aria-label="Edit collection"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(collection);
              }}
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              aria-label="Delete collection"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{collection.name || "Untitled Collection"}</h3>
        </div>

        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}

        <div className={styles.footer}>
          <span className={styles.date} title={collection.createdAt.toLocaleString()}>
            Created {formattedDate}
          </span>
        </div>
      </div>
    </article>
  );
}
