import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Professional Design & Client Projects",
  description:
    "Manage material sourcing across multiple clients. Organize options by project, share curated mood boards for approval, and track budgets per client.",
  alternates: { canonical: "/use-cases/professional-projects" },
  openGraph: {
    title: "Professional Design & Client Projects — Tote",
    description:
      "Manage sourcing across multiple clients. Share curated mood boards for approval and track budgets per project.",
  },
};

export default function ProfessionalProjectsPage() {
  return (
    <article className={styles.article}>
      <h1>Sourcing and mood boards your clients can actually use</h1>
      <p className={styles.lead}>
        Interior designers, contractors, and stylists juggle sourcing across dozens of stores and multiple clients. Tote keeps every project organized and shareable.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <rect x="10" y="10" width="60" height="60" rx="6" fill="var(--color-blush)" opacity="0.8" />
          <rect x="80" y="10" width="60" height="60" rx="6" fill="var(--color-blush)" opacity="0.55" />
          <rect x="10" y="80" width="60" height="60" rx="6" fill="var(--color-blush)" opacity="0.55" />
          <rect x="80" y="80" width="60" height="60" rx="6" fill="var(--color-blush)" opacity="0.8" />
          <circle cx="30" cy="18" r="5" fill="var(--color-blush)" />
          <circle cx="100" cy="18" r="5" fill="var(--color-blush)" />
          <circle cx="30" cy="88" r="5" fill="var(--color-blush)" />
          <circle cx="100" cy="88" r="5" fill="var(--color-blush)" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <h2>The problem</h2>
      <p>
        You&apos;re sourcing materials for three clients at once. Each project has its own set of stores, budgets, and preferences. You&apos;re saving links in spreadsheets, emailing mood board PDFs, and losing track of which option the client liked. When prices change, your spreadsheet is already stale.
      </p>

      <h2>How Tote helps</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>One collection per client or project</h3>
        <p className={styles.cardDescription}>
          Create separate collections for each client or project. Use slots to organize by room, category, or material type. Switch between projects without mixing anything up.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share for client approval</h3>
        <p className={styles.cardDescription}>
          Make a collection public and send the link to your client. They see a clean, visual board with images, prices, and links — no account required. Perfect for review meetings and sign-off.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Track project budgets</h3>
        <p className={styles.cardDescription}>
          Set a budget for each project or category. As you select items, the running total updates automatically. Present budget-aligned options to clients with confidence.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep prices current</h3>
        <p className={styles.cardDescription}>
          Refresh prices across all saved products before a client meeting. Know immediately what&apos;s changed, what&apos;s on sale, and what&apos;s gone out of stock.
        </p>
      </div>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Source from anywhere.</strong> Browse supplier websites, retail stores, and trade sites. Save products to the right client collection using the Chrome extension.</span></li>
        <li><span><strong>Organize and curate.</strong> Use slots to group options by room or category. Mark your recommended selections. Set budgets to stay within the client&apos;s range.</span></li>
        <li><span><strong>Share for approval.</strong> Send a public link to the client. They see a polished mood board with everything laid out. Iterate based on their feedback.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Use selections with limits to present curated shortlists. For example, save 10 sofa options but select your top 3 recommendations — the client sees your picks highlighted.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can I manage multiple client projects?</h3>
      <p>
        Yes. Create a separate collection for each client or project. They&apos;re completely independent — different items, different budgets, different sharing settings.
      </p>

      <h3>Can clients view without editing?</h3>
      <p>
        Yes. Make the collection public and share the link. Clients can browse the board, see images and prices, and click through to products — but they can&apos;t modify anything.
      </p>

      <h3>How do I share a mood board for approval?</h3>
      <p>
        Make the collection public, then send the link to your client. They see a visual board with all your curated options. You can update the collection anytime and the link stays the same.
      </p>

      <h3>Does it work with trade and wholesale sites?</h3>
      <p>
        Tote works with any website that has product pages. Trade sites, retail stores, wholesale suppliers — if you can view it in a browser, you can save it to Tote.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li><Link href="/use-cases/home-renovation">Home Renovation</Link> — the same room-by-room approach for personal projects</li>
        <li><Link href="/use-cases/personal-style">Wardrobe &amp; Style Board</Link> — curate style boards for personal or client wardrobes</li>
        <li><Link href="/use-cases/family-shopping">Shared Family Shopping</Link> — collaborative shopping for group projects</li>
      </ul>

      <p>
        <a href="https://tote.tools/collections">Try Tote — it&apos;s free &rarr;</a>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "Can I manage multiple client projects?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Create a separate collection for each client or project. They're completely independent — different items, different budgets, different sharing settings." } },
            { "@type": "Question", "name": "Can clients view without editing?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Make the collection public and share the link. Clients can browse the board, see images and prices, and click through to products — but they can't modify anything." } },
            { "@type": "Question", "name": "How do I share a mood board for approval?", "acceptedAnswer": { "@type": "Answer", "text": "Make the collection public, then send the link to your client. They see a visual board with all your curated options. You can update the collection anytime and the link stays the same." } },
            { "@type": "Question", "name": "Does it work with trade and wholesale sites?", "acceptedAnswer": { "@type": "Answer", "text": "Tote works with any website that has product pages. Trade sites, retail stores, wholesale suppliers — if you can view it in a browser, you can save it to Tote." } },
          ],
        }) }}
      />
    </article>
  );
}
