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

export interface SuggestedCollection {
  type: 'collection';
  title: string | null;
  url: string;
  products: SuggestedProduct[];
}

interface ProductSuggestionCardProps {
  product: SuggestedProduct;
  onAdd?: () => void; // undefined = no collection to add to
}

interface CollectionSuggestionCardProps {
  collection: SuggestedCollection;
  onAddProduct?: (product: SuggestedProduct) => void;
}

function formatPrice(product: SuggestedProduct): string | null {
  return product.price && product.currency
    ? `${product.currency} ${product.price}`
    : (product.price ?? null);
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

  const displayPrice = formatPrice(product);

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

function CollectionProductRow({
  product,
  onAdd,
}: {
  product: SuggestedProduct;
  onAdd?: () => void;
}) {
  const [added, setAdded] = useState(false);
  const displayPrice = formatPrice(product);

  function handleAdd() {
    onAdd?.();
    setAdded(true);
  }

  return (
    <div className={styles.collectionProduct}>
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title ?? ''}
          className={styles.collectionImage}
          loading="lazy"
        />
      )}
      <div className={styles.collectionProductBody}>
        <p className={styles.collectionProductTitle}>
          {product.title ?? 'Product'}
        </p>
        {displayPrice && (
          <span className={styles.collectionProductPrice}>
            {displayPrice}
          </span>
        )}
      </div>
      <div className={styles.collectionProductActions}>
        {onAdd !== undefined && (
          <button
            type="button"
            className={styles.smallAddButton}
            onClick={handleAdd}
            disabled={added}
          >
            {added ? '✓' : 'Add'}
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
  );
}

export function CollectionSuggestionCard({
  collection,
  onAddProduct,
}: CollectionSuggestionCardProps) {
  return (
    <div className={styles.collectionCard}>
      <div className={styles.collectionHeader}>
        <div>
          <p className={styles.collectionLabel}>Collection page</p>
          <p className={styles.title}>
            {collection.title ?? 'Products from this page'}
          </p>
        </div>
        <a
          href={collection.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.visitLink}
        >
          Open ↗
        </a>
      </div>
      <div className={styles.collectionProducts}>
        {collection.products.map((product) => (
          <CollectionProductRow
            key={product.url}
            product={product}
            onAdd={
              onAddProduct ? () => onAddProduct(product) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
