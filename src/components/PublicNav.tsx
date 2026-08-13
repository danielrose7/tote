'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CHROME_WEB_STORE_URL } from '../lib/constants';
import { InstallLabel } from './InstallLabel';
import { LandingAuthButtons } from './LandingAuthButtons';
import styles from './PublicNav.module.css';

type NavLink = { href: string; label: string };

const LINKS: NavLink[] = [
  { href: '/use-cases', label: 'Use cases' },
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
export function PublicNav({
  label = 'Site',
  solid = false,
}: {
  label?: string;
  /** Paint a backdrop behind the nav, for pages whose content would
   * otherwise scroll through the gaps around the pill. */
  solid?: boolean;
}) {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);

  // A tap on a menu link navigates without unmounting the nav, so the sheet
  // has to be closed by the route change itself.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The hamburger disappears above 760px, so a sheet left open across a
  // resize or a rotation would have no way to be closed. Match the breakpoint
  // in the stylesheet.
  useEffect(() => {
    if (!menuOpen) return;

    const wide = window.matchMedia('(min-width: 761px)');
    const onChange = () => {
      if (wide.matches) setMenuOpen(false);
    };
    onChange();
    wide.addEventListener('change', onChange);

    return () => wide.removeEventListener('change', onChange);
  }, [menuOpen]);

  // While the sheet is up it owns the screen: the page behind it must not
  // scroll, and Escape closes it.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const resolveHref = (href: string) =>
    href === '/docs' ? (CONTEXTUAL_DOCS[pathname] ?? href) : href;

  return (
    <header
      className={
        solid ? `${styles.header} ${styles.headerSolid}` : styles.header
      }
    >
      <nav className={styles.nav} aria-label={label}>
        <div className={styles.navBar}>
          {/* Narrow screens can't fit five links, so they get this instead —
              it's display:none on desktop, where the links are right there. */}
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="public-nav-menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
          <Link href="/" className={styles.wordmark}>
            tote
          </Link>
          <div className={styles.navLinks}>
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={resolveHref(link.href)}
                  className={active ? styles.navLinkActive : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className={styles.navActions}>
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navCta}
          >
            <InstallLabel />
          </a>
          {/* Signed out this is Log in / Sign up; signed in it collapses to a
              single "Open Tote", which is how you get back into the app from
              docs and the marketing pages. */}
          <LandingAuthButtons />
        </div>
      </nav>

      {menuOpen ? (
        <div className={styles.sheet}>
          {/* A button, not a div, so tapping outside is a real control rather
              than a click handler on nothing. Escape does the same thing. */}
          <button
            type="button"
            className={styles.sheetScrim}
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
          />
          <div className={styles.sheetPanel} id="public-nav-menu">
            <div className={styles.sheetHeader}>
              <button
                type="button"
                className={styles.sheetClose}
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </button>
              <Link href="/" className={styles.wordmark}>
                tote
              </Link>
            </div>

            <div className={styles.sheetLinks}>
              {LINKS.map((link) => {
                const active = isActive(pathname, link.href);

                return (
                  <Link
                    key={link.href}
                    href={resolveHref(link.href)}
                    className={active ? styles.sheetLinkActive : undefined}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* The install CTA can't run on the phone you're reading this on,
                so it moves out of the bar and down here with the rest. */}
            <div className={styles.sheetActions}>
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sheetCta}
              >
                <InstallLabel />
              </a>
              <LandingAuthButtons />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
