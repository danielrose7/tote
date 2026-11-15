import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import { InstallCta } from '@/components/InstallCta';
import { LandingAuthButtons } from '@/components/LandingAuthButtons';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import heroImage from '@/product-images-01.png';
import collectionImage from '@/product-images-02.png';
import styles from './landing.module.css';

// Brand names: not translated.
const sourceStores = [
  'IKEA',
  'Wayfair',
  'Home Depot',
  'Zara',
  'Nike',
  'Madhappy',
  'Gardenheir',
  'Grace Rose Farm',
  'Anthropologie',
  'Etsy',
  'eBay',
  'Depop',
  'REI',
  'Patagonia',
  'Mammut',
  'Sephora',
  'Ulta',
  'Best Buy',
  'Target',
  'Article',
  'Magnolia',
  'Schoolhouse',
  'Food52',
  'West Elm',
  'Terrain',
  'Maisonette',
  'SSENSE',
  'The Sill',
  'Benjamin Moore',
  'Sherwin-Williams',
  'GE Appliances',
  'Cafe',
  'Bosch',
];

// Non-text parts of the repeated blocks; the words come from the catalog, in
// the same order.
const useCaseLinks = [
  { href: '/use-cases/gift-shopping', accent: 'var(--color-lavender)' },
  { href: '/use-cases/home-renovation', accent: 'var(--color-powder-blue)' },
  { href: '/use-cases/personal-style', accent: 'var(--color-periwinkle)' },
  { href: '/use-cases/family-shopping', accent: 'var(--color-peach)' },
  { href: '/use-cases/professional-projects', accent: 'var(--color-blush)' },
];

const comparisonColumns: {
  key: 'spreadsheets' | 'wishlists' | 'groupChats' | 'bookmarks' | 'tote';
  labelKey: string;
  highlight?: boolean;
}[] = [
  { key: 'spreadsheets', labelKey: 'landing.comparison.columns.spreadsheets' },
  { key: 'wishlists', labelKey: 'landing.comparison.columns.wishlists' },
  { key: 'groupChats', labelKey: 'landing.comparison.columns.groupChats' },
  { key: 'bookmarks', labelKey: 'landing.comparison.columns.bookmarks' },
  {
    key: 'tote',
    labelKey: 'landing.comparison.columns.tote',
    highlight: true,
  },
];

// One row per feature, in catalog order.
const comparisonValues = [
  {
    bookmarks: true,
    wishlists: true,
    spreadsheets: false,
    groupChats: true,
    tote: true,
  },
  {
    bookmarks: false,
    wishlists: false,
    spreadsheets: true,
    groupChats: false,
    tote: true,
  },
  {
    bookmarks: false,
    wishlists: false,
    spreadsheets: false,
    groupChats: false,
    tote: true,
  },
  {
    bookmarks: false,
    wishlists: false,
    spreadsheets: true,
    groupChats: false,
    tote: true,
  },
  {
    bookmarks: false,
    wishlists: false,
    spreadsheets: false,
    groupChats: false,
    tote: true,
  },
  {
    bookmarks: false,
    wishlists: true,
    spreadsheets: false,
    groupChats: true,
    tote: true,
  },
  {
    bookmarks: true,
    wishlists: false,
    spreadsheets: false,
    groupChats: false,
    tote: true,
  },
];

type Card = { title: string; description: string };
type UseCaseCopy = Card & { tags: string[] };
type Faq = { question: string; answer: string };

