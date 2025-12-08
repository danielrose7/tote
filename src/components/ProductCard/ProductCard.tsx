import { useState } from "react";
import type { ProductLink } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  link: co.loaded<typeof ProductLink>;
  onEdit?: (link: co.loaded<typeof ProductLink>) => void;
  onDelete?: (link: co.loaded<typeof ProductLink>) => void;
}

export function ProductCard({ link, onEdit, onDelete }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const formattedDate = link.addedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const hasImage = link.imageUrl && !imageError;

  return (
    <article
      className={styles.card}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image Section */}
      {hasImage ? (
        <div className={styles.imageContainer}>
          {!imageLoaded && <div className={styles.imageSkeleton} />}
          <img
            src={link.imageUrl}
            alt={link.title || "Product"}
            className={`${styles.image} ${imageLoaded ? styles.imageLoaded : ""}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {link.price && (
            <div className={styles.priceOverlay}>
              <span className={styles.priceTag}>{link.price}</span>
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
          {link.price && (
            <div className={styles.priceOverlay}>
              <span className={styles.priceTag}>{link.price}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions Menu */}
      {showActions && (onEdit || onDelete) && (
        <div className={styles.actionsMenu}>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(link)}
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
              onClick={() => onDelete(link)}
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
          <h3 className={styles.title}>{link.title || "Untitled"}</h3>
          {link.tags && link.tags.length > 0 && (
            <div className={styles.tags}>
              {link.tags.slice(0, 2).map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
              {link.tags.length > 2 && (
                <span className={styles.tag}>+{link.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {link.description && (
          <p className={styles.description}>{link.description}</p>
        )}

        <div className={styles.footer}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            onClick={(e) => e.stopPropagation()}
          >
            Visit →
          </a>
          <span className={styles.date} title={link.addedAt.toLocaleString()}>
            {formattedDate}
          </span>
        </div>
      </div>
    </article>
  );
}
