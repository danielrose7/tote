import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";
import { AnswerBlock } from "../AnswerBlock";

export const metadata: Metadata = {
  title: "Wardrobe Planner and Style Board for Capsule Outfits",
  description:
    "Plan outfits and build a capsule wardrobe with a style board that works across every store. Save clothing in one place, organize by category, and track sale prices.",
  alternates: { canonical: "/use-cases/personal-style" },
  openGraph: {
    title: "Wardrobe Planner and Style Board for Capsule Outfits — Tote",
    description:
      "Build a capsule wardrobe, save clothing from any store, and track sale prices in one style board.",
  },
};

export default function PersonalStylePage() {
  return (
    <article className={styles.article}>
      <h1>Your style board, across every store you shop</h1>
      <p className={styles.lead}>
        You saved a jacket on Zara, jeans on H&amp;M, shoes from a boutique. By the time you&apos;re ready to buy, you can&apos;t find any of it. Tote keeps every piece together — organized the way you think about your wardrobe.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <circle cx="80" cy="18" r="8" fill="none" stroke="var(--color-periwinkle)" strokeWidth="3" opacity="0.6" />
          <path d="M80 26 L80 42 L120 70 L120 78 L40 78 L40 70 L80 42" fill="var(--color-periwinkle)" opacity="0.4" stroke="var(--color-periwinkle)" strokeWidth="2" strokeOpacity="0.5" strokeLinejoin="round" />
          <path d="M60 78 L55 140 L105 140 L100 78" fill="var(--color-periwinkle)" opacity="0.3" />
          <ellipse cx="80" cy="140" rx="30" ry="4" fill="var(--color-periwinkle)" opacity="0.2" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <AnswerBlock
        question="How do you keep outfit ideas usable across different stores?"
        answer="Save pieces from different stores, come back later to compare them, keep a shortlist of what still fits the plan, and refresh prices when you&apos;re ready to buy. Tote keeps your style board usable after the moment you save it."
        accent="var(--color-periwinkle)"
        steps={[
          "Save clothes and accessories from any store",
          "Compare pieces and keep the shortlist focused",
          "Refresh prices and buy when you&apos;re ready",
        ]}
      />

      <p>
        You spot a jacket on Zara, save a pair of jeans on H&amp;M, bookmark shoes from a boutique, and screenshot a bag from Depop. Each store has its own wishlist — or no wishlist at all. By the time you&apos;re ready to buy, you can&apos;t remember what you saved, where you saved it, or whether it&apos;s still in stock.
      </p>

      <h2>From saved pieces to a wearable shortlist</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Save from every store</h3>
        <p className={styles.cardDescription}>
          Zara, H&amp;M, ASOS, Depop, boutiques. The pieces all land in one board instead of getting lost across bookmarks and store wishlists.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep the shortlist focused</h3>
        <p className={styles.cardDescription}>
          Compare pieces by category, use selections when you want fewer options, and keep the board honest about what still belongs in the wardrobe.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Buy when the timing is right</h3>
        <p className={styles.cardDescription}>
          Refresh prices to catch sales or sold-out items before you buy. You do not need to revisit every store just to see what changed.
        </p>
      </div>

      <h2>Try this setup</h2>
      <p>
        A simple wardrobe board usually works best:
      </p>
      <ul>
        <li>Create one collection such as &ldquo;Capsule Wardrobe&rdquo;, &ldquo;Spring Outfits&rdquo;, or &ldquo;Vacation Looks&rdquo;</li>
        <li>Add slots only where they help the decision: &ldquo;Tops&rdquo;, &ldquo;Bottoms&rdquo;, &ldquo;Shoes&rdquo;, &ldquo;Outerwear&rdquo;</li>
        <li>Use selection limits to cap each category and keep the shortlist wearable, not endless</li>
      </ul>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Save pieces as you browse.</strong> Install the Chrome extension. When you see something you like — Zara, H&amp;M, ASOS, Depop, a local boutique — click to save it. Tote captures the image, price, and link.</span></li>
        <li><span><strong>Organize into your style board.</strong> Sort pieces into collections by season or project. Use slots for categories like tops, bottoms, and shoes. Mark your favorites with selections.</span></li>
        <li><span><strong>Refresh and buy.</strong> When you&apos;re ready to shop, refresh prices to see what&apos;s on sale. Click through to buy directly from the original store.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Building a capsule wardrobe? Selection limits do more than organize the board. They force the decision.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can I organize by season?</h3>
      <p>
        Absolutely. Create a collection for each season — &ldquo;Summer Essentials&rdquo;, &ldquo;Winter Basics&rdquo; — and save relevant pieces into each. You can also use slots within a collection to subdivide by category.
      </p>

      <h3>How do I track sale prices?</h3>
      <p>
        Use the price refresh feature to update saved products with their current prices. This lets you spot discounts without visiting each store individually.
      </p>

      <h3>Does it work with Zara, H&amp;M, and other fashion retailers?</h3>
      <p>
        It works with just about any online store — Zara, H&amp;M, ASOS, Depop, Nordstrom, Net-a-Porter, boutiques, you name it. If you can see the product page, Tote can save it.
      </p>

      <h3>Can I share my style board with a friend?</h3>
      <p>
        Of course. Share via invite link if you want to collaborate, or make it public so anyone with the link can browse your picks.
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
            { "@type": "Question", "name": "Can I organize by season?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. Create a collection for each season — \"Summer Essentials\", \"Winter Basics\" — and save relevant pieces into each. You can also use slots within a collection to subdivide by category." } },
            { "@type": "Question", "name": "How do I track sale prices?", "acceptedAnswer": { "@type": "Answer", "text": "Use the price refresh feature to update saved products with their current prices. This lets you spot discounts without visiting each store individually." } },
            { "@type": "Question", "name": "Does it work with Zara, H&M, and other fashion retailers?", "acceptedAnswer": { "@type": "Answer", "text": "It works with just about any online store — Zara, H&M, ASOS, Depop, Nordstrom, Net-a-Porter, boutiques, you name it. If you can see the product page, Tote can save it." } },
            { "@type": "Question", "name": "Can I share my style board with a friend?", "acceptedAnswer": { "@type": "Answer", "text": "Of course. Share via invite link if you want to collaborate, or make it public so anyone with the link can browse your picks." } },
          ],
        }) }}
      />
    </article>
  );
}
