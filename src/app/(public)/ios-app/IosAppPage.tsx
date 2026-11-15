import Link from 'next/link';
import { LandingAuthButtons } from '@/components/LandingAuthButtons';
import { PublicFooter } from '@/components/PublicFooter';
import { PublicNav } from '@/components/PublicNav';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { withLink } from '@/i18n/richText';
import { getPublicT } from '@/i18n/server';
import { APP_STORE_URL } from '@/lib/constants';
import styles from './ios-app.module.css';

// Share-sheet targets in the phone mock. `id` picks the icon style; the label
// is translated like the real iOS sheet would be.
const shareTargets = [
  { id: 'AirDrop', labelKey: 'iosApp.mock.airdrop' },
  { id: 'Messages', labelKey: 'iosApp.mock.messages' },
  { id: 'Mail', labelKey: 'iosApp.mock.mail' },
  { id: 'Tote', labelKey: 'iosApp.mock.tote' },
] as const;

const shareActions = [
  'iosApp.mock.copy',
  'iosApp.mock.bookmarks',
  'iosApp.mock.readingList',
];

type Card = { title: string; description: string };

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

export async function IosAppPage({ locale }: { locale: Locale }) {
  const { t } = await getPublicT(locale, ['iosApp']);
  const list = <T,>(key: string) => t(key, { returnObjects: true }) as T[];
  // Docs and the privacy policy aren't translated yet: English URLs.
  const href = (path: string) => localizedPath(locale, path);
  const platforms = [
    { label: t('iosApp.platforms.web'), status: 'live' as const },
    { label: t('iosApp.platforms.browsers'), status: 'live' as const },
    {
      label: APP_STORE_URL
        ? t('iosApp.platforms.ios')
        : t('iosApp.platforms.iosSoon'),
      status: APP_STORE_URL ? ('live' as const) : ('pending' as const),
    },
  ];
  return (
    <div className={styles.page}>
      <PublicNav label={t('iosApp.navLabel')} />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t('iosApp.eyebrow')}</p>
            <h1>{t('iosApp.title')}</h1>
            <p className={styles.lead}>{t('iosApp.lead')}</p>
            <div className={styles.actions}>
              {APP_STORE_URL ? (
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryButton}
                >
                  {t('iosApp.getApp')}
                </a>
              ) : (
                <LandingAuthButtons
                  showSignIn={false}
                  signUpLabel={t('iosApp.createAccount')}
                />
              )}
            </div>
            <p className={styles.heroNote}>
              {APP_STORE_URL ? t('iosApp.noteLive') : t('iosApp.noteSoon')}
            </p>
            <p className={styles.trustLine}>
              {withLink(t('iosApp.trust'), (label) => (
                <Link href={href('/privacy')}>{label}</Link>
              ))}
            </p>
            <ul
              className={styles.platformList}
              aria-label={t('iosApp.platformsLabel')}
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
                        <strong>{t('iosApp.mock.product')}</strong>
                        <em>{t('iosApp.mock.site')}</em>
                      </span>
                    </div>
                    <div className={styles.phoneSheetApps}>
                      {shareTargets.map(({ id: target, labelKey }) => (
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
                          {t(labelKey)}
                        </span>
                      ))}
                    </div>
                    <div className={styles.phoneSheetActions}>
                      {shareActions.map((action) => (
                        <span key={action} className={styles.phoneSheetAction}>
                          <span className={styles.phoneSheetActionIcon} />
                          {t(action)}
                        </span>
                      ))}
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
            <p className={styles.eyebrow}>{t('iosApp.capture.label')}</p>
            <h2>{t('iosApp.capture.title')}</h2>
            <p>{t('iosApp.capture.body')}</p>
          </div>
          <ul className={styles.captureList}>
            {list<string>('iosApp.capture.details').map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>

        <section className={styles.workflowSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>{t('iosApp.workflows.label')}</p>
            <h2>{t('iosApp.workflows.title')}</h2>
          </div>
          <div className={styles.workflowGrid}>
            {list<Card>('iosApp.workflows.items').map((workflow) => (
              <article key={workflow.title} className={styles.workflowCard}>
                <h3>{workflow.title}</h3>
                <p>{workflow.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.docsCta}>
          <div>
            <p className={styles.eyebrow}>{t('iosApp.docs.label')}</p>
            <h2>{t('iosApp.docs.title')}</h2>
            <p>{t('iosApp.docs.body')}</p>
          </div>
          <Link href={href('/docs/ios-app')} className={styles.secondaryButton}>
            {t('iosApp.docs.open')}
          </Link>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>{t('iosApp.final.label')}</p>
          <h2>{t('iosApp.final.title')}</h2>
          <div className={styles.actions}>
            {APP_STORE_URL ? (
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryButton}
              >
                {t('iosApp.getApp')}
              </a>
            ) : (
              <LandingAuthButtons
                showSignIn={false}
                signUpLabel={t('iosApp.createAccount')}
              />
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
