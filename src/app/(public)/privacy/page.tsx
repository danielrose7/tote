import type { Metadata } from 'next';
import styles from './privacy.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy - Tote',
  description:
    'How Tote handles your data. No tracking, no ads, no selling your information.',
};

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <a href="/" className={styles.logo}>
            tote
          </a>
        </nav>
      </header>

      <main className={styles.content}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.effective}>Effective June 19, 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Who we are</h2>
          <p>
            Tote (<a href="https://tote.tools">tote.tools</a>) is a
            product-saving tool that lets you keep track of items from any
            online store. Tote is operated by Bloom Interactive LLC (
            <a href="https://gobloom.io">gobloom.io</a>).
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>What data we collect</h2>
          <p>
            When you explicitly save a product &mdash; via the browser extension
            popup, the iOS Share Sheet, or the in-app save flow &mdash; we
            extract metadata from that page:
          </p>
          <ul>
            <li>Page title</li>
            <li>Product description</li>
            <li>Image URL</li>
            <li>Price and currency</li>
            <li>Brand name</li>
            <li>Page URL</li>
          </ul>
          <p>
            We only extract this metadata when you take an explicit action. Tote
            does not run in the background, scan your browsing history, or
            collect data from pages you don&rsquo;t save.
          </p>
          <p>
            The iOS Share Extension reads only the URL you share to it. It does
            not access any other content from the app you are sharing from.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            How your data is stored and synced
          </h2>
          <p>
            Your collections and saved products are stored in a hosted Postgres
            database provided by{' '}
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
            >
              Neon
            </a>
            . Data is encrypted at rest by Neon and transmitted over HTTPS.
          </p>
          <p>
            Tote uses{' '}
            <a
              href="https://ably.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ably
            </a>{' '}
            to push real-time updates when your collections change across
            devices. Ably receives only change notification signals containing
            collection identifiers &mdash; not product titles, URLs, prices, or
            any other product data.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Authentication</h2>
          <p>
            Tote uses{' '}
            <a
              href="https://clerk.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Clerk
            </a>{' '}
            for authentication. You can sign in with Google, Apple, or email.
            When you sign in, your account information is sent to Clerk&rsquo;s
            servers. Clerk&rsquo;s handling of this data is governed by their{' '}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              privacy policy
            </a>
            .
          </p>
          <p>
            If you use Sign in with Apple, Apple may anonymize your email
            address before sharing it. Tote does not receive any additional
            information from Apple beyond what is needed to create or identify
            your account.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Aggregate usage data</h2>
          <p>
            We may sync roll-up statistics to your account &mdash; for example,
            the number of collections, saved links, or shares &mdash; for
            subscription management and service limits. These stats contain no
            browsing history, page content, or personally identifiable
            information beyond what is already in your account.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Public collections</h2>
          <p>
            Tote lets you optionally share a collection as a public link. This
            is entirely opt-in &mdash; collections are private by default.
          </p>
          <p>
            When you publish a collection, the product metadata it contains
            (titles, descriptions, images, prices, and URLs) becomes publicly
            accessible to anyone with the link. Published collections may also
            be indexed by search engines.
          </p>
          <p>
            You can unpublish a collection at any time, which removes the public
            copy. You remain in control of what you share and when.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>What we don&rsquo;t do</h2>
          <ul>
            <li>No analytics or tracking scripts</li>
            <li>No browsing history collection</li>
            <li>No advertising</li>
            <li>No selling or sharing your data with third parties</li>
            <li>No profiling or behavioral targeting</li>
            <li>
              No use of advertising identifiers (IDFA) or cross-app tracking
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Third-party services</h2>
          <p>Tote relies on the following third-party services:</p>
          <ul>
            <li>
              <strong>Clerk</strong> &mdash; Authentication and account
              management.{' '}
              <a
                href="https://clerk.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Clerk Privacy Policy
              </a>
            </li>
            <li>
              <strong>Neon</strong> &mdash; Hosted Postgres database where your
              collections and saved products are stored. Data is encrypted at
              rest.{' '}
              <a
                href="https://neon.tech/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Neon Privacy Policy
              </a>
            </li>
            <li>
              <strong>Ably</strong> &mdash; Real-time change notifications so
              your collections stay in sync across devices. Ably receives only
              collection identifiers, not product data.{' '}
              <a
                href="https://ably.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ably Privacy Policy
              </a>
            </li>
            <li>
              <strong>Vercel</strong> &mdash; Hosts and serves the Tote web
              application. All web traffic passes through Vercel&rsquo;s
              infrastructure.{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel Privacy Policy
              </a>
            </li>
            <li>
              <strong>Apple</strong> &mdash; Sign in with Apple (iOS only).
              Governed by{' '}
              <a
                href="https://www.apple.com/legal/privacy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple&rsquo;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Anthropic</strong> &mdash; Powers the AI chat feature.
              When you use the chat assistant, your query and relevant product
              and collection data are sent to Anthropic&rsquo;s API to generate
              a response. This only occurs when you actively use the chat
              feature.{' '}
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Anthropic Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Brave Search</strong> &mdash; The AI chat feature may
              query Brave Search to look up current product information on your
              behalf. Search queries contain only product-related terms, not
              personal information.{' '}
              <a
                href="https://search.brave.com/help/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Brave Search Privacy Policy
              </a>
              .
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Data deletion</h2>
          <p>
            You can delete any saved product or collection at any time from
            within Tote. To delete your entire account and all associated data,
            go to <strong>Settings</strong> on the web or in the iOS app and use
            the <strong>Delete Account</strong> option, or contact us at{' '}
            <a href="mailto:support@gobloom.io">support@gobloom.io</a>.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact</h2>
          <p>
            If you have questions about this privacy policy or how your data is
            handled, contact us at{' '}
            <a href="mailto:support@gobloom.io">support@gobloom.io</a> or visit{' '}
            <a
              href="https://gobloom.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              gobloom.io
            </a>
            .
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} Tote &middot; Bloom Interactive LLC
      </footer>
    </div>
  );
}
