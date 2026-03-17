import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";
import { AnswerBlock } from "../AnswerBlock";

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
      <h1>Sourcing boards your clients can actually open</h1>
      <p className={styles.lead}>
        You&apos;re sourcing for three clients, each with their own stores, budget, and taste. The current setup is a spreadsheet, a PDF mood board, and an email chain. Tote keeps every project separate and shareable — no PDF required.
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

      <AnswerBlock
        question="How do designers organize product sourcing for client projects?"
        answer="Designers and stylists often collect products from many different suppliers while putting together client projects. Tote helps you organize those items into shareable collections, making it easier to keep track of products, compare options side by side, and present curated ideas to clients — all without spreadsheets or scattered bookmarks."
        accent="var(--color-blush)"
        steps={[
          "Save products from suppliers, retailers, and trade sites",
          "Organize them into collections by client or project",
          "Compare options and track budgets",
          "Share a polished board with your client for review",
        ]}
      />

      <p>
        You&apos;re sourcing materials for three clients at once. Each project has its own set of stores, budgets, and preferences. You&apos;re saving links in spreadsheets, emailing mood board PDFs, and losing track of which option the client liked. When prices change, your spreadsheet is already stale.
      </p>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep each project separate</h3>
        <p className={styles.cardDescription}>
          Create a collection for each client or project. Use slots to organize by room, category, or material type. Switch between projects without mixing anything up.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share a polished board with clients</h3>
        <p className={styles.cardDescription}>
          Make a collection public and send the link to your client. They see a clean, visual board with images, prices, and links — no account needed. Great for review meetings.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Track project budgets</h3>
        <p className={styles.cardDescription}>
          Set a budget for each project or category. As you select items, the running total updates automatically. Present options that fit the budget — no guesswork.
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
        <li><span><strong>Organize your picks.</strong> Use slots to group options by room or category. Mark your recommended selections. Set budgets to stay within the client&apos;s range.</span></li>
        <li><span><strong>Share and get feedback.</strong> Send a public link to the client. They see a polished mood board with everything laid out. Update and reshare as many times as you need.</span></li>
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
        Absolutely. Create a separate collection for each client or project. They&apos;re completely independent — different items, different budgets, different sharing settings.
      </p>

      <h3>Can clients view without editing?</h3>
      <p>
        Make the collection public and share the link. Clients can browse the board, see images and prices, and click through to products — but they can&apos;t modify anything.
      </p>

      <h3>How do I share a mood board for approval?</h3>
      <p>
        Make the collection public, then send the link to your client. They see a visual board with all your curated options. You can update the collection anytime and the link stays the same.
      </p>

      <h3>Does it work with trade and wholesale sites?</h3>
      <p>
        Tote works with any website that has product pages — trade sites, retail stores, wholesale suppliers, all of it. If you can view it in a browser, you can save it.
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
            { "@type": "Question", "name": "Can I manage multiple client projects?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. Create a separate collection for each client or project. They're completely independent — different items, different budgets, different sharing settings." } },
            { "@type": "Question", "name": "Can clients view without editing?", "acceptedAnswer": { "@type": "Answer", "text": "Make the collection public and share the link. Clients can browse the board, see images and prices, and click through to products — but they can't modify anything." } },
            { "@type": "Question", "name": "How do I share a mood board for approval?", "acceptedAnswer": { "@type": "Answer", "text": "Make the collection public, then send the link to your client. They see a visual board with all your curated options. You can update the collection anytime and the link stays the same." } },
            { "@type": "Question", "name": "Does it work with trade and wholesale sites?", "acceptedAnswer": { "@type": "Answer", "text": "Tote works with any website that has product pages — trade sites, retail stores, wholesale suppliers, all of it. If you can view it in a browser, you can save it." } },
          ],
        }) }}
      />
    </article>
  );
}
