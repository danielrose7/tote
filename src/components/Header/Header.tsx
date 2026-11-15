'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { AuthButton } from '@/AuthButton';
import { useTranslation } from '@/i18n/client';
import styles from './Header.module.css';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  onAddLinkClick?: () => void;
  onAddCollectionClick?: () => void;
  onAddContentClick?: () => void;
  onSaveTabsClick?: () => void;
  showAddLink?: boolean;
  showAddCollection?: boolean;
  showAddContent?: boolean;
  showSaveTabs?: boolean;
  showImport?: boolean;
  breadcrumbs?: Breadcrumb[];
}

export function Header({
  onAddLinkClick,
  onAddCollectionClick,
  onAddContentClick,
  onSaveTabsClick,
  showAddLink = false,
  showAddCollection = false,
  showAddContent = false,
  showSaveTabs = false,
  showImport = false,
  breadcrumbs,
}: HeaderProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const isCurator = user?.publicMetadata?.curator === true;

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brandSection}>
          <Link href="/collections" className={styles.brand}>
            <h1 className={styles.title}>tote</h1>
          </Link>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              className={styles.breadcrumbs}
              aria-label={t('shell.header.breadcrumb')}
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.label} className={styles.breadcrumbItem}>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  {crumb.href ? (
                    <Link href={crumb.href} className={styles.breadcrumbLink}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className={styles.actions}>
          {user?.username && (
            <a
              href={`/s/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.curatorLink}
            >
              {t('shell.header.myProfile')}
            </a>
          )}
          {isCurator && (
            <Link href="/curate" className={styles.curatorLink}>
              {t('shell.header.curator')}
            </Link>
          )}
          {showAddLink && onAddLinkClick && (
            <button
              type="button"
              onClick={onAddLinkClick}
              className={styles.addButton}
            >
              {t('shell.header.addLink')}
            </button>
          )}
          {showAddContent && onAddContentClick && (
            <button
              type="button"
              onClick={onAddContentClick}
              className={styles.addButton}
            >
              {t('shell.header.addContent')}
            </button>
          )}
          {showAddCollection && onAddCollectionClick && (
            <button
              type="button"
              onClick={onAddCollectionClick}
              className={styles.addButton}
            >
              {t('shell.header.addCollection')}
            </button>
          )}
          {showSaveTabs && onSaveTabsClick && (
            <button
              type="button"
              onClick={onSaveTabsClick}
              className={styles.addButton}
            >
              {t('shell.header.saveTabs')}
            </button>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
