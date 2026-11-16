import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import styles from '../templates/templates.module.css';
import { DOC_SLUGS } from './docsConfig';
import { DocsSidebar } from './DocsSidebar';

/** Shared chrome for /docs and /es/docs: nav, sidebar, footer. */
export async function DocsLayout({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const { t } = await getPublicT(locale, ['docs']);
  const items = [
    { href: '/docs', label: t('docs.nav.overview') },
    ...DOC_SLUGS.map((slug) => ({
      href: `/docs/${slug}`,
      label: t(`docs.nav.${slug}`),
    })),
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t('docs.site.name'),
    url: `https://tote.tools${localizedPath(locale, '/docs')}`,
    description: t('docs.site.description'),
    inLanguage: locale,
    publisher: {
      '@type': 'Organization',
      name: 'Tote',
      url: 'https://tote.tools',
    },
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav label={t('docs.navLabel')} />

      <div className={styles.layout}>
        <DocsSidebar
          locale={locale}
          label={t('docs.sidebarLabel')}
          items={items}
        />
        <main className={`${styles.main} ${styles.mainReadable}`}>
          {children}
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}
