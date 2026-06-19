'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PublishedCollectionSummary } from '@/lib/publishedCollectionsDb';
import styles from './templates.module.css';

export type TemplateEntry = PublishedCollectionSummary & {
  username: string;
  slug: string;
  category: string;
};

const ALL = 'All';

export function TemplatesClient({ templates }: { templates: TemplateEntry[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category') ?? ALL;

  function setActiveCategory(cat: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === ALL) {
      params.delete('category');
    } else {
      params.set('category', cat);
    }
    const qs = params.toString();
    router.replace(`/templates${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const categories = [
    ALL,
    ...Array.from(new Set(templates.map((t) => t.category))),
  ];

  const categoryCounts = Object.fromEntries(
    categories
      .slice(1)
      .map((cat) => [cat, templates.filter((t) => t.category === cat).length]),
  );

  const visible =
    activeCategory === ALL
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <ul className={styles.categoryList}>
          <li>
            <button
              type="button"
              className={styles.categoryItem}
              data-active={activeCategory === ALL}
              onClick={() => setActiveCategory(ALL)}
            >
              All
              <span className={styles.categoryCount}>{templates.length}</span>
            </button>
          </li>
          {categories.slice(1).map((cat) => (
            <li key={cat}>
              <button
                type="button"
                className={styles.categoryItem}
                data-active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
                <span className={styles.categoryCount}>
                  {categoryCounts[cat]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.main}>
        <div className={styles.grid}>
          {visible.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TemplateCard({ template: t }: { template: TemplateEntry }) {
  return (
    <Link href={`/s/${t.username}/${t.slug}`} className={styles.card}>
      <CollectionCover
        images={t.coverImages.map((ci) => ci.url)}
        color={t.color ?? '#6366f1'}
      />
      <div className={styles.cardBody}>
        <span className={styles.cardCategory}>{t.category}</span>
        <h2 className={styles.cardTitle}>{t.name}</h2>
        {t.description && (
          <p className={styles.cardDescription}>{t.description}</p>
        )}
        <p className={styles.cardMeta}>
          {t.itemCount} {t.itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>
    </Link>
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
