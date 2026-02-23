import styles from "../docs.module.css";

export default function SlotsPage() {
  return (
    <article className={styles.article}>
      <h1>Slots</h1>
      <p className={styles.lead}>
        Slots are optional groupings within a collection. Use them when you need to organize products into categories, budget tiers, or decision-making groups.
      </p>

      <h2>What is a Slot?</h2>
      <p>
        A slot is a way to subdivide a collection. While collections organize products by project or theme, slots help you organize products <em>within</em> that project. For example:
      </p>
      <ul>
        <li>A <strong>Living Room</strong> collection might have slots for "Seating", "Lighting", and "Decor"</li>
        <li>A <strong>Gift Ideas</strong> collection might have slots for "Under $25", "$25-50", and "Splurge"</li>
        <li>A <strong>Wardrobe</strong> collection might have slots for "Tops", "Bottoms", and "Accessories"</li>
      </ul>

      <h2>When to Use Slots</h2>
      <p>
        Slots are completely optional. Many people find that collections alone are enough to stay organized. Consider using slots when:
      </p>
      <ul>
        <li>You have many products in a single collection and want to group them</li>
        <li>You're comparing options for specific needs (e.g., "which couch to buy?")</li>
        <li>You want to set different budgets for different categories</li>
        <li>You're planning with multiple decision points</li>
      </ul>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          You don't have to use slots at all. If your collection only has a handful of products, slots might add unnecessary complexity. Start without them and add slots later if you find yourself wanting to group things.
        </p>
      </div>

      <h2>Creating a Slot</h2>
      <p>
        Inside a collection, click "Add Slot" to create a new grouping. Give it a name that describes what products belong there. You can then drag products into the slot or add new products directly to it.
      </p>

      <h2>Slot Features</h2>
      <h3>Budget per Slot</h3>
      <p>
        Each slot can have its own budget, separate from the collection budget. This is useful when you have specific spending limits for different categories—like "$200 for lighting" within a larger renovation budget.
      </p>

      <h3>Selection Limits</h3>
      <p>
        Slots can have a maximum selection count, helping you narrow down choices. For example, if you're choosing one coffee table from five options, set the limit to 1 and mark your favorite as selected.
      </p>

      <h2>Ungrouped Products</h2>
      <p>
        Products that aren't in any slot appear in an "Ungrouped" section at the bottom of the collection. You can leave them there or drag them into slots as you organize.
      </p>

      <h2>Collections vs. Slots: Quick Reference</h2>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Use a Collection when...</h3>
        <p className={styles.cardDescription}>
          You're starting a new project, theme, or category of products. Collections are your main organizational unit—like folders on your computer.
        </p>
      </div>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Use a Slot when...</h3>
        <p className={styles.cardDescription}>
          You need to group products within an existing collection. Slots are subcategories—like sections within a folder.
        </p>
      </div>
    </article>
  );
}
