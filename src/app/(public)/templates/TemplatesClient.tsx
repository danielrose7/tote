'use client';

import type { TFunction } from 'i18next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/i18n/client';
import { localizedPath } from '@/i18n/publicPages';
import type { PublishedCollectionSummary } from '@/lib/publishedCollectionsDb';
import styles from './templates.module.css';

export type TemplateEntry = PublishedCollectionSummary & {
  username: string;
  slug: string;
  category: string;
};

const ALL = 'All';

// Stable English names (what ?category= carries) → catalog keys.
const CATEGORY_LABELS: Record<string, string> = {
  'Baby & Nursery': 'templates.categories.babyNursery',
  Gifts: 'templates.categories.gifts',
  Garden: 'templates.categories.garden',
  'Style & Wardrobe': 'templates.categories.styleWardrobe',
};

export function TemplatesClient({ templates }: { templates: TemplateEntry[] }) {
  const { t, i18n } = useTranslation();
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
    router.replace(
      localizedPath(i18n.language, `/templates${qs ? `?${qs}` : ''}`),
      { scroll: false },
    );
  }

  const categories = [
    ALL,
    ...Array.from(new Set(templates.map((tpl) => tpl.category))),
  ];

  const categoryCounts = Object.fromEntries(
    categories
      .slice(1)
      .map((cat) => [
        cat,
        templates.filter((tpl) => tpl.category === cat).length,
      ]),
  );

  const visible =
    activeCategory === ALL
      ? templates
      : templates.filter((tpl) => tpl.category === activeCategory);

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
              {t('templates.all')}
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
                {categoryLabel(t, cat)}
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
          {visible.map((tpl) => (
            <TemplateCard key={tpl.id} template={tpl} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TemplateCard({ template: tpl }: { template: TemplateEntry }) {
  const { t } = useTranslation();
  return (
    <Link href={`/s/${tpl.username}/${tpl.slug}`} className={styles.card}>
      <CollectionCover
        images={tpl.coverImages.map((ci) => ci.url)}
        color={tpl.color ?? '#6366f1'}
      />
      <div className={styles.cardBody}>
        <span className={styles.cardCategory}>
          {categoryLabel(t, tpl.category)}
        </span>
        <h2 className={styles.cardTitle}>{tpl.name}</h2>
        {tpl.description && (
          <p className={styles.cardDescription}>{tpl.description}</p>
        )}
        <p className={styles.cardMeta}>
          {t('templates.itemCount', { count: tpl.itemCount })}
        </p>
      </div>
    </Link>
  );
}

function categoryLabel(t: TFunction, category: string) {
  const key = CATEGORY_LABELS[category];
  return key ? t(key) : category;
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
