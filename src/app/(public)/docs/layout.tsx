'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { PublicNav } from '@/components/PublicNav';
import styles from './docs.module.css';

const navItems = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/getting-started', label: 'Getting Started' },
  { href: '/docs/collections', label: 'Collections' },
  { href: '/docs/slots', label: 'Slots' },
  { href: '/docs/adding-links', label: 'Adding Links' },
  { href: '/docs/extension', label: 'Chrome Extension' },
  { href: '/docs/ios-app', label: 'iOS App' },
  { href: '/docs/selections-and-budgets', label: 'Selections & Budgets' },
  { href: '/docs/sharing', label: 'Sharing' },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Tote Help Center',
  url: 'https://tote.tools/docs',
  description:
    'Learn how to use Tote to save, organize, and track products from anywhere on the web.',
  publisher: {
    '@type': 'Organization',
    name: 'Tote',
    url: 'https://tote.tools',
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav label="Help center" solid />

      <div className={styles.sectionBar}>
        <span className={styles.docsLabel}>Help</span>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
        <Link href="/collections" className={styles.backLink}>
          Back to app
        </Link>
      </div>

      <div className={styles.main}>
        <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
          <nav className={styles.sidebarNav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  pathname === item.href ? styles.navItemActive : ''
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
