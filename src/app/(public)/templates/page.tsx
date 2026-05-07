import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PreFooterCta } from '../../../components/PreFooterCta';
import { PublicFooter } from '../../../components/PublicFooter';
import { StickyCtaBar } from '../../../components/StickyCtaBar';
import { getPublishedCollectionSummariesByUsernameAndSlugs } from '../../../lib/publishedCollectionsDb';
import styles from '../s/[username]/page.module.css';
import templateStyles from './templates.module.css';

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

const TEMPLATES: { username: string; slug: string }[] = [
  {
    username: 'daniel',
    slug: 'baby-shower-gifts-for-the-person-actually-having-the-baby',
  },
];

export default function TemplatesPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.heading}>Templates</h1>
          <p className={styles.subheading}>
            Curated collections ready to clone and make your own.
          </p>
        </div>
      </header>
      <main className={styles.grid}>
        <Suspense fallback={<TemplateSkeletons count={TEMPLATES.length} />}>
          <TemplateGrid />
        </Suspense>
      </main>
      <PreFooterCta />
      <StickyCtaBar />
      <PublicFooter />
    </div>
  );
}

async function TemplateGrid() {
  const collections =
    await getPublishedCollectionSummariesByUsernameAndSlugs(TEMPLATES);

  const ordered = TEMPLATES.flatMap(({ username, slug }) => {
    const c = collections.find(
      (col) => col.username === username && col.slug === slug,
    );
    return c ? [c] : [];
  });

  if (ordered.length === 0) {
    return <p className={templateStyles.empty}>No templates available yet.</p>;
  }

  return (
    <>
      {ordered.map((c) => (
        <Link
          key={c.id}
          href={`/s/${c.username}/${c.slug}`}
          className={styles.card}
        >
          <CollectionCover
            images={c.coverImages}
            color={c.color ?? '#6366f1'}
          />
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>{c.name}</h2>
            {c.description && (
              <p className={styles.cardDescription}>{c.description}</p>
            )}
            <p className={styles.cardMeta}>
              {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        </Link>
      ))}
    </>
  );
}

function TemplateSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <div key={i} className={templateStyles.skeleton} />
      ))}
    </>
  );
}

function CollectionCover({
  images,
  color,
}: {
  images: string[];
  color: string;
}) {
  if (images.length === 0) {
    return (
      <div
        className={styles.coverFallback}
        style={{
          background: `radial-gradient(circle at 20% 80%, ${color}99 0%, transparent 55%),
                       radial-gradient(circle at 80% 15%, ${color}66 0%, transparent 45%),
                       radial-gradient(circle at 55% 50%, ${color}44 0%, transparent 60%),
                       ${color}22`,
        }}
      />
    );
  }
  if (images.length === 1) {
    return (
      <div className={styles.coverSingle}>
        <img src={images[0]} alt="" className={styles.coverImg} />
      </div>
    );
  }
  if (images.length === 2) {
    return (
      <div className={styles.coverTwo}>
        <img src={images[0]} alt="" className={styles.coverImg} />
        <img src={images[1]} alt="" className={styles.coverImg} />
      </div>
    );
  }
  return (
    <div className={styles.coverThree}>
      <img
        src={images[0]}
        alt=""
        className={`${styles.coverImg} ${styles.coverImgMain}`}
      />
      <div className={styles.coverStack}>
        <img src={images[1]} alt="" className={styles.coverImg} />
        <img src={images[2]} alt="" className={styles.coverImg} />
      </div>
    </div>
  );
}
