import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Gift Lists & Wishlists",
  description:
    "Never lose track of a gift idea again. Build wishlists for birthdays, holidays, and special occasions — then share them so family knows exactly what to get.",
  alternates: { canonical: "/use-cases/gift-shopping" },
  openGraph: {
    title: "Gift Lists & Wishlists — Tote",
    description:
      "Build wishlists for birthdays, holidays, and special occasions. Share them so family knows exactly what to get.",
  },
};

export default function GiftShoppingPage() {
  return (
    <article className={styles.article}>
      <h1>Never lose track of a gift idea again</h1>
      <p className={styles.lead}>
        Wishlists scattered across Amazon, store accounts, text messages, and spreadsheets? Tote puts every gift idea in one place — and makes sharing effortless.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <rect x="30" y="65" width="100" height="70" rx="8" fill="var(--color-lavender)" opacity="0.4" />
          <rect x="25" y="55" width="110" height="16" rx="4" fill="var(--color-lavender)" opacity="0.6" />
          <rect x="72" y="55" width="16" height="80" rx="2" fill="var(--color-lavender)" opacity="0.3" />
          <rect x="25" y="60" width="110" height="6" fill="var(--color-lavender)" opacity="0.25" />
          <ellipse cx="65" cy="48" rx="18" ry="15" fill="var(--color-lavender)" opacity="0.5" stroke="var(--color-lavender)" strokeWidth="2" />
          <ellipse cx="95" cy="48" rx="18" ry="15" fill="var(--color-lavender)" opacity="0.5" stroke="var(--color-lavender)" strokeWidth="2" />
          <circle cx="80" cy="50" r="8" fill="var(--color-lavender)" opacity="0.7" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <h2>The problem</h2>
      <p>
        You spot a perfect gift in June and save it somewhere — a browser bookmark, a text to yourself, an Amazon list. By December, you can&apos;t find it. Meanwhile, your family is asking what you want, and you&apos;re texting links back and forth. Someone buys the same thing twice. Nobody has a clear picture of what&apos;s been covered.
      </p>

      <h2>How Tote helps</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>One collection per occasion</h3>
        <p className={styles.cardDescription}>
          Create a collection for &ldquo;Holiday {new Date().getFullYear()}&rdquo;, &ldquo;Mom&apos;s Birthday&rdquo;, or &ldquo;Wedding Registry Ideas&rdquo;. Save gift ideas from any store — Amazon, Etsy, small boutiques, anywhere — all in one place.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share with family</h3>
        <p className={styles.cardDescription}>
          Send an invite link so family members can view your wishlist, or make it public so anyone with the link can browse. No app download or account required for viewers.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Mark your favorites</h3>
        <p className={styles.cardDescription}>
          Use selections to highlight the items you want most. Set a selection limit to signal &ldquo;pick one of these three&rdquo; instead of guessing.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Track prices across stores</h3>
        <p className={styles.cardDescription}>
          Refresh prices to see what&apos;s on sale or sold out. Know the best time to buy without checking every store manually.
        </p>
      </div>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Save gift ideas as you browse.</strong> Install the Chrome extension, then click to save any product page to a gift collection. Tote captures the name, image, price, and link automatically.</span></li>
        <li><span><strong>Organize by occasion or recipient.</strong> Create separate collections for each holiday, birthday, or event. Use slots to group by recipient if you&apos;re buying for multiple people.</span></li>
        <li><span><strong>Share your list.</strong> Send a link to family or friends. They can see your curated picks without needing a Tote account.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Set a budget on your gift collection to keep holiday spending in check. Tote totals up your selected items so you can see at a glance if you&apos;re over budget.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can others see my wishlist?</h3>
      <p>
        Only if you share it. Collections are private by default. You can share via invite link (recipients need a Tote account) or make the collection public (anyone with the link can view).
      </p>

      <h3>Can I share with people who don&apos;t have Tote?</h3>
      <p>
        Yes. Public collections can be viewed by anyone — no account required. Just send them the link.
      </p>

      <h3>How do I avoid duplicate gifts?</h3>
      <p>
        Share one collection with your family. Everyone can see what&apos;s on the list and coordinate who&apos;s buying what. Use selections to mark claimed items.
      </p>

      <h3>Can I use Tote as a gift registry?</h3>
      <p>
        Tote works well as a lightweight registry. Create a collection, add items from any store, and share the link. It&apos;s not a traditional registry with purchase tracking, but it gives everyone a single, up-to-date list to reference.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li><Link href="/use-cases/family-shopping">Shared Family Shopping</Link> — coordinate purchases with your partner or family</li>
        <li><Link href="/use-cases/home-renovation">Home Renovation</Link> — organize furnishing projects with budgets and room categories</li>
        <li><Link href="/use-cases/personal-style">Wardrobe &amp; Style Board</Link> — curate seasonal wardrobes and track sale prices</li>
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
            { "@type": "Question", "name": "Can others see my wishlist?", "acceptedAnswer": { "@type": "Answer", "text": "Only if you share it. Collections are private by default. You can share via invite link (recipients need a Tote account) or make the collection public (anyone with the link can view)." } },
            { "@type": "Question", "name": "Can I share with people who don't have Tote?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Public collections can be viewed by anyone — no account required. Just send them the link." } },
            { "@type": "Question", "name": "How do I avoid duplicate gifts?", "acceptedAnswer": { "@type": "Answer", "text": "Share one collection with your family. Everyone can see what's on the list and coordinate who's buying what. Use selections to mark claimed items." } },
            { "@type": "Question", "name": "Can I use Tote as a gift registry?", "acceptedAnswer": { "@type": "Answer", "text": "Tote works well as a lightweight registry. Create a collection, add items from any store, and share the link. It's not a traditional registry with purchase tracking, but it gives everyone a single, up-to-date list to reference." } },
          ],
        }) }}
      />
    </article>
  );
}
