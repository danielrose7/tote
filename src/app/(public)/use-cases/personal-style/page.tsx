import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Wardrobe & Style Board",
  description:
    "Build a wardrobe planner across every store. Curate seasonal capsule collections, organize by category, and track sale prices — all in one place.",
  alternates: { canonical: "/use-cases/personal-style" },
  openGraph: {
    title: "Wardrobe & Style Board — Tote",
    description:
      "Curate seasonal wardrobes and capsule collections. Save clothes from any store and watch for sales.",
  },
};

export default function PersonalStylePage() {
  return (
    <article className={styles.article}>
      <h1>Your wardrobe planner, across every store</h1>
      <p className={styles.lead}>
        Saving clothes across Zara, H&amp;M, Depop, and boutiques means forgetting what you saved where. Tote brings every piece into one style board you actually use.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <circle cx="80" cy="18" r="8" fill="none" stroke="var(--color-periwinkle)" strokeWidth="3" />
          <path d="M80 26 L80 42 L120 70 L120 78 L40 78 L40 70 L80 42" fill="var(--color-lavender)" stroke="var(--color-periwinkle)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M60 78 L55 140 L105 140 L100 78" fill="var(--color-lavender)" opacity="0.6" />
          <ellipse cx="80" cy="140" rx="30" ry="4" fill="var(--color-periwinkle)" opacity="0.3" />
          <line x1="80" y1="78" x2="80" y2="140" stroke="var(--color-periwinkle)" strokeWidth="1.5" opacity="0.3" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <h2>The problem</h2>
      <p>
        You spot a jacket on Zara, save a pair of jeans on H&amp;M, bookmark shoes from a boutique, and screenshot a bag from Depop. Each store has its own wishlist — or no wishlist at all. By the time you&apos;re ready to buy, you can&apos;t remember what you saved, where you saved it, or whether it&apos;s still in stock.
      </p>

      <h2>How Tote helps</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Build seasonal collections</h3>
        <p className={styles.cardDescription}>
          Create a collection for each season or style project — &ldquo;Spring 2025&rdquo;, &ldquo;Capsule Wardrobe&rdquo;, &ldquo;Vacation Outfits&rdquo;. Save pieces from any store into one curated board.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Organize by category</h3>
        <p className={styles.cardDescription}>
          Use slots to group by tops, bottoms, shoes, accessories, or any categories that match how you think about your wardrobe. See everything laid out, not buried in bookmarks.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Pick your favorites</h3>
        <p className={styles.cardDescription}>
          Use selections to mark the pieces you love most. Set a selection limit per slot — like &ldquo;pick 3 tops&rdquo; — to build a focused capsule instead of an endless wish list.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Watch for sales</h3>
        <p className={styles.cardDescription}>
          Refresh prices to see what&apos;s dropped or sold out. Stop checking every store manually — Tote shows you current prices in one view.
        </p>
      </div>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Save pieces as you browse.</strong> Install the Chrome extension. When you see something you like — Zara, H&amp;M, ASOS, Depop, a local boutique — click to save it. Tote captures the image, price, and link.</span></li>
        <li><span><strong>Organize into your style board.</strong> Sort pieces into collections by season or project. Use slots for categories like tops, bottoms, and shoes. Mark your favorites with selections.</span></li>
        <li><span><strong>Refresh and buy.</strong> When you&apos;re ready to shop, refresh prices to see what&apos;s on sale. Click through to buy directly from the original store.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Building a capsule wardrobe? Set a selection limit on each slot (e.g., 5 tops, 3 bottoms, 2 shoes) to force yourself to curate instead of accumulate.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can I organize by season?</h3>
      <p>
        Yes. Create a collection for each season — &ldquo;Spring 2025&rdquo;, &ldquo;Winter Basics&rdquo; — and save relevant pieces into each. You can also use slots within a collection to subdivide by category.
      </p>

      <h3>How do I track sale prices?</h3>
      <p>
        Use the price refresh feature to update saved products with their current prices. This lets you spot discounts without visiting each store individually.
      </p>

      <h3>Does it work with Zara, H&amp;M, and other fashion retailers?</h3>
      <p>
        Yes. Tote works with virtually any online store — Zara, H&amp;M, ASOS, Depop, Nordstrom, Net-a-Porter, boutique shops, and more. If it has a product page, Tote can save it.
      </p>

      <h3>Can I share my style board with a friend?</h3>
      <p>
        Yes. Share your collection via invite link for collaborative boards, or make it public so anyone with the link can browse your curated picks.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li><Link href="/use-cases/gift-shopping">Gift Lists &amp; Wishlists</Link> — build shareable wishlists for birthdays and holidays</li>
        <li><Link href="/use-cases/home-renovation">Home Renovation</Link> — the same organized approach, applied to furnishing your space</li>
        <li><Link href="/use-cases/professional-projects">Professional Projects</Link> — manage style sourcing for clients</li>
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
            { "@type": "Question", "name": "Can I organize by season?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Create a collection for each season — \"Spring 2025\", \"Winter Basics\" — and save relevant pieces into each. You can also use slots within a collection to subdivide by category." } },
            { "@type": "Question", "name": "How do I track sale prices?", "acceptedAnswer": { "@type": "Answer", "text": "Use the price refresh feature to update saved products with their current prices. This lets you spot discounts without visiting each store individually." } },
            { "@type": "Question", "name": "Does it work with Zara, H&M, and other fashion retailers?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Tote works with virtually any online store — Zara, H&M, ASOS, Depop, Nordstrom, Net-a-Porter, boutique shops, and more. If it has a product page, Tote can save it." } },
            { "@type": "Question", "name": "Can I share my style board with a friend?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Share your collection via invite link for collaborative boards, or make it public so anyone with the link can browse your curated picks." } },
          ],
        }) }}
      />
    </article>
  );
}
