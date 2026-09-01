import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingAuthButtons } from '@/components/LandingAuthButtons';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import { APP_STORE_URL } from '@/lib/constants';
import styles from './ios-app.module.css';

const platforms = [
  { label: 'Web app', status: 'live' as const },
  { label: 'Chrome, Edge, Brave, Arc', status: 'live' as const },
  {
    label: APP_STORE_URL ? 'iPhone and iPad' : 'iPhone and iPad — coming soon',
    status: APP_STORE_URL ? ('live' as const) : ('pending' as const),
  },
];

export const metadata: Metadata = {
  title: 'iOS App for iPhone and iPad — Tote',
  description:
    'Tap Share, then Tote, to save a product from Safari or any app. Browse and organize your collections on iPhone and iPad.',
  alternates: { canonical: '/ios-app' },
  openGraph: {
    title: 'Tote for iPhone and iPad',
    description:
      'Tap Share, then Tote, to save from Safari or any app. Browse collections, track budgets, and pick up where you left off — on iPhone and iPad.',
  },
};

const captureDetails = [
  'Product name, image, price, and source URL',
  'Saved with the Share button, from Safari or any app',
  'Collection and slot selection before saving',
  'Sync across iPhone, iPad, web, and the browser extension',
];

const workflows = [
  {
    title: 'Save from wherever you find it',
    description:
      'If an app has a Share button, it can save to Tote — a store page, a link a friend sent you, a post you scrolled past.',
  },
  {
    title: 'Pick up right where you left off',
    description:
      'Your collections, slots, and selections are the same ones you left on the web — no separate mobile account to manage.',
  },
  {
    title: 'Compare on the bigger screen',
    description:
      'One app for both devices. On iPad, collections spread out into a wider grid, so comparing a shortlist side by side is easy.',
  },
];

const shareTargets = ['AirDrop', 'Messages', 'Mail', 'Tote'] as const;

type GlyphProps = { className?: string };

/** Cellular / wi-fi / battery, at the proportions iOS actually draws them. */
function StatusIcons({ className }: GlyphProps) {
  return (
    <span className={className}>
      <svg viewBox="0 0 18 12" role="presentation">
        <path
          fill="currentColor"
          d="M0 9h3v3H0zM5 6h3v6H5zM10 3h3v9h-3zM15 0h3v12h-3z"
        />
      </svg>
      <svg viewBox="0 0 16 12" role="presentation">
        <path
          fill="currentColor"
          d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.4 6.8 1.7 5.1a9 9 0 0 1 12.6 0l-1.7 1.7a6.6 6.6 0 0 0-9.2 0z"
        />
      </svg>
      <svg viewBox="0 0 26 12" role="presentation">
        <rect
          x="0.5"
          y="0.5"
          width="21"
          height="11"
          rx="3.5"
          fill="none"
          stroke="currentColor"
          opacity="0.5"
        />
        <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
        <path
          fill="currentColor"
          opacity="0.5"
          d="M23 4.2c1.4.4 1.4 3.2 0 3.6z"
        />
      </svg>
    </span>
  );
}

/** Stand-in "product" in the mock: a table lamp, readable at any size. */
function ProductGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <ellipse cx="32" cy="20" rx="16" ry="12" fill="#fbe3a8" opacity="0.5" />
      <path d="M25 9h14l7 17H18z" fill="#2f3d63" />
      <path d="M25 9h14l1.6 4H23.4z" fill="#48598a" />
      <rect x="30.6" y="26" width="2.8" height="23" fill="#2f3d63" />
      <ellipse cx="32" cy="50" rx="11" ry="3.4" fill="#2f3d63" />
    </svg>
  );
}

function ChairGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <rect x="18" y="11" width="28" height="24" rx="10" fill="#2f3d63" />
      <rect x="13" y="29" width="38" height="13" rx="6" fill="#48598a" />
      <rect x="18" y="42" width="3.2" height="10" rx="1.6" fill="#2f3d63" />
      <rect x="42.8" y="42" width="3.2" height="10" rx="1.6" fill="#2f3d63" />
    </svg>
  );
}

function MugGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <path
        d="M42 26h3.5a7 7 0 0 1 0 14H42"
        fill="none"
        stroke="#48598a"
        strokeWidth="4"
      />
      <rect x="17" y="20" width="25" height="28" rx="7" fill="#2f3d63" />
      <rect x="21" y="25" width="17" height="3" rx="1.5" fill="#48598a" />
    </svg>
  );
}

function PlantGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <path d="M32 37c-1-11-6-16-13-18 0 11 5 17 13 18Z" fill="#48598a" />
      <path d="M32 37c1-12 6-18 13-20 0 12-5 19-13 20Z" fill="#2f3d63" />
      <path d="M22 38h20l-2.6 14H24.6z" fill="#2f3d63" />
      <rect x="21" y="36" width="22" height="4" rx="2" fill="#48598a" />
    </svg>
  );
}

function SneakerGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <path
        d="M13 41c0-6 3-9 7-12l7 6 9 2c6 1 11 3 13 6v2H13z"
        fill="#2f3d63"
      />
      <rect x="11" y="43" width="42" height="6" rx="3" fill="#48598a" />
    </svg>
  );
}

function ClockGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="presentation">
      <circle cx="32" cy="32" r="18" fill="#2f3d63" />
      <circle cx="32" cy="32" r="13" fill="#48598a" />
      <path
        d="M32 24v9h6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cycled through the iPad grid so the mock reads as a real mixed collection. */
const gridGlyphs = [
  ChairGlyph,
  ProductGlyph,
  PlantGlyph,
  MugGlyph,
  ClockGlyph,
  SneakerGlyph,
];

export default function IosAppPage() {
  return (
    <div className={styles.page}>
      <PublicNav label="iOS app page" />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Tote for iPhone and iPad</p>
            <h1>Tap Share. Tap Tote. Done.</h1>
            <p className={styles.lead}>
              Found something you might buy? Hit the Share button, pick Tote,
              and it lands straight in the collection where you&apos;re making
              the decision — no copying links, no extra tab.
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
                : 'Tote for iPhone and iPad is coming soon. Sign up today with the same account that already works on the web and in the browser extension, and everything will be waiting the moment the app goes live.'}
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
            <div className={styles.tabletBevel}>
              <div className={styles.tabletCasing}>
                <div className={styles.tabletScreen}>
                  <div className={styles.tabletBar}>
                    <span />
                    <span />
                  </div>
                  <div className={styles.tabletGrid}>
                    {Array.from({ length: 12 }).map((_, index) => {
                      const Glyph = gridGlyphs[index % gridGlyphs.length];
                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative grid
                        <span key={index} className={styles.tabletCard}>
                          <Glyph className={styles.tabletCardGlyph} />
                        </span>
                      );
                    })}
                  </div>
                  <div className={styles.tabletGlint} />
                </div>
              </div>
            </div>

            <div className={styles.phoneBevel}>
              <div className={styles.phoneCasing}>
                <div className={styles.phoneScreen}>
                  <div className={styles.phoneStatusBar}>
                    <span className={styles.phoneStatusTime}>5:13</span>
                    <StatusIcons className={styles.phoneStatusIcons} />
                  </div>
                  <div className={styles.phoneIsland} />

                  <div className={styles.phonePage}>
                    <div className={styles.phonePageBar}>
                      <span className={styles.phonePageWordmark} />
                      <span className={styles.phonePageIcons} />
                    </div>
                    <div className={styles.phoneProduct}>
                      <ProductGlyph className={styles.phoneProductGlyph} />
                    </div>
                  </div>

                  <div className={styles.phoneSheet}>
                    <div className={styles.phoneSheetHeader}>
                      <span className={styles.phoneSheetThumb}>
                        <ProductGlyph className={styles.phoneThumbGlyph} />
                      </span>
                      <span className={styles.phoneSheetMeta}>
                        <strong>Cool thing</strong>
                        <em>ifound.com</em>
                      </span>
                    </div>
                    <div className={styles.phoneSheetApps}>
                      {shareTargets.map((target) => (
                        <span key={target} className={styles.phoneSheetApp}>
                          <span
                            className={`${styles.phoneSheetAppIcon} ${
                              styles[`icon${target}`]
                            }`}
                          >
                            {target === 'Tote' ? (
                              <>
                                <span className={styles.toteGlow} />
                                <span className={styles.toteSparkles}>
                                  <i />
                                  <i />
                                  <i />
                                  <i />
                                </span>
                                {/* biome-ignore lint/performance/noImgElement: a
                                    4.5KB static PNG at a fixed 38px — next/image
                                    would bill an optimization transform for no
                                    gain. */}
                                <img
                                  src="/tote-app-icon.png"
                                  alt=""
                                  width="38"
                                  height="38"
                                  className={styles.toteIconImage}
                                />
                              </>
                            ) : null}
                          </span>
                          {target}
                        </span>
                      ))}
                    </div>
                    <div className={styles.phoneSheetActions}>
                      {['Copy', 'Add to Bookmarks', 'Add to Reading List'].map(
                        (action) => (
                          <span
                            key={action}
                            className={styles.phoneSheetAction}
                          >
                            <span className={styles.phoneSheetActionIcon} />
                            {action}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div className={styles.phoneGlint} />
                  <div className={styles.phoneWash} />
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
              The iOS guide covers signing in, adding Tote to your Share
              options, what gets captured, and what to do when a saved item
              doesn&apos;t show up.
            </p>
          </div>
          <Link href="/docs/ios-app" className={styles.secondaryButton}>
            Open iOS app docs
          </Link>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>Start saving</p>
          <h2>Everything you&apos;ve saved is already in the app.</h2>
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
