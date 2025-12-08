import type { JazzAccount, ProductLink } from "../../schema.ts";
import type { co } from "jazz-tools";
import { ProductCard } from "../ProductCard";
import styles from "./ProductGrid.module.css";

interface ProductGridProps {
  account: co.loaded<typeof JazzAccount>;
  onEditLink?: (link: co.loaded<typeof ProductLink>) => void;
  onDeleteLink?: (link: co.loaded<typeof ProductLink>) => void;
}

export function ProductGrid({ account, onEditLink, onDeleteLink }: ProductGridProps) {
  if (!account.root || !account.root.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const links = account.root.links;

  if (!links.$isLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (links.length === 0) {
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h2 className={styles.emptyTitle}>No links yet</h2>
          <p className={styles.emptyDescription}>
            Click "Add Link" to save your first product to your collection
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
    </div>
  );
}
