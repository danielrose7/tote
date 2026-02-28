import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Home Renovation & Furnishing",
  description:
    "Organize your renovation room by room. Track furniture and material prices across IKEA, Wayfair, and local shops — all in one place with budgets and sharing.",
  alternates: { canonical: "/use-cases/home-renovation" },
  openGraph: {
    title: "Home Renovation & Furnishing — Tote",
    description:
      "Organize your renovation room by room. Track prices across stores and share boards with your partner or contractor.",
  },
};

export default function HomeRenovationPage() {
  return (
    <article className={styles.article}>
      <h1>Stop losing track of furniture across 47 browser tabs</h1>
      <p className={styles.lead}>
        Renovating means browsing dozens of stores for furniture, fixtures, and materials — then losing track of what goes where. Tote organizes everything room by room with prices and budgets.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <path d="M80 20 L140 60 L140 140 L20 140 L20 60 Z" fill="var(--color-powder-blue)" opacity="0.5" />
          <rect x="40" y="65" width="25" height="25" rx="2" fill="var(--color-powder-blue)" opacity="0.35" />
          <rect x="95" y="65" width="25" height="25" rx="2" fill="var(--color-powder-blue)" opacity="0.35" />
          <rect x="40" y="100" width="25" height="25" rx="2" fill="var(--color-powder-blue)" opacity="0.35" />
          <rect x="60" y="100" width="40" height="40" rx="3" fill="var(--color-powder-blue)" opacity="0.6" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <h2>The problem</h2>
      <p>
        You&apos;re browsing IKEA for a sofa, Wayfair for a rug, a local shop for lighting, and Amazon for hardware. Each store has its own wishlist (or none at all). You&apos;re juggling browser tabs, screenshots, and a spreadsheet that&apos;s already out of date. Meanwhile, your budget is a moving target and your partner hasn&apos;t seen half the options.
      </p>

      <h2>How Tote helps</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Organize room by room</h3>
        <p className={styles.cardDescription}>
          Create a collection for each room — living room, kitchen, bedroom. Add slots within each collection for categories like seating, lighting, or storage. Everything stays organized the way you think about your space.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Track prices across every store</h3>
        <p className={styles.cardDescription}>
          Save products from IKEA, Wayfair, Amazon, Etsy, or any online shop. Refresh prices to catch sales or see when items sell out — no more checking each store manually.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Set and track budgets</h3>
        <p className={styles.cardDescription}>
          Set a budget for each room or each category. As you select items, Tote totals up your selections so you can see at a glance whether you&apos;re on track or need to make trade-offs.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share with your partner or contractor</h3>
        <p className={styles.cardDescription}>
          Invite your partner to collaborate in real time, or share a read-only link with your contractor or designer. Everyone sees the same options and prices.
        </p>
      </div>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Save as you browse.</strong> Install the Chrome extension. When you find a piece of furniture or material you like, click to save it to the right room&apos;s collection. Tote captures the image, price, and link.</span></li>
        <li><span><strong>Organize with slots and selections.</strong> Group items by category (seating, lighting, rugs). Use selections to mark your top picks and compare options side by side.</span></li>
        <li><span><strong>Set budgets and share.</strong> Add a budget to each collection or slot. Invite your partner to collaborate or share a link with your contractor for review.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Use one collection per room and slots for each category (e.g., &ldquo;Living Room &gt; Seating&rdquo;, &ldquo;Living Room &gt; Lighting&rdquo;). This keeps your renovation organized even as it scales to dozens of items.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can I set a budget per room?</h3>
      <p>
        Yes. Each collection (room) can have its own budget. You can also set budgets on individual slots (categories) within a room for more granular control.
      </p>

      <h3>How do I share with my contractor?</h3>
      <p>
        Make the collection public and send them the link — they can view everything without creating an account. If you want them to add items too, send an invite link instead.
      </p>

      <h3>Does it work with IKEA and Wayfair?</h3>
      <p>
        Yes. Tote works with virtually any online store, including IKEA, Wayfair, Amazon, Etsy, CB2, West Elm, and local shops. If it has a product page, Tote can save it.
      </p>

      <h3>Can my partner and I both add items?</h3>
      <p>
        Yes. Share the collection via invite link and both of you can save products, organize them, and mark selections. Changes sync in real time.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li><Link href="/use-cases/family-shopping">Shared Family Shopping</Link> — collaborate on any shopping project with your partner</li>
        <li><Link href="/use-cases/professional-projects">Professional Projects</Link> — manage sourcing across multiple client projects</li>
        <li><Link href="/use-cases/gift-shopping">Gift Lists &amp; Wishlists</Link> — organize and share gift ideas for any occasion</li>
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
            { "@type": "Question", "name": "Can I set a budget per room?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Each collection (room) can have its own budget. You can also set budgets on individual slots (categories) within a room for more granular control." } },
            { "@type": "Question", "name": "How do I share with my contractor?", "acceptedAnswer": { "@type": "Answer", "text": "Make the collection public and send them the link — they can view everything without creating an account. If you want them to add items too, send an invite link instead." } },
            { "@type": "Question", "name": "Does it work with IKEA and Wayfair?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Tote works with virtually any online store, including IKEA, Wayfair, Amazon, Etsy, CB2, West Elm, and local shops. If it has a product page, Tote can save it." } },
            { "@type": "Question", "name": "Can my partner and I both add items?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Share the collection via invite link and both of you can save products, organize them, and mark selections. Changes sync in real time." } },
          ],
        }) }}
      />
    </article>
  );
}
