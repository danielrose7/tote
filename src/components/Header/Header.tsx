"use client";

import Link from "next/link";
import { AuthButton } from "../../AuthButton";
import styles from "./Header.module.css";

interface HeaderProps {
  onAddLinkClick?: () => void;
  onCreateCollectionClick?: () => void;
  showAddLink?: boolean;
  showCreateCollection?: boolean;
}

export function Header({
  onAddLinkClick,
  onCreateCollectionClick,
  showAddLink = false,
  showCreateCollection = false,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/collections" className={styles.brand}>
          <h1 className={styles.title}>tote</h1>
          <p className={styles.tagline}>Your product wishlist</p>
        </Link>

        <div className={styles.actions}>
          {showAddLink && onAddLinkClick && (
            <button
              type="button"
              onClick={onAddLinkClick}
              className={styles.addButton}
            >
              + Add Link
            </button>
          )}
          {showCreateCollection && onCreateCollectionClick && (
            <button
              type="button"
              onClick={onCreateCollectionClick}
              className={styles.addButton}
            >
              + Create Collection
            </button>
          )}
          <Link href="/settings" className={styles.settingsLink}>
            ⚙️ Settings
          </Link>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
