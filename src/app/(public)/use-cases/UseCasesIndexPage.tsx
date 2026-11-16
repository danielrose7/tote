import Link from 'next/link';
import styles from '../docs/docs.module.css';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import { USE_CASE_SLUGS, USE_CASES, type UseCaseSlug } from './useCasesConfig';

function GiftIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="8"
        y="22"
        width="32"
        height="20"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.4"
      />
      <rect
        x="6"
        y="16"
        width="36"
        height="8"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.6"
      />
      <rect
        x="22"
        y="16"
        width="4"
        height="26"
        fill="var(--card-accent)"
        opacity="0.3"
      />
      <rect
        x="6"
        y="18"
        width="36"
        height="4"
        fill="var(--card-accent)"
        opacity="0.25"
      />
      <ellipse
        cx="19"
        cy="14"
        rx="6"
        ry="5"
        fill="var(--card-accent)"
        opacity="0.5"
        stroke="var(--card-accent)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="29"
        cy="14"
        rx="6"
        ry="5"
        fill="var(--card-accent)"
        opacity="0.5"
        stroke="var(--card-accent)"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="15" r="3" fill="var(--card-accent)" opacity="0.7" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24 6 L42 22 L42 42 L6 42 L6 22 Z"
        fill="var(--card-accent)"
        opacity="0.5"
      />
      <rect
        x="14"
        y="16"
        width="8"
        height="8"
        rx="1"
        fill="var(--card-accent)"
        opacity="0.35"
      />
      <rect
        x="26"
        y="16"
        width="8"
        height="8"
        rx="1"
        fill="var(--card-accent)"
        opacity="0.35"
      />
      <rect
        x="14"
        y="28"
        width="8"
        height="8"
        rx="1"
        fill="var(--card-accent)"
        opacity="0.35"
      />
      <rect
        x="26"
        y="28"
        width="8"
        height="14"
        rx="1"
        fill="var(--card-accent)"
        opacity="0.6"
      />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="10"
        r="4"
        fill="none"
        stroke="var(--card-accent)"
        strokeWidth="2.5"
        opacity="0.6"
      />
      <path
        d="M24 14 L24 18 L42 32 L42 36 L6 36 L6 32 L24 18"
        fill="var(--card-accent)"
        opacity="0.4"
        stroke="var(--card-accent)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="22" r="12" fill="var(--card-accent)" opacity="0.7" />
      <circle cx="30" cy="22" r="12" fill="var(--card-accent)" opacity="0.7" />
      <circle cx="18" cy="12" r="5" fill="var(--card-accent)" opacity="0.9" />
      <circle cx="30" cy="12" r="5" fill="var(--card-accent)" opacity="0.9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="18"
        height="18"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.8"
      />
      <rect
        x="26"
        y="4"
        width="18"
        height="18"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.55"
      />
      <rect
        x="4"
        y="26"
        width="18"
        height="18"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.55"
      />
      <rect
        x="26"
        y="26"
        width="18"
        height="18"
        rx="3"
        fill="var(--card-accent)"
        opacity="0.8"
      />
      <circle cx="13" cy="7" r="2" fill="var(--card-accent)" />
      <circle cx="35" cy="7" r="2" fill="var(--card-accent)" />
    </svg>
  );
}

const ICONS: Record<UseCaseSlug, () => React.JSX.Element> = {
  'gift-shopping': GiftIcon,
  'home-renovation': HouseIcon,
  'personal-style': HangerIcon,
  'family-shopping': PeopleIcon,
  'professional-projects': GridIcon,
};

export async function UseCasesIndexPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['useCases']);
  return (
    <article className={styles.article}>
      <h1>{t('useCases.index.title')}</h1>
      <p className={styles.lead}>{t('useCases.index.lead')}</p>

      {USE_CASE_SLUGS.map((slug) => {
        const Icon = ICONS[slug];
        const key = `useCases.index.cards.${slug}`;
        return (
          <div
            key={slug}
            id={slug}
            className={styles.card}
            style={
              { '--card-accent': USE_CASES[slug].accent } as React.CSSProperties
            }
          >
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{t(`${key}.title`)}</h3>
              <Icon />
            </div>
            <p className={styles.cardDescription}>{t(`${key}.description`)}</p>
            <Link href={localizedPath(locale, `/use-cases/${slug}`)}>
              {t(`${key}.linkText`)} &rarr;
            </Link>
          </div>
        );
      })}
    </article>
  );
}
