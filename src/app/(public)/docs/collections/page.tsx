import type { Metadata } from 'next';
import { AnchorHeading } from '../AnchorHeading';
import styles from '../docs.module.css';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Learn how to create and organize collections in Tote. Group saved products by project, season, or theme with colors, view modes, and budget tracking.',
  alternates: { canonical: '/docs/collections' },
  openGraph: {
    title: 'Collections — Tote',
    description:
      'Learn how to create and organize collections in Tote. Group saved products by project, season, or theme.',
  },
};

export default function CollectionsPage() {
  return (
    <article className={styles.article}>
      <h1>Collections</h1>
      <p className={styles.lead}>
        Tote saves products from any online store in one place. Collections are
        the top-level way to organize those products — think of them as folders
        or boards for different projects, seasons, or themes.
      </p>

      <AnchorHeading as="h2" id="what-is-a-collection">
        What is a Collection?
      </AnchorHeading>
      <p>
        A collection is a container that holds all the products related to a
        specific purpose. You might have collections for:
      </p>
      <ul>
        <li>
          <strong>Home renovation</strong> — furniture, decor, and supplies for
          a room makeover
        </li>
        <li>
          <strong>Gift ideas</strong> — presents you're considering for friends
          and family
        </li>
        <li>
          <strong>Wardrobe refresh</strong> — clothing and accessories for the
          upcoming season
        </li>
        <li>
          <strong>Wish list</strong> — things you want to buy someday
        </li>
      </ul>

      <AnchorHeading as="h2" id="creating-a-collection">
        Creating a Collection
      </AnchorHeading>
      <p>
        To create a new collection, go to your collections page and click the
        "Add Collection" button. Give it a name and optionally choose a color to
        help you identify it at a glance.
      </p>

      <AnchorHeading as="h2" id="collection-features">
        Collection Features
      </AnchorHeading>
      <AnchorHeading as="h3" id="colors">
        Colors
      </AnchorHeading>
      <p>
        Each collection can have its own color, making it easy to visually
        distinguish between different projects when viewing your collections
        list.
      </p>

      <AnchorHeading as="h3" id="view-modes">
        View Modes
      </AnchorHeading>
      <p>
        Collections can be displayed in grid view (visual cards with images) or
        table view (compact list with details). Choose the view that works best
        for how you like to browse.
      </p>

      <AnchorHeading as="h3" id="budget-tracking">
        Budget Tracking
      </AnchorHeading>
      <p>
        Set an optional budget for your collection to track spending. Tote will
        show you the total value of products in the collection compared to your
        budget.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Start simple with just one or two collections. You can always
          reorganize later as your needs evolve.
        </p>
      </div>

      <AnchorHeading as="h2" id="default-collection">
        Default Collection
      </AnchorHeading>
      <p>
        When you save a product without choosing a specific collection, it goes
        to your default collection. This is your general-purpose "inbox" for
        saved products. You can move items out of it into other collections at
        any time.
      </p>

      <AnchorHeading as="h2" id="item-count-badges">
        Item Count Badges
      </AnchorHeading>
      <p>
        Each collection shows a badge with the number of products it contains.
        This gives you a quick sense of how full each collection is without
        opening it.
      </p>

      <AnchorHeading as="h2" id="deleting-a-collection">
        Deleting a Collection
      </AnchorHeading>
      <p>
        To delete a collection, open it and use the collection menu. Deleting a
        collection removes it and all the products inside it, so make sure
        you've moved anything you want to keep.
      </p>

      <AnchorHeading as="h2" id="reordering-collections">
        Reordering Collections
      </AnchorHeading>
      <p>
        Drag and drop collections to reorder them on your collections page. Put
        your most active projects at the top for easy access.
      </p>

      <AnchorHeading as="h2" id="collections-vs-slots">
        Collections vs. Slots
      </AnchorHeading>
      <p>
        Collections are your main organizational unit. If you need more granular
        organization <em>within</em> a collection, that's where slots come in.
        See the <a href="/docs/slots">Slots documentation</a> to learn more.
      </p>

      <AnchorHeading as="h2" id="related-guides">
        Related Guides
      </AnchorHeading>
      <ul>
        <li>
          <a href="/docs/slots">Slots</a> — subdivide collections into
          categories or budget tiers
        </li>
        <li>
          <a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> —
          mark favorites and track spending within collections
        </li>
        <li>
          <a href="/docs/sharing">Sharing</a> — share collections with friends
          or make them public
        </li>
      </ul>

      <AnchorHeading as="h2" id="frequently-asked-questions">
        Frequently Asked Questions
      </AnchorHeading>

      <AnchorHeading as="h3" id="faq-how-many-collections">
        How many collections can I have?
      </AnchorHeading>
      <p>
        There's no limit. Create as many collections as you need — one per
        project, season, room, or any theme that makes sense to you.
      </p>

      <AnchorHeading as="h3" id="faq-move-products">
        Can I move products between collections?
      </AnchorHeading>
      <p>
        Yes. Open a product's details by clicking on it, then change the
        collection from the edit dialog. You can also change which{' '}
        <a href="/docs/slots">slot</a> a product belongs to.
      </p>

      <AnchorHeading as="h3" id="faq-delete-collection">
        What happens when I delete a collection?
      </AnchorHeading>
      <p>
        Deleting a collection permanently removes it along with all the products
        and slots inside it. Make sure to move any products you want to keep to
        another collection first.
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
                name: 'How many collections can I have?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "There's no limit. Create as many collections as you need — one per project, season, room, or any theme that makes sense to you.",
                },
              },
              {
                '@type': 'Question',
                name: 'Can I move products between collections?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Yes. Open a product's details by clicking on it, then change the collection from the edit dialog. You can also change which slot a product belongs to.",
                },
              },
              {
                '@type': 'Question',
                name: 'What happens when I delete a collection?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Deleting a collection permanently removes it along with all the products and slots inside it. Make sure to move any products you want to keep to another collection first.',
                },
              },
            ],
          }),
        }}
      />
    </article>
  );
}
