import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import { DOC_SLUGS } from './docsConfig';
import styles from './docs.module.css';

export async function DocsIndexPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['docs']);
  return (
    <article className={styles.article}>
      <h1>{t('docs.index.title')}</h1>
      <p className={styles.lead}>{t('docs.index.lead')}</p>

      <h2>{t('docs.index.guidesHeading')}</h2>
      <p>{t('docs.index.guidesIntro')}</p>

      {DOC_SLUGS.map((slug) => (
        <div className={styles.card} key={slug}>
          <h3 className={styles.cardTitle}>{t(`docs.nav.${slug}`)}</h3>
          <p className={styles.cardDescription}>
            {t(`docs.index.cards.${slug}.description`)}
          </p>
          <Link href={localizedPath(locale, `/docs/${slug}`)}>
            {t(`docs.index.cards.${slug}.linkText`)} &rarr;
          </Link>
        </div>
      ))}

      <h2>{t('docs.index.useCasesHeading')}</h2>
      <p>{t('docs.index.useCasesIntro')}</p>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('docs.index.useCasesTitle')}</h3>
        <p className={styles.cardDescription}>
          {t('docs.index.useCasesDescription')}
        </p>
        <Link href={localizedPath(locale, '/use-cases')}>
          {t('docs.index.useCasesLink')} &rarr;
        </Link>
      </div>
    </article>
  );
}
