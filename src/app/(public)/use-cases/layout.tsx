'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import styles from '../templates/templates.module.css';

const navItems = [
  { href: '/use-cases', label: 'Overview' },
  { href: '/use-cases/gift-shopping', label: 'Gift Lists & Wishlists' },
  { href: '/use-cases/home-renovation', label: 'Home Renovation' },
  { href: '/use-cases/personal-style', label: 'Wardrobe & Style' },
  { href: '/use-cases/family-shopping', label: 'Family Shopping' },
  { href: '/use-cases/professional-projects', label: 'Professional Projects' },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Tote Use Cases',
  url: 'https://tote.tools/use-cases',
  description:
    'Discover how people use Tote to organize shopping for gifts, home renovations, wardrobes, family projects, and professional sourcing.',
  publisher: {
    '@type': 'Organization',
    name: 'Tote',
    url: 'https://tote.tools',
  },
};

export default function UseCasesLayout({
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
      <PublicNav label="Use cases" />

      <div className={styles.layout}>
        {/* Page links, not filters — but they behave like the templates
            sidebar: sticky on desktop, a row of chips on mobile. */}
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>Use cases</p>
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
