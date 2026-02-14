import { useState } from "react";
import type { Block } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./ProductCard.module.css";

type LoadedBlock = co.loaded<typeof Block>;

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return `$${num.toFixed(2)}`;
}

interface ProductCardProps {
  block: LoadedBlock;
  onEdit?: (block: LoadedBlock) => void;
  onDelete?: (block: LoadedBlock) => void;
  onRefresh?: (block: LoadedBlock) => void;
  isRefreshing?: boolean;
  isEnqueued?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export function ProductCard({
  block,
  onEdit,
  onDelete,
  onRefresh,
  isRefreshing = false,
  isEnqueued = false,
  isSelected = false,
  onToggleSelection,
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const productData = block.productData;
  if (!productData) return null;

  const formattedDate = block.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const hasImage = productData.imageUrl && !imageError;

  const cardClassName = [
    styles.card,
    isRefreshing && styles.cardRefreshing,
    isEnqueued && styles.cardEnqueued,
    isSelected && styles.cardSelected,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cardClassName}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Refresh Status Badge */}
      {(isRefreshing || isEnqueued) && (
        <div className={styles.refreshBadge}>
          {isRefreshing ? (
            <>
              <svg
                className={styles.spinningIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refreshing</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <polyline points="12 6 12 12 16 14" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <span>Queued</span>
            </>
          )}
        </div>
      )}
      {/* Image Section */}
      {hasImage ? (
        <div className={styles.imageContainer}>
          {!imageLoaded && <div className={styles.imageSkeleton} />}
          <img
            src={productData.imageUrl}
            alt={block.name || "Product"}
            className={`${styles.image} ${imageLoaded ? styles.imageLoaded : ""}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {productData.price && (
            <div className={styles.priceOverlay}>
              <span className={styles.priceTag}>{formatPrice(productData.price)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.imagePlaceholder}>
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
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {productData.price && (
            <div className={styles.priceOverlay}>
              <span className={styles.priceTag}>{formatPrice(productData.price)}</span>
            </div>
          )}
        </div>
      )}

      {/* Selection Badge */}
      {isSelected && (
        <div className={styles.selectionBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Quick Actions Menu */}
      {showActions && (onEdit || onDelete || onRefresh || onToggleSelection) && (
        <div className={styles.actionsMenu}>
          {onToggleSelection && (
            <button
              type="button"
              onClick={onToggleSelection}
              className={`${styles.actionButton} ${isSelected ? styles.actionButtonSelected : ""}`}
              aria-label={isSelected ? "Deselect product" : "Select product"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh(block)}
              className={`${styles.actionButton} ${isRefreshing ? styles.actionButtonSpinning : ""}`}
              aria-label="Refresh metadata"
              disabled={isRefreshing || isEnqueued}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(block)}
              className={styles.actionButton}
              aria-label="Edit product"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(block)}
              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
              aria-label="Delete product"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{block.name || "Untitled"}</h3>
        </div>

        {productData.description && (
          <p className={styles.description}>{productData.description}</p>
        )}

        <div className={styles.footer}>
          <a
            href={productData.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            onClick={(e) => e.stopPropagation()}
          >
            Visit →
          </a>
          <span className={styles.date} title={block.createdAt.toLocaleString()}>
            {formattedDate}
          </span>
        </div>
      </div>
    </article>
  );
}
