'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localizedPath, splitLocalePath } from '@/i18n/publicPages';
import styles from '../templates/templates.module.css';

export type SidebarItem = { href: string; label: string };

/** Page links, not filters — but they behave like the templates sidebar:
 * sticky on desktop, a row of chips on mobile. Needs the pathname to mark the
 * current page, hence a client component; the labels come in as props. */
export function UseCasesSidebar({
  locale,
  label,
  items,
}: {
  locale: string;
  label: string;
  items: SidebarItem[];
}) {
  // /es/use-cases and /use-cases are the same page: compare on the path alone.
  const { path } = splitLocalePath(usePathname() ?? '');
  return (
    <aside className={styles.sidebar}>
      <p className={styles.sidebarLabel}>{label}</p>
      <ul className={styles.categoryList}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={localizedPath(locale, item.href)}
              className={styles.categoryItem}
              data-active={path === item.href}
              aria-current={path === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
