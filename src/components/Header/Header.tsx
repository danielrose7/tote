"use client";

import Link from "next/link";
import { AuthButton } from "../../AuthButton";
import styles from "./Header.module.css";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  onAddLinkClick?: () => void;
  onAddCollectionClick?: () => void;
  showAddLink?: boolean;
  showAddCollection?: boolean;
  breadcrumbs?: Breadcrumb[];
}

export function Header({
  onAddLinkClick,
  onAddCollectionClick,
  showAddLink = false,
  showAddCollection = false,
  breadcrumbs,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brandSection}>
          <Link href="/collections" className={styles.brand}>
            <h1 className={styles.title}>tote</h1>
          </Link>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.label} className={styles.breadcrumbItem}>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  {crumb.href ? (
                    <Link href={crumb.href} className={styles.breadcrumbLink}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

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
          {showAddCollection && onAddCollectionClick && (
            <button
              type="button"
              onClick={onAddCollectionClick}
              className={styles.addButton}
            >
              + Add Collection
            </button>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
