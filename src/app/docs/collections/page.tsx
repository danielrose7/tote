import styles from "../docs.module.css";

export default function CollectionsPage() {
  return (
    <article className={styles.article}>
      <h1>Collections</h1>
      <p className={styles.lead}>
        Collections are the top-level way to organize your saved products. Think of them as folders or boards for different projects, seasons, or themes.
      </p>

      <h2>What is a Collection?</h2>
      <p>
        A collection is a container that holds all the products related to a specific purpose. You might have collections for:
      </p>
      <ul>
        <li><strong>Home renovation</strong> — furniture, decor, and supplies for a room makeover</li>
        <li><strong>Gift ideas</strong> — presents you're considering for friends and family</li>
        <li><strong>Wardrobe refresh</strong> — clothing and accessories for the upcoming season</li>
        <li><strong>Wish list</strong> — things you want to buy someday</li>
      </ul>

      <h2>Creating a Collection</h2>
      <p>
        To create a new collection, go to your collections page and click the "Add Collection" button. Give it a name and optionally choose a color to help you identify it at a glance.
      </p>

      <h2>Collection Features</h2>
      <h3>Colors</h3>
      <p>
        Each collection can have its own color, making it easy to visually distinguish between different projects when viewing your collections list.
      </p>

      <h3>View Modes</h3>
      <p>
        Collections can be displayed in grid view (visual cards with images) or table view (compact list with details). Choose the view that works best for how you like to browse.
      </p>

      <h3>Budget Tracking</h3>
      <p>
        Set an optional budget for your collection to track spending. Tote will show you the total value of products in the collection compared to your budget.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          Start simple with just one or two collections. You can always reorganize later as your needs evolve.
        </p>
      </div>

      <h2>Collections vs. Slots</h2>
      <p>
        Collections are your main organizational unit. If you need more granular organization <em>within</em> a collection, that's where slots come in. See the <a href="/docs/slots">Slots documentation</a> to learn more.
      </p>
    </article>
  );
}
