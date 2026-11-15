import { Suspense } from 'react';
import { PreFooterCta } from '@/components/PreFooterCta';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import { StickyCtaBar } from '@/components/StickyCtaBar';
import type { Locale } from '@/i18n/config';
import { PublicI18nProvider } from '@/i18n/PublicI18nProvider';
import { getPublicT } from '@/i18n/server';
import { getPublishedCollectionSummariesByUsernameAndSlugs } from '@/lib/publishedCollectionsDb';
import type { TemplateEntry } from './TemplatesClient';
import { TemplatesClient } from './TemplatesClient';
import styles from './templates.module.css';

// `category` is the stable English name: it is what ?category= carries, so
// existing links keep working. TemplatesClient maps it to a translated label.
const TEMPLATES: { username: string; slug: string; category: string }[] = [
  {
    username: 'daniel',
    slug: 'a-montessori-nursery-for-the-first-three-months',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'baby-gear-that-earns-its-floor-space',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'baby-shower-gifts-for-the-person-actually-having-the-baby',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'floor-play-for-36-months-natural-toys-that-support-real-motor-work',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'a-starter-registry-built-to-last-past-the-newborn-stage',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'wood-and-open-shelves-awesome-screen-free-toys',
    category: 'Baby & Nursery',
  },
  {
    username: 'daniel',
    slug: 'practical-gifts-for-a-grandmother-who-visits-the-baby',
    category: 'Gifts',
  },
  {
    username: 'daniel',
    slug: 'kitchen-gifts-worth-giving-a-regular-home-cook',
    category: 'Gifts',
  },
  {
    username: 'daniel',
    slug: 'the-considered-gardeners-kit',
    category: 'Garden',
  },
  {
    username: 'daniel',
    slug: 'us-made-everyday-rotation-supply-chain-honest',
    category: 'Style & Wardrobe',
  },
];

export async function TemplatesPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['templates']);
  return (
    <div className={styles.page}>
      <PublicNav label={t('templates.navLabel')} />
      <header className={styles.header}>
        <h1 className={styles.heading}>{t('templates.heading')}</h1>
        <p className={styles.subheading}>{t('templates.subheading')}</p>
      </header>
      <Suspense fallback={<TemplatesSkeleton />}>
        <TemplatesData locale={locale} />
      </Suspense>
      <PreFooterCta />
      <StickyCtaBar />
      <PublicFooter />
    </div>
  );
}

async function TemplatesData({ locale }: { locale: Locale }) {
  const summaries = await getPublishedCollectionSummariesByUsernameAndSlugs(
    TEMPLATES.map(({ username, slug }) => ({ username, slug })),
  );

  const templates: TemplateEntry[] = TEMPLATES.flatMap(
    ({ username, slug, category }) => {
      const s = summaries.find(
        (c) => c.username === username && c.slug === slug,
      );
      return s ? [{ ...s, username, slug, category }] : [];
    },
  );

  // The cards' chrome needs the templates strings; nav/footer keep theirs.
  return (
    <PublicI18nProvider locale={locale} areas={['templates']}>
      <TemplatesClient templates={templates} />
    </PublicI18nProvider>
  );
}

function TemplatesSkeleton() {
  return (
    <div className={styles.skeletonLayout}>
      <div className={styles.skeletonSidebar}>
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className={styles.skeletonLine} />
        ))}
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    </div>
  );
}
