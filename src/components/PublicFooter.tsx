'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n/client';
import { LOCALE_LABELS, LOCALES } from '@/i18n/config';
import {
  isTranslatedPath,
  localizedPath,
  splitLocalePath,
} from '@/i18n/publicPages';
import { CHROME_WEB_STORE_URL } from '../lib/constants';
import { InstallLabel } from './InstallLabel';
import styles from './PublicFooter.module.css';

const footerGroups = [
  {
    titleKey: 'site.footer.groups.useCases',
    links: [
      {
        href: '/use-cases/gift-shopping',
        labelKey: 'site.footer.links.giftShopping',
      },
      {
        href: '/use-cases/home-renovation',
        labelKey: 'site.footer.links.homeRenovation',
      },
      {
        href: '/use-cases/personal-style',
        labelKey: 'site.footer.links.personalStyle',
      },
      {
        href: '/use-cases/family-shopping',
        labelKey: 'site.footer.links.familyShopping',
      },
      {
        href: '/use-cases/professional-projects',
        labelKey: 'site.footer.links.professionalProjects',
      },
    ],
  },
  {
    titleKey: 'site.footer.groups.whyTote',
    links: [
      { href: '/#comparison', labelKey: 'site.footer.links.vsBookmarks' },
      { href: '/#comparison', labelKey: 'site.footer.links.vsWishlists' },
      { href: '/#comparison', labelKey: 'site.footer.links.vsSpreadsheets' },
      { href: '/#privacy', labelKey: 'site.footer.links.private' },
    ],
  },
  {
    titleKey: 'site.footer.groups.product',
    links: [
      { href: '/templates', labelKey: 'site.footer.links.templates' },
      { href: '/chrome-extension', labelKey: 'site.footer.links.extension' },
      { href: '/ios-app', labelKey: 'site.footer.links.ios' },
      { href: '/docs', labelKey: 'site.footer.links.docs' },
      {
        href: '/docs/getting-started',
        labelKey: 'site.footer.links.gettingStarted',
      },
      { href: '/privacy', labelKey: 'site.footer.links.privacy' },
    ],
  },
];

/**
 * Language links list only pages that exist: a page with no translation sends
 * you to that language's home instead of a 404.
 */
function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { path } = splitLocalePath(usePathname() ?? '/');
  if (LOCALES.length < 2) return null;
  return (
    <nav aria-label={t('site.footer.language')} className={styles.languages}>
      {LOCALES.map((locale) => {
        const target = isTranslatedPath(path) ? path : '/';
        const href = locale === 'en' ? path : localizedPath(locale, target);
        return locale === i18n.language ? (
          <span key={locale} lang={locale} aria-current="true">
            {LOCALE_LABELS[locale]}
          </span>
        ) : (
          <Link key={locale} href={href} hrefLang={locale} lang={locale}>
            {LOCALE_LABELS[locale]}
          </Link>
        );
      })}
    </nav>
  );
}

export function PublicFooter() {
  const { t, i18n } = useTranslation();
  const href = (target: string) => localizedPath(i18n.language, target);
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <Link href={href('/')} className={styles.wordmark}>
              tote
            </Link>
            <p>{t('site.footer.tagline')}</p>
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeButton}
            >
              <InstallLabel />
            </a>
          </div>

          <div className={styles.footerGroups}>
            {footerGroups.map((group) => (
              <div key={group.titleKey} className={styles.footerGroup}>
                <h3>{t(group.titleKey)}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.labelKey}>
                      <Link href={href(link.href)}>{t(link.labelKey)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} Tote</span>
          <LanguageSwitcher />
          <a
            href="https://gobloom.io"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mountainLink}
          >
            <span className={styles.mountainLabel}>
              {t('site.footer.madeIn')}
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
