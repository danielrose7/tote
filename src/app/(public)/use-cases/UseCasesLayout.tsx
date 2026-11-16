import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import styles from '../templates/templates.module.css';
import { USE_CASE_SLUGS } from './useCasesConfig';
import { UseCasesSidebar } from './UseCasesSidebar';

/** Shared chrome for /use-cases and /es/use-cases: nav, sidebar, footer. */
export async function UseCasesLayout({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const { t } = await getPublicT(locale, ['useCases']);
  const items = [
    { href: '/use-cases', label: t('useCases.nav.overview') },
    ...USE_CASE_SLUGS.map((slug) => ({
      href: `/use-cases/${slug}`,
      label: t(`useCases.nav.${slug}`),
    })),
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t('useCases.site.name'),
    url: `https://tote.tools${localizedPath(locale, '/use-cases')}`,
    description: t('useCases.site.description'),
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
      <PublicNav label={t('useCases.navLabel')} />

      <div className={styles.layout}>
        <UseCasesSidebar
          locale={locale}
          label={t('useCases.sidebarLabel')}
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
