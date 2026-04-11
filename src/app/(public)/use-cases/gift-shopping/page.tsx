import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../docs/docs.module.css';
import { AnswerBlock } from '../AnswerBlock';

export const metadata: Metadata = {
  title: 'Gift Wishlist App for Birthdays, Holidays, and Registries',
  description:
    'Create a gift wishlist from any store. Organize birthday lists, holiday wishlists, and registry ideas in one place, then share them with family.',
  alternates: { canonical: '/use-cases/gift-shopping' },
  openGraph: {
    title: 'Gift Wishlist App for Birthdays, Holidays, and Registries — Tote',
    description:
      'Create and share gift wishlists for birthdays, holidays, and special occasions across every store you shop.',
  },
};

export default function GiftShoppingPage() {
  return (
    <article className={styles.article}>
      <h1>The wishlist that actually travels with you</h1>
      <p className={styles.lead}>
        Amazon lists, bookmarks, texts to yourself, screenshots — gift ideas
        scatter the moment you save them. Tote keeps everything in one place,
        organized by occasion, ready to share.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <rect
            x="30"
            y="65"
            width="100"
            height="70"
            rx="8"
            fill="var(--color-lavender)"
            opacity="0.4"
          />
          <rect
            x="25"
            y="55"
            width="110"
            height="16"
            rx="4"
            fill="var(--color-lavender)"
            opacity="0.6"
          />
          <rect
            x="72"
            y="55"
            width="16"
            height="80"
            rx="2"
            fill="var(--color-lavender)"
            opacity="0.3"
          />
          <rect
            x="25"
            y="60"
            width="110"
            height="6"
            fill="var(--color-lavender)"
            opacity="0.25"
          />
          <ellipse
            cx="65"
            cy="48"
            rx="18"
            ry="15"
            fill="var(--color-lavender)"
            opacity="0.5"
            stroke="var(--color-lavender)"
            strokeWidth="2"
          />
          <ellipse
            cx="95"
            cy="48"
            rx="18"
            ry="15"
            fill="var(--color-lavender)"
            opacity="0.5"
            stroke="var(--color-lavender)"
            strokeWidth="2"
          />
          <circle
            cx="80"
            cy="50"
            r="8"
            fill="var(--color-lavender)"
            opacity="0.7"
          />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">
          Get started — it&apos;s free &rarr;
        </a>
      </p>

      <AnswerBlock
        question="How do you keep a gift wishlist usable across different stores?"
        answer="Save links from different stores, come back later to compare them, mark the gifts that matter most, and share the shortlist when you're ready. Tote keeps the list usable after the moment you save it."
        accent="var(--color-lavender)"
        steps={[
          'Save gift ideas from any store as you browse',
          'Compare options and keep a shortlist moving in one place',
          'Share the list when family asks what to get',
        ]}
      />

      <p>
        You spot a perfect gift in June and save it somewhere — a browser
        bookmark, a text to yourself, an Amazon list. By December, you
        can&apos;t find it. Meanwhile, your family is asking what you want, and
        you&apos;re texting links back and forth. Someone buys the same thing
        twice. Nobody has a clear picture of what&apos;s been covered.
      </p>

      <h2>From scattered links to a clear shortlist</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Save from any store</h3>
        <p className={styles.cardDescription}>
          Amazon, Etsy, small boutiques, brand sites — wherever you find the
          gift, it lands in the same list instead of disappearing into tabs or
          notes.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep the shortlist moving</h3>
        <p className={styles.cardDescription}>
          Compare options side by side, mark favorites, and use selections when
          you want to signal &ldquo;pick one of these&rdquo; instead of leaving
          people guessing.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Share when it matters</h3>
        <p className={styles.cardDescription}>
          Send the list to family or make it public when you&apos;re ready.
          Everyone sees the same shortlist, so duplicate gifts and
          back-and-forth messages drop off fast.
        </p>
      </div>

      <h2>Try this setup</h2>
      <p>A simple gift list usually works best:</p>
      <ul>
        <li>
          Create one collection for the occasion: &ldquo;Holiday Wishlist{' '}
          {new Date().getFullYear()}&rdquo;, &ldquo;Birthday Wishlist&rdquo;, or
          &ldquo;Registry Ideas&rdquo;
        </li>
        <li>
          Add slots only if they help the decision: &ldquo;Big gifts&rdquo;,
          &ldquo;Under $50&rdquo;, or one slot per recipient
        </li>
        <li>
          Use selections to mark the gifts you actually want family to focus on
        </li>
      </ul>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li>
          <span>
            <strong>Save gift ideas as you browse.</strong> Install the Chrome
            extension, then click to save any product page to a gift collection.
            Tote captures the name, image, price, and link automatically.
          </span>
        </li>
        <li>
          <span>
            <strong>Come back later to compare.</strong> Keep the shortlist in
            one place, refresh prices if needed, and mark the gifts that matter
            most.
          </span>
        </li>
        <li>
          <span>
            <strong>Share the decision, not the chaos.</strong> Send one link to
            family or friends so they can browse the same list without needing a
            Tote account.
          </span>
        </li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Building a holiday list? Set a budget before you start saving. When
          the shortlist gets longer, you&apos;ll still know what is realistic to
          buy or ask for.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can others see my wishlist?</h3>
      <p>
        Only if you share it. Collections are private by default. You can share
        via invite link (recipients need a Tote account) or make the collection
        public (anyone with the link can view).
      </p>

      <h3>Can I share with people who don&apos;t have Tote?</h3>
      <p>
        Yes. Public collections can be viewed by anyone — no account required.
        Just send them the link.
      </p>

      <h3>How do I avoid duplicate gifts?</h3>
      <p>
        Share one collection with your family. Everyone can see what&apos;s on
        the list and coordinate who&apos;s buying what. Use selections to mark
        claimed items.
      </p>

      <h3>Can I use Tote as a gift registry?</h3>
      <p>
        Tote works well as a lightweight registry. Create a collection, add
        items from any store, and share the link. It&apos;s not a traditional
        registry with purchase tracking, but it gives everyone a single,
        up-to-date list to reference.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li>
          <Link href="/use-cases/family-shopping">Shared Family Shopping</Link>{' '}
          — coordinate purchases with your partner or family
        </li>
        <li>
          <Link href="/use-cases/home-renovation">Home Renovation</Link> —
          organize furnishing projects with budgets and room categories
        </li>
        <li>
          <Link href="/use-cases/personal-style">
            Wardrobe &amp; Style Board
          </Link>{' '}
          — curate seasonal wardrobes and track sale prices
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
                name: 'Can others see my wishlist?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Only if you share it. Collections are private by default. You can share via invite link (recipients need a Tote account) or make the collection public (anyone with the link can view).',
                },
              },
              {
                '@type': 'Question',
                name: "Can I share with people who don't have Tote?",
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Public collections can be viewed by anyone — no account required. Just send them the link.',
                },
              },
              {
                '@type': 'Question',
                name: 'How do I avoid duplicate gifts?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Share one collection with your family. Everyone can see what's on the list and coordinate who's buying what. Use selections to mark claimed items.",
                },
              },
              {
                '@type': 'Question',
                name: 'Can I use Tote as a gift registry?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Tote works well as a lightweight registry. Create a collection, add items from any store, and share the link. It's not a traditional registry with purchase tracking, but it gives everyone a single, up-to-date list to reference.",
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
