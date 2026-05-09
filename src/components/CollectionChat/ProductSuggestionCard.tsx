'use client';

import { useState } from 'react';
import styles from './ProductSuggestionCard.module.css';

export interface SuggestedProduct {
  title: string | null;
  url: string;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  brand: string | null;
  description: string | null;
}

interface ProductSuggestionCardProps {
  product: SuggestedProduct;
  onAdd?: () => void; // undefined = no collection to add to
}

export function ProductSuggestionCard({
  product,
  onAdd,
}: ProductSuggestionCardProps) {
  const [added, setAdded] = useState(false);

  function handleAdd() {
    onAdd?.();
    setAdded(true);
  }

  const displayPrice =
    product.price && product.currency
      ? `${product.currency} ${product.price}`
      : (product.price ?? null);

  return (
    <div className={styles.card}>
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title ?? ''}
          className={styles.image}
          loading="lazy"
        />
      )}
      <div className={styles.body}>
        <p className={styles.title}>{product.title ?? 'Untitled product'}</p>
        <div className={styles.meta}>
          {product.brand && (
            <span className={styles.brand}>{product.brand}</span>
          )}
          {displayPrice && <span className={styles.price}>{displayPrice}</span>}
        </div>
        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}
        <div className={styles.actions}>
          {onAdd !== undefined && (
            <button
              type="button"
              className={styles.addButton}
              onClick={handleAdd}
              disabled={added}
            >
              {added ? '✓ Added' : 'Add to Tote'}
            </button>
          )}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.visitLink}
          >
            Visit ↗
          </a>
        </div>
      </div>
    </div>
  );
}
