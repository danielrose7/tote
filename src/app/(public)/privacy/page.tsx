import type { Metadata } from "next";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy - Tote",
  description: "How Tote handles your data. No tracking, no ads, no selling your information.",
};

export default function PrivacyPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <a href="/" className={styles.logo}>tote</a>
        </nav>
      </header>

      <main className={styles.content}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.effective}>Effective February 23, 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Who we are</h2>
          <p>
            Tote (<a href="https://tote.tools">tote.tools</a>) is a product-saving
            tool that lets you keep track of items from any online store. Tote is
            operated by Bloom Interactive LLC (<a href="https://gobloom.io">gobloom.io</a>).
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>What data we collect</h2>
          <p>
            When you explicitly click &ldquo;Save to Tote&rdquo; (via the browser extension
            popup or context menu), we extract metadata from the current page:
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
            We only extract this metadata when you take an explicit action. Tote does
            not run in the background, scan your browsing history, or collect data from
            pages you don&rsquo;t save.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>How your data is stored and synced</h2>
          <p>
            Tote uses <a href="https://jazz.tools" target="_blank" rel="noopener noreferrer">Jazz</a>,
            a local-first sync engine. Your data is stored locally on your device first,
            then synced peer-to-peer with end-to-end encryption. This means your saved
            products live on your devices &mdash; not on a central server we control.
          </p>
          <p>
            All data is transmitted over HTTPS.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Authentication</h2>
          <p>
            Tote uses <a href="https://clerk.com" target="_blank" rel="noopener noreferrer">Clerk</a> for
            authentication. When you sign in, your email address and account information
            are sent to Clerk&rsquo;s servers. Clerk&rsquo;s handling of this data is governed by
            their <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Aggregate usage data</h2>
          <p>
            We may sync roll-up statistics to your account &mdash; for example, the number
            of collections, saved links, or shares &mdash; for subscription management and
            service limits. These stats contain no browsing history, page content, or
            personally identifiable information beyond what is already in your account.
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
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Third-party services</h2>
          <p>Tote relies on two third-party services:</p>
          <ul>
            <li>
              <strong>Clerk</strong> &mdash; Authentication and account
              management. <a href="https://clerk.com/legal/privacy" target="_blank" rel="noopener noreferrer">Clerk Privacy Policy</a>
            </li>
            <li>
              <strong>Jazz</strong> &mdash; Local-first data sync with end-to-end
              encryption. <a href="https://jazz.tools/privacy" target="_blank" rel="noopener noreferrer">Jazz Privacy Policy</a>
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Data deletion</h2>
          <p>
            You can delete any saved product or collection at any time from within Tote.
            If you want to delete your entire account, contact us and we will remove all
            associated data.
          </p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact</h2>
          <p>
            If you have questions about this privacy policy or how your data is handled,
            contact us at <a href="mailto:support@gobloom.io">support@gobloom.io</a> or
            visit <a href="https://gobloom.io" target="_blank" rel="noopener noreferrer">gobloom.io</a>.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} Tote &middot; Bloom Interactive LLC
      </footer>
    </div>
  );
}
