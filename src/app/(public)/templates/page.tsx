import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PreFooterCta } from '../../../components/PreFooterCta';
import { PublicFooter } from '../../../components/PublicFooter';
import { StickyCtaBar } from '../../../components/StickyCtaBar';
import { getPublishedCollectionSummariesByUsernameAndSlugs } from '../../../lib/publishedCollectionsDb';
import type { TemplateEntry } from './TemplatesClient';
import { TemplatesClient } from './TemplatesClient';
import styles from './templates.module.css';

export const metadata: Metadata = {
  title: 'Template Collections — Tote',
  description:
    'Curated collections ready to clone and make your own. Browse gift guides, home setups, baby gear, and more.',
  alternates: { canonical: '/templates' },
  openGraph: {
    title: 'Template Collections — Tote',
    description:
      'Curated collections ready to clone and make your own. Browse gift guides, home setups, baby gear, and more.',
  },
};

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
    slug: 'us-made-everyday-rotation-supply-chain-honest',
    category: 'Style & Wardrobe',
  },
];

export default function TemplatesPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Templates</h1>
        <p className={styles.subheading}>
          Curated collections ready to clone and make your own.
        </p>
      </header>
      <Suspense fallback={<TemplatesSkeleton />}>
        <TemplatesData />
      </Suspense>
      <PreFooterCta />
      <StickyCtaBar />
      <PublicFooter />
    </div>
  );
}

async function TemplatesData() {
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

  return <TemplatesClient templates={templates} />;
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
