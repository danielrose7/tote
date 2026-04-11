import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../docs/docs.module.css';
import { AnswerBlock } from '../AnswerBlock';

export const metadata: Metadata = {
  title: 'Shared Shopping List App for Couples and Families',
  description:
    'Create a shared shopping list for couples and families. Save products from any store, compare options together, avoid duplicates, and stay on budget.',
  alternates: { canonical: '/use-cases/family-shopping' },
  openGraph: {
    title: 'Shared Shopping List App for Couples and Families — Tote',
    description:
      'Shop together with one shared shopping board for furniture, school supplies, gifts, or any household project.',
  },
};

export default function FamilyShoppingPage() {
  return (
    <article className={styles.article}>
      <h1>Shop together — without the group chat</h1>
      <p className={styles.lead}>
        You text a link. They screenshot a different one. Someone buys the same
        thing twice. Tote gives your household one shared shopping board, so
        everyone sees the same options and decisions in one place.
      </p>

      <div className={styles.heroIllustration} aria-hidden="true">
        <svg viewBox="0 0 160 160">
          <circle
            cx="60"
            cy="90"
            r="35"
            fill="var(--color-peach)"
            opacity="0.7"
          />
          <circle
            cx="100"
            cy="90"
            r="35"
            fill="var(--color-peach)"
            opacity="0.7"
          />
          <circle
            cx="60"
            cy="55"
            r="14"
            fill="var(--color-peach)"
            opacity="0.9"
          />
          <circle
            cx="100"
            cy="55"
            r="14"
            fill="var(--color-peach)"
            opacity="0.9"
          />
        </svg>
      </div>

      <p>
        <a href="https://tote.tools/collections">
          Get started — it&apos;s free &rarr;
        </a>
      </p>

      <AnswerBlock
        question="How do you keep a shared shopping project usable with another person?"
        answer="Save links from different stores into one shared board, come back later to compare them together, keep the shortlist moving, and let everyone work from the same plan. Tote replaces text-thread chaos with one place to decide."
        accent="var(--color-peach)"
        steps={[
          'Create a shared collection for your project',
          'Everyone saves products from any store',
          'Compare options and pick favorites together',
          'Buy from the same shortlist instead of guessing',
        ]}
      />

      <p>
        Your partner texts you a link to a couch. You screenshot a different
        one. Back-to-school shopping turns into a mess of tabs, texts, and
        &ldquo;did you already buy that?&rdquo; messages. There&apos;s no shared
        view, no coordination, and no budget tracking.
      </p>

      <h2>From group chat chaos to one shared decision</h2>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Save into one board</h3>
        <p className={styles.cardDescription}>
          Instead of sending links back and forth, both people save into the
          same collection. The options stay visible to everyone.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Keep the shortlist moving together</h3>
        <p className={styles.cardDescription}>
          Compare picks side by side, mark favorites, and keep one current
          version of the decision instead of debating across screenshots.
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Buy from the same plan</h3>
        <p className={styles.cardDescription}>
          Budgets, picks, and priorities stay in one place, so both people know
          what is still under consideration and what is already decided.
        </p>
      </div>

      <h2>Try this setup</h2>
      <p>A shared project board usually works best when it stays narrow:</p>
      <ul>
        <li>
          Create one collection for a real project such as &ldquo;New
          Apartment&rdquo; or &ldquo;Back to School&rdquo;
        </li>
        <li>
          Add slots only where they help: room-based slots or simple stages like
          &ldquo;Comparing&rdquo; and &ldquo;Picked&rdquo;
        </li>
        <li>
          Invite the other person right away so both people save into the same
          shortlist from the start
        </li>
      </ul>

      <h2>How it works</h2>
      <ol className={styles.stepList}>
        <li>
          <span>
            <strong>Create a shared collection.</strong> One person creates the
            collection and sends an invite link. The other joins with one click.
          </span>
        </li>
        <li>
          <span>
            <strong>Both save products.</strong> Each person browses stores and
            saves products to the shared collection using the Chrome extension.
            Everything appears in one board.
          </span>
        </li>
        <li>
          <span>
            <strong>Decide together.</strong> Review the options, mark
            favorites, set a budget, and buy when you&apos;re ready. No more
            guessing what the other person found.
          </span>
        </li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          If a shared board starts feeling noisy, split it by project. One board
          for &ldquo;New Apartment&rdquo; usually works better than one giant
          board for everything.
        </p>
      </div>

      <h2>Frequently Asked Questions</h2>

      <h3>Can my partner add items too?</h3>
      <p>
        When you share a collection via invite link, anyone who joins can add
        products, rearrange items, and mark selections — just like you.
      </p>

      <h3>Do we both need accounts for a shared shopping list?</h3>
      <p>
        To add items and collaborate, yes — both people need a free Tote
        account. But if you just want someone to view your picks, make the
        collection public and they can browse without an account.
      </p>

      <h3>Can we have separate collections?</h3>
      <p>
        Absolutely. Each person has their own private collections by default.
        You choose which ones to share. Share a &ldquo;New Home&rdquo;
        collection with your partner while keeping your personal &ldquo;Birthday
        Wishlist&rdquo; private.
      </p>

      <h3>How do we avoid buying the same thing?</h3>
      <p>
        Everything is in one shared board, so both people can see what&apos;s
        been saved and selected. Use selections to mark which items are
        &ldquo;claimed&rdquo; or decided on.
      </p>

      <h2>Related use cases</h2>
      <ul>
        <li>
          <Link href="/use-cases/gift-shopping">
            Gift Lists &amp; Wishlists
          </Link>{' '}
          — coordinate gift-giving and avoid duplicates
        </li>
        <li>
          <Link href="/use-cases/home-renovation">Home Renovation</Link> —
          organize a renovation project with your partner
        </li>
        <li>
          <Link href="/use-cases/personal-style">
            Wardrobe &amp; Style Board
          </Link>{' '}
          — curate your personal wardrobe with shared inspiration
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
                name: 'Can my partner add items too?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'When you share a collection via invite link, anyone who joins can add products, rearrange items, and mark selections — just like you.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do we both need accounts for a shared shopping list?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'To add items and collaborate, yes — both people need a free Tote account. But if you just want someone to view your picks, make the collection public and they can browse without an account.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can we have separate collections?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Absolutely. Each person has their own private collections by default. You choose which ones to share. Share a "New Home" collection with your partner while keeping your personal "Birthday Wishlist" private.',
                },
              },
              {
                '@type': 'Question',
                name: 'How do we avoid buying the same thing?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Everything is in one shared board, so both people can see what\'s been saved and selected. Use selections to mark which items are "claimed" or decided on.',
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
