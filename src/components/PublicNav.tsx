'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CHROME_WEB_STORE_URL } from '../lib/constants';
import { InstallLabel } from './InstallLabel';
import styles from './PublicNav.module.css';

type NavLink = { href: string; label: string };

const LINKS: NavLink[] = [
  { href: '/templates', label: 'Templates' },
  { href: '/chrome-extension', label: 'Extension' },
  { href: '/ios-app', label: 'iOS App' },
  { href: '/docs', label: 'Docs' },
];

/**
 * Docs goes to the section you're already reading about, so someone on the
 * extension page lands in extension docs rather than the help index.
 */
const CONTEXTUAL_DOCS: Record<string, string> = {
  '/chrome-extension': '/docs/extension',
  '/ios-app': '/docs/ios-app',
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The site nav for public pages that aren't the landing page: a pill holding
 * the wordmark and links, with the install CTA outside it as its own button.
 * Every page shows the same links — the current one is marked, not removed.
 */
export function PublicNav({ label = 'Site' }: { label?: string }) {
  const pathname = usePathname() ?? '';

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label={label}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.wordmark}>
            tote
          </Link>
          <div className={styles.navLinks}>
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              const href =
                link.href === '/docs'
                  ? (CONTEXTUAL_DOCS[pathname] ?? link.href)
                  : link.href;

              return (
                <Link
                  key={link.href}
                  href={href}
                  className={active ? styles.navLinkActive : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.navCta}
        >
          <InstallLabel />
        </a>
      </nav>
    </header>
  );
}
