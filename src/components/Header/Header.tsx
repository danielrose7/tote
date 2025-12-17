"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    // Check if running on localhost
    setIsLocalhost(
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/collections" className={styles.brand}>
          <h1 className={styles.title}>tote</h1>
          <p className={styles.tagline}>Your product wishlist</p>
        </Link>

        <div className={styles.actions}>
          {isLocalhost && (
            <Link href="/dev/metadata-test" className={styles.devLink}>
              🧪 Test Lab
            </Link>
          )}
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
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
