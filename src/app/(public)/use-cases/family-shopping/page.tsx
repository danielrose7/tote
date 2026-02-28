import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Shared Family Shopping",
  description:
    "Shop together as a family with one shared board. Coordinate purchases, avoid duplicates, and stay on budget for back-to-school, new homes, and group projects.",
  alternates: { canonical: "/use-cases/family-shopping" },
  openGraph: {
    title: "Shared Family Shopping — Tote",
    description:
      "Shop together with your partner or family. One shared board for any group shopping project.",
  },
};

export default function FamilyShoppingPage() {
  return (
    <article className={styles.article}>
      <h1>One shared board for every family shopping project</h1>
      <p className={styles.lead}>
        Couples texting each other links. Families duplicating purchases. No single source of truth. Tote gives your household one place to shop together.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <circle cx="60" cy="90" r="35" fill="var(--color-peach)" opacity="0.7" />
          <circle cx="100" cy="90" r="35" fill="var(--color-peach)" opacity="0.7" />
          <circle cx="60" cy="55" r="14" fill="var(--color-peach)" opacity="0.9" />
          <circle cx="100" cy="55" r="14" fill="var(--color-peach)" opacity="0.9" />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">Get started — it&apos;s free &rarr;</a>
      </p>

      <h2>The problem</h2>
      <p>
        Your partner texts you a link to a couch. You screenshot a different one. Your sister-in-law buys the same birthday gift you already ordered. Back-to-school shopping turns into a mess of tabs, texts, and &ldquo;did you already buy that?&rdquo; messages. There&apos;s no shared view, no coordination, and no budget tracking.
      </p>

      <h2>How Tote helps</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Real-time collaboration</h3>
        <p className={styles.cardDescription}>
          Share a collection with your partner or family via invite link. Everyone can add products, organize them, and mark favorites. Changes sync instantly.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>One collection per project</h3>
        <p className={styles.cardDescription}>
          Create separate collections for &ldquo;New Apartment&rdquo;, &ldquo;Back to School&rdquo;, &ldquo;Holiday Gifts&rdquo;, or any shared shopping project. Keep each project focused and organized.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Stay on budget together</h3>
        <p className={styles.cardDescription}>
          Set a shared budget on any collection. As items are selected, the running total updates for everyone — so you both know where the spending stands.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Compare options side by side</h3>
        <p className={styles.cardDescription}>
          Both partners save their picks. Use selections to vote on favorites. See all the options in one place instead of scrolling through a text thread.
        </p>
      </div>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li><span><strong>Create a shared collection.</strong> One person creates the collection and sends an invite link. The other joins with one click.</span></li>
        <li><span><strong>Both save products.</strong> Each person browses stores and saves products to the shared collection using the Chrome extension. Everything appears in one board.</span></li>
        <li><span><strong>Decide together.</strong> Review the options, mark favorites, set a budget, and buy when you&apos;re ready. No more guessing what the other person found.</span></li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          For big projects like furnishing a new home, use slots to divide the collection by room or category. Each person can focus on different areas while contributing to the same board.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can my partner add items too?</h3>
      <p>
        Yes. When you share a collection via invite link, anyone who joins can add products, rearrange items, and mark selections — just like you.
      </p>

      <h3>Do we both need accounts?</h3>
      <p>
        To add items and collaborate, yes — both people need a free Tote account. But if you just want someone to view your picks, make the collection public and they can browse without an account.
      </p>

      <h3>Can we have separate collections?</h3>
      <p>
        Absolutely. Each person has their own private collections by default. You choose which ones to share. Share a &ldquo;New Home&rdquo; collection with your partner while keeping your personal &ldquo;Birthday Wishlist&rdquo; private.
      </p>

      <h3>How do we avoid buying the same thing?</h3>
      <p>
        Everything is in one shared board, so both people can see what&apos;s been saved and selected. Use selections to mark which items are &ldquo;claimed&rdquo; or decided on.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li><Link href="/use-cases/gift-shopping">Gift Lists &amp; Wishlists</Link> — coordinate gift-giving and avoid duplicates</li>
        <li><Link href="/use-cases/home-renovation">Home Renovation</Link> — organize a renovation project with your partner</li>
        <li><Link href="/use-cases/personal-style">Wardrobe &amp; Style Board</Link> — curate your personal wardrobe with shared inspiration</li>
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
            { "@type": "Question", "name": "Can my partner add items too?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. When you share a collection via invite link, anyone who joins can add products, rearrange items, and mark selections — just like you." } },
            { "@type": "Question", "name": "Do we both need accounts?", "acceptedAnswer": { "@type": "Answer", "text": "To add items and collaborate, yes — both people need a free Tote account. But if you just want someone to view your picks, make the collection public and they can browse without an account." } },
            { "@type": "Question", "name": "Can we have separate collections?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. Each person has their own private collections by default. You choose which ones to share. Share a \"New Home\" collection with your partner while keeping your personal \"Birthday Wishlist\" private." } },
            { "@type": "Question", "name": "How do we avoid buying the same thing?", "acceptedAnswer": { "@type": "Answer", "text": "Everything is in one shared board, so both people can see what's been saved and selected. Use selections to mark which items are \"claimed\" or decided on." } },
          ],
        }) }}
      />
    </article>
  );
}
