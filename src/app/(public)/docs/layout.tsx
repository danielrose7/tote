'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import styles from '../templates/templates.module.css';

const navItems = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/getting-started', label: 'Getting Started' },
  { href: '/docs/collections', label: 'Collections' },
  { href: '/docs/slots', label: 'Slots' },
  { href: '/docs/adding-links', label: 'Adding Links' },
  { href: '/docs/extension', label: 'Browser Extension' },
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

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav label="Help center" />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>Help</p>
          <ul className={styles.categoryList}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.categoryItem}
                  data-active={pathname === item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main className={`${styles.main} ${styles.mainReadable}`}>
          {children}
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}
