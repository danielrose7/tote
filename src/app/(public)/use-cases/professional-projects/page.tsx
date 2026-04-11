import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../docs/docs.module.css';
import { AnswerBlock } from '../AnswerBlock';

export const metadata: Metadata = {
  title: 'Interior Design Sourcing Board for Client Projects',
  description:
    'Organize interior design sourcing by client and project. Save products from any supplier, share mood boards for approval, and track budgets in one place.',
  alternates: { canonical: '/use-cases/professional-projects' },
  openGraph: {
    title: 'Interior Design Sourcing Board for Client Projects — Tote',
    description:
      'Create sourcing boards for client projects, share mood boards for approval, and track budgets across suppliers.',
  },
};

export default function ProfessionalProjectsPage() {
  return (
    <article className={styles.article}>
      <h1>Create sourcing boards clients can actually review</h1>
      <p className={styles.lead}>
        You&apos;re sourcing for three clients, each with their own stores,
        budget, and taste. The current setup is a spreadsheet, a PDF mood board,
        and an email chain. Tote keeps every project separate and shareable — no
        PDF required.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <rect
            x="10"
            y="10"
            width="60"
            height="60"
            rx="6"
            fill="var(--color-blush)"
            opacity="0.8"
          />
          <rect
            x="80"
            y="10"
            width="60"
            height="60"
            rx="6"
            fill="var(--color-blush)"
            opacity="0.55"
          />
          <rect
            x="10"
            y="80"
            width="60"
            height="60"
            rx="6"
            fill="var(--color-blush)"
            opacity="0.55"
          />
          <rect
            x="80"
            y="80"
            width="60"
            height="60"
            rx="6"
            fill="var(--color-blush)"
            opacity="0.8"
          />
          <circle cx="30" cy="18" r="5" fill="var(--color-blush)" />
          <circle cx="100" cy="18" r="5" fill="var(--color-blush)" />
          <circle cx="30" cy="88" r="5" fill="var(--color-blush)" />
          <circle cx="100" cy="88" r="5" fill="var(--color-blush)" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">
          Get started — it&apos;s free &rarr;
        </a>
      </p>

      <AnswerBlock
        question="How do you keep sourcing decisions usable across client projects?"
        answer="Save products from different suppliers into one client-facing board, come back later to compare them, keep the shortlist and budget moving, and share the same link for review. Tote keeps sourcing usable after the first round of saves."
        accent="var(--color-blush)"
        steps={[
          'Save products from suppliers, retailers, and trade sites',
          'Compare options and keep the shortlist moving',
          'Share one board with your client for review',
        ]}
      />

      <p>
        You&apos;re sourcing materials for three clients at once. Each project
        has its own set of stores, budgets, and preferences. You&apos;re saving
        links in spreadsheets, emailing mood board PDFs, and losing track of
        which option the client liked. When prices change, your spreadsheet is
        already stale.
      </p>

      <h2>From sourcing links to a client-ready shortlist</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Save from every supplier</h3>
        <p className={styles.cardDescription}>
          Trade sites, retail stores, wholesale suppliers, brand sites.
          Everything lands in one board instead of getting split across
          spreadsheets and PDFs.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep the shortlist moving</h3>
        <p className={styles.cardDescription}>
          Compare options by room or category, keep the budget visible, and
          narrow the board to what the client actually needs to review.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share one client-ready board</h3>
        <p className={styles.cardDescription}>
          Send one link instead of a PDF, a spreadsheet, and an email thread.
          The client sees the same shortlist you are working from.
        </p>
      </div>

      <h2>Try this setup</h2>
      <p>A clean sourcing workflow usually stays simple:</p>
      <ul>
        <li>Create one collection per client or per project phase</li>
        <li>
          Add slots only where they help the review: &ldquo;Living Room&rdquo;,
          &ldquo;Lighting&rdquo;, &ldquo;Tile&rdquo;, or &ldquo;Hardware&rdquo;
        </li>
        <li>
          Set a budget before you share and use selections to highlight the
          shortlist you want the client to review
        </li>
      </ul>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li>
          <span>
            <strong>Source from anywhere.</strong> Browse supplier websites,
            retail stores, and trade sites. Save products to the right client
            collection using the Chrome extension.
          </span>
        </li>
        <li>
          <span>
            <strong>Organize your picks.</strong> Use slots to group options by
            room or category. Mark your recommended selections. Set budgets to
            stay within the client&apos;s range.
          </span>
        </li>
        <li>
          <span>
            <strong>Share and get feedback.</strong> Send a public link to the
            client. They see a polished mood board with everything laid out.
            Update and reshare as many times as you need.
          </span>
        </li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Clients do not need every option you found. They need the shortlist
          you are ready to stand behind.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can I manage multiple client projects?</h3>
      <p>
        Absolutely. Create a separate collection for each client or project.
        They&apos;re completely independent — different items, different
        budgets, different sharing settings.
      </p>

      <h3>Can clients view without editing?</h3>
      <p>
        Make the collection public and share the link. Clients can browse the
        board, see images and prices, and click through to products — but they
        can&apos;t modify anything.
      </p>

      <h3>How do I share a mood board for approval?</h3>
      <p>
        Make the collection public, then send the link to your client. They see
        a visual board with all your curated options. You can update the
        collection anytime and the link stays the same.
      </p>

      <h3>Does it work with trade and wholesale sites?</h3>
      <p>
        Tote works with any website that has product pages — trade sites, retail
        stores, wholesale suppliers, all of it. If you can view it in a browser,
        you can save it.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li>
          <Link href="/use-cases/home-renovation">Home Renovation</Link> — the
          same room-by-room approach for personal projects
        </li>
        <li>
          <Link href="/use-cases/personal-style">
            Wardrobe &amp; Style Board
          </Link>{' '}
          — curate style boards for personal or client wardrobes
        </li>
        <li>
          <Link href="/use-cases/family-shopping">Shared Family Shopping</Link>{' '}
          — collaborative shopping for group projects
        </li>
      </ul>

      <p>
        <a href="https://tote.tools/collections">
          Try Tote — it&apos;s free &rarr;
        </a>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Can I manage multiple client projects?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Absolutely. Create a separate collection for each client or project. They're completely independent — different items, different budgets, different sharing settings.",
                },
              },
              {
                '@type': 'Question',
                name: 'Can clients view without editing?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Make the collection public and share the link. Clients can browse the board, see images and prices, and click through to products — but they can't modify anything.",
                },
              },
              {
                '@type': 'Question',
                name: 'How do I share a mood board for approval?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Make the collection public, then send the link to your client. They see a visual board with all your curated options. You can update the collection anytime and the link stays the same.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does it work with trade and wholesale sites?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Tote works with any website that has product pages — trade sites, retail stores, wholesale suppliers, all of it. If you can view it in a browser, you can save it.',
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