export async function LandingPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['landing']);
  const list = <T,>(key: string) => t(key, { returnObjects: true }) as T[];
  const href = (path: string) => localizedPath(locale, path);
  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden="true" />

      <PublicNav />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Link href={href('/ios-app')} className={styles.announcementPill}>
              {t('landing.announcement')}
            </Link>
            <p className={styles.eyebrow}>{t('landing.eyebrow')}</p>
            <h1 className={styles.heroTitle}>{t('landing.heroTitle')}</h1>
            <p className={styles.heroSubtitle}>{t('landing.heroSubtitle')}</p>
            <div className={styles.heroActions}>
              <LandingAuthButtons
                showSignIn={false}
                signUpLabel={t('landing.saveFirst')}
                signedInLabel={t('landing.saveNext')}
              />
              <InstallCta className={styles.secondaryButton} />
            </div>
            <p className={styles.heroNote}>{t('landing.heroNote')}</p>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.floatingBadgeTop}>
              {t('landing.badgeTop')}
            </div>
            <div className={styles.floatingBadgeBottom}>
              {t('landing.badgeBottom')}
            </div>
            <div className={styles.heroCard}>
              <Image
                src={heroImage}
                alt={t('landing.heroAlt')}
                priority
                className={styles.heroImage}
              />
            </div>
          </div>
        </section>

        <section
          className={styles.sourceSection}
          aria-labelledby="source-heading"
        >
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>{t('landing.source.label')}</p>
            <h2 id="source-heading" className={styles.sectionTitle}>
              {t('landing.source.title')}
            </h2>
            <p className={styles.sectionBody}>{t('landing.source.body')}</p>
          </div>
          <div className={styles.sourceCategories}>
            {list<string>('landing.source.categories').map((category) => (
              <span key={category} className={styles.sourceCategory}>
                {category}
              </span>
            ))}
          </div>
          <div className={styles.sourcePills}>
            {sourceStores.map((store) => (
              <span key={store} className={styles.sourcePill}>
                {store}
              </span>
            ))}
          </div>
        </section>

        <section id="use-cases" className={styles.showcaseSection}>
          <div className={styles.showcaseCopy}>
            <p className={styles.sectionLabel}>{t('landing.useCases.label')}</p>
            <h2 className={styles.sectionTitle}>
              {t('landing.useCases.title')}
            </h2>
            <p className={styles.sectionBody}>{t('landing.useCases.body')}</p>
            <div className={styles.useCaseGrid}>
              {list<UseCaseCopy>('landing.useCases.items').map((useCase, i) => (
                <Link
                  key={useCaseLinks[i].href}
                  href={href(useCaseLinks[i].href)}
                  className={styles.useCaseCard}
                  style={
                    {
                      '--use-case-accent': useCaseLinks[i].accent,
                    } as React.CSSProperties
                  }
                >
                  <div className={styles.useCaseTags}>
                    {useCase.tags.map((tag) => (
                      <span key={tag} className={styles.useCaseTag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.description}</p>
                  <span className={styles.inlineCta}>
                    {t('landing.useCases.explore')}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.showcaseVisual}>
            <div className={styles.collectionFrame}>
              <Image
                src={collectionImage}
                alt={t('landing.collectionAlt')}
                className={styles.collectionImage}
              />
            </div>
            <div className={styles.checklistCard}>
              <p className={styles.checklistTitle}>
                {t('landing.checklist.title')}
              </p>
              <ul className={styles.checklist}>
                {list<string>('landing.checklist.items').map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.principlesSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>
              {t('landing.principles.label')}
            </p>
            <h2 className={styles.sectionTitle}>
              {t('landing.principles.title')}
            </h2>
          </div>
          <div className={styles.principlesGrid}>
            {list<Card>('landing.principles.items').map((principle) => (
              <article key={principle.title} className={styles.principleCard}>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="comparison" className={styles.comparisonSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>
              {t('landing.comparison.label')}
            </p>
            <h2 className={styles.sectionTitle}>
              {t('landing.comparison.title')}
            </h2>
            <p className={styles.sectionBody}>{t('landing.comparison.body')}</p>
          </div>
          <div className={styles.comparisonScroller}>
            <div className={styles.comparisonMatrix}>
              <div
                className={`${styles.matrixCell} ${styles.matrixCorner}`}
                aria-hidden="true"
              />
              {comparisonColumns.map((column) => (
                <div
                  key={column.key}
                  className={`${styles.matrixCell} ${styles.matrixHeader} ${column.highlight ? styles.matrixHeaderHighlight : ''}`}
                >
                  {t(column.labelKey)}
                </div>
              ))}

              {list<string>('landing.comparison.rows').map(
                (feature, rowIndex) => (
                  <Fragment key={feature}>
                    <div
                      className={`${styles.matrixCell} ${styles.matrixFeature}`}
                    >
                      {feature}
                    </div>
                    {comparisonColumns.map((column) => {
                      const value = comparisonValues[rowIndex][column.key];
                      return (
                        <div
                          key={column.key}
                          className={`${styles.matrixCell} ${styles.matrixValue} ${column.highlight ? styles.matrixValueHighlight : ''}`}
                          aria-label={`${t(column.labelKey)}: ${value ? t('landing.comparison.included') : t('landing.comparison.notIncluded')}`}
                        >
                          <span
                            className={
                              value ? styles.matrixCheck : styles.matrixOmission
                            }
                          >
                            {value ? '✓' : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </Fragment>
                ),
              )}
            </div>
          </div>
        </section>

        <section id="audiences" className={styles.audienceSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>
              {t('landing.audiences.label')}
            </p>
            <h2 className={styles.sectionTitle}>
              {t('landing.audiences.title')}
            </h2>
          </div>
          <div className={styles.audienceGrid}>
            {list<Card>('landing.audiences.items').map((audience) => (
              <article key={audience.title} className={styles.audienceCard}>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.questionsSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>
              {t('landing.questions.label')}
            </p>
            <h2 className={styles.sectionTitle}>
              {t('landing.questions.title')}
            </h2>
          </div>
          <div className={styles.questionsGrid}>
            {list<Faq>('landing.questions.items').map((item) => (
              <article key={item.question} className={styles.questionCard}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="privacy" className={styles.privacySection}>
          <div className={styles.privacyPanel}>
            <p className={styles.sectionLabel}>{t('landing.privacy.label')}</p>
            <h2 className={styles.sectionTitle}>
              {t('landing.privacy.title')}
            </h2>
            <p className={styles.sectionBody}>{t('landing.privacy.body')}</p>
          </div>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.sectionLabel}>{t('landing.final.label')}</p>
          <h2 className={styles.finalTitle}>{t('landing.final.title')}</h2>
          <p className={styles.finalBody}>{t('landing.final.body')}</p>
          <div className={styles.heroActions}>
            <LandingAuthButtons
              showSignIn={false}
              signUpLabel={t('landing.saveFirst')}
              signedInLabel={t('landing.saveNext')}
            />
            <InstallCta className={styles.secondaryButton} />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
