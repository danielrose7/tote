import Link from 'next/link';
import { CHROME_WEB_STORE_URL } from '../lib/constants';
import { InstallLabel } from './InstallLabel';
import styles from './PublicNav.module.css';

type NavLink = { href: string; label: string };

const DEFAULT_LINKS: NavLink[] = [
  { href: '/templates', label: 'Templates' },
  { href: '/chrome-extension', label: 'Extension' },
  { href: '/ios-app', label: 'iOS App' },
  { href: '/docs', label: 'Docs' },
];

/**
 * The site nav for public pages that aren't the landing page: a pill holding
 * the wordmark and links, with the install CTA outside it as its own button.
 */
export function PublicNav({
  links = DEFAULT_LINKS,
  label = 'Site',
}: {
  links?: NavLink[];
  label?: string;
}) {
  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label={label}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.wordmark}>
            tote
          </Link>
          <div className={styles.navLinks}>
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
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
