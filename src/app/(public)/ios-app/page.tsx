import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingAuthButtons } from '@/components/LandingAuthButtons';
import { PublicFooter } from '@/components/PublicFooter';
import { APP_STORE_URL } from '@/lib/constants';
import styles from './ios-app.module.css';

const platforms = [
  { label: 'Web app', status: 'live' as const },
  { label: 'Chrome, Edge, Brave, Arc', status: 'live' as const },
  {
    label: APP_STORE_URL ? 'iPhone' : 'iPhone — pending App Store review',
    status: APP_STORE_URL ? ('live' as const) : ('pending' as const),
  },
];

export const metadata: Metadata = {
  title: 'iOS App — Tote',
  description:
    'Save products from Safari or any app using the Tote iOS Share Sheet extension, then browse and organize your collections on the go.',
  alternates: { canonical: '/ios-app' },
  openGraph: {
    title: 'Tote for iPhone',
    description:
      'Save from Safari or any app with the Tote Share Sheet extension. Browse collections, track budgets, and pick up where you left off.',
  },
};

const captureDetails = [
  'Product name, image, price, store, and source URL',
  'Save via the Share Sheet from Safari or any app',
  'Collection and slot selection before saving',
  'Sync with your Tote account across the app, web, and browser extension',
];

const workflows = [
  {
    title: 'Save from wherever you find it',
    description:
      'See something in Safari, Instagram, or Messages? Share it to Tote in two taps and keep scrolling.',
  },
  {
    title: 'Pick up right where you left off',
    description:
      'Your collections, slots, and selections are the same ones you left on the web — no separate mobile account to manage.',
  },
  {
    title: 'Compare on the go',
    description:
      'Browse a collection, refresh prices, and narrow the shortlist from your phone whenever you have a minute.',
  },
];

export default function IosAppPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="iOS app page">
          <Link href="/" className={styles.wordmark}>
            tote
          </Link>
          <div className={styles.navLinks}>
            <Link href="/docs/ios-app">Docs</Link>
            <Link href="/chrome-extension">Chrome Extension</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Tote for iPhone</p>
            <h1>Save from Safari without opening a tab.</h1>
            <p className={styles.lead}>
              The Tote iOS app adds a Share Sheet extension so you can save a
              product from Safari, or from any app that can share a link,
              straight into the collection where you&apos;re making the
              decision.
            </p>
            <div className={styles.actions}>
              {APP_STORE_URL ? (
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryButton}
                >
                  Get it on the App Store
                </a>
              ) : (
                <LandingAuthButtons
                  showSignIn={false}
                  signUpLabel="Create a Tote account"
                  signedInLabel="Open Tote"
                />
              )}
            </div>
            <p className={styles.heroNote}>
              {APP_STORE_URL
                ? 'Sign in with the same account you already use on tote.tools or in the browser extension — everything you’ve saved is waiting for you.'
                : 'Tote for iOS is finishing App Store review. Sign up today with the same account that already works on the web and in the browser extension, and everything will be waiting the moment the app goes live.'}
            </p>
            <p className={styles.trustLine}>
              Private by design — no ads, no tracking, no selling your shopping
              data, on the web app, the browser extension, and the iOS app
              alike. Read the <Link href="/privacy">privacy policy</Link>.
            </p>
            <ul
              className={styles.platformList}
              aria-label="Tote platform availability"
            >
              {platforms.map((platform) => (
                <li
                  key={platform.label}
                  className={
                    platform.status === 'live'
                      ? styles.platformItemLive
                      : styles.platformItemPending
                  }
                >
                  <span className={styles.platformDot} aria-hidden="true" />
                  {platform.label}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneStatusBar}>
                  <span>9:41</span>
                </div>
                <div className={styles.phoneSheet}>
                  <div className={styles.phoneSheetHandle} />
                  <p className={styles.phoneSheetTitle}>Share</p>
                  <div className={styles.phoneSheetApps}>
                    <span className={styles.phoneSheetApp}>Mail</span>
                    <span className={styles.phoneSheetApp}>Messages</span>
                    <span
                      className={`${styles.phoneSheetApp} ${styles.phoneSheetAppActive}`}
                    >
                      Tote
                    </span>
                    <span className={styles.phoneSheetApp}>Notes</span>
                  </div>
                  <div className={styles.phoneSheetRow}>
                    <span>Save to</span>
                    <strong>Living Room</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.captureSection}>
          <div>
            <p className={styles.eyebrow}>What it captures</p>
            <h2>Enough detail to compare later.</h2>
            <p>
              Tote reads the page you&apos;re sharing and fills in the useful
              parts automatically. You can still edit the saved product in Tote
              when a store page is unusually sparse.
            </p>
          </div>
          <ul className={styles.captureList}>
            {captureDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>

        <section className={styles.workflowSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>How people use it</p>
            <h2>Built for the moment you find something worth saving.</h2>
          </div>
          <div className={styles.workflowGrid}>
            {workflows.map((workflow) => (
              <article key={workflow.title} className={styles.workflowCard}>
                <h3>{workflow.title}</h3>
                <p>{workflow.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.docsCta}>
          <div>
            <p className={styles.eyebrow}>Need the details?</p>
            <h2>Set up, save, and troubleshoot.</h2>
            <p>
              The iOS guide covers signing in, enabling Tote in the Share Sheet,
              what gets captured, and what to do when a saved item doesn&apos;t
              show up.
            </p>
          </div>
          <Link href="/docs/ios-app" className={styles.secondaryButton}>
            Open iOS app docs
          </Link>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>Start saving</p>
          <h2>Your collections are ready before the app is.</h2>
          <div className={styles.actions}>
            {APP_STORE_URL ? (
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryButton}
              >
                Get it on the App Store
              </a>
            ) : (
              <LandingAuthButtons
                showSignIn={false}
                signUpLabel="Create a Tote account"
                signedInLabel="Open Tote"
              />
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
