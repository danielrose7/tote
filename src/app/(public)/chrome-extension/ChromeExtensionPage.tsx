import Image from 'next/image';
import Link from 'next/link';
import { InstallLabel } from '@/components/InstallLabel';
import { LandingAuthButtons } from '@/components/LandingAuthButtons';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import { CHROME_WEB_STORE_URL } from '@/lib/constants';
import extensionImage from '@/product-images-01.png';
import styles from './chrome-extension.module.css';

// Browser names: not translated.
const browserSupport = ['Chrome', 'Edge', 'Brave', 'Arc'];

type Card = { title: string; description: string };

export async function ChromeExtensionPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['chromeExtension']);
  const list = <T,>(key: string) => t(key, { returnObjects: true }) as T[];
  // Docs aren't translated yet, so this stays the English URL in every locale.
  const docsHref = localizedPath(locale, '/docs/extension');
  return (
    <div className={styles.page}>
      <PublicNav label={t('chromeExtension.navLabel')} />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t('chromeExtension.eyebrow')}</p>
            <h1>{t('chromeExtension.title')}</h1>
            <p className={styles.lead}>{t('chromeExtension.lead')}</p>
            <div className={styles.actions}>
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryButton}
              >
                <InstallLabel />
              </a>
              <Link href={docsHref} className={styles.secondaryButton}>
                {t('chromeExtension.setupGuide')}
              </Link>
            </div>
            <ul
              className={styles.browserList}
              aria-label={t('chromeExtension.supportedBrowsers')}
            >
              {browserSupport.map((browser) => (
                <li key={browser}>{browser}</li>
              ))}
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <Image
              src={extensionImage}
              alt={t('chromeExtension.heroAlt')}
              priority
              className={styles.heroImage}
            />
          </div>
        </section>

        <section className={styles.captureSection}>
          <div>
            <p className={styles.eyebrow}>
              {t('chromeExtension.capture.label')}
            </p>
            <h2>{t('chromeExtension.capture.title')}</h2>
            <p>{t('chromeExtension.capture.body')}</p>
          </div>
          <ul className={styles.captureList}>
            {list<string>('chromeExtension.capture.details').map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>

        <section className={styles.workflowSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>
              {t('chromeExtension.workflows.label')}
            </p>
            <h2>{t('chromeExtension.workflows.title')}</h2>
          </div>
          <div className={styles.workflowGrid}>
            {list<Card>('chromeExtension.workflows.items').map((workflow) => (
              <article key={workflow.title} className={styles.workflowCard}>
                <h3>{workflow.title}</h3>
                <p>{workflow.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.docsCta}>
          <div>
            <p className={styles.eyebrow}>{t('chromeExtension.docs.label')}</p>
            <h2>{t('chromeExtension.docs.title')}</h2>
            <p>{t('chromeExtension.docs.body')}</p>
          </div>
          <Link href={docsHref} className={styles.secondaryButton}>
            {t('chromeExtension.docs.open')}
          </Link>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>{t('chromeExtension.final.label')}</p>
          <h2>{t('chromeExtension.final.title')}</h2>
          <div className={styles.actions}>
            <LandingAuthButtons
              showSignIn={false}
              signUpLabel={t('chromeExtension.final.createAccount')}
            />
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.secondaryButton}
            >
              <InstallLabel />
            </a>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
