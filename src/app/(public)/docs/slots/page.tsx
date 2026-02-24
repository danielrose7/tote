import type { Metadata } from "next";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Slots — Tote Help",
  description:
    "Learn how to use slots in Tote to subdivide collections. Organize products into categories, set per-slot budgets, and manage selection limits.",
  openGraph: {
    title: "Slots — Tote Help",
    description:
      "Learn how to use slots in Tote to subdivide collections into categories with budgets and selection limits.",
    url: "https://tote.tools/docs/slots",
    siteName: "Tote",
  },
};

export default function SlotsPage() {
  return (
    <article className={styles.article}>
      <h1>Slots</h1>
      <p className={styles.lead}>
        Tote saves products from any online store and organizes them into collections. Slots are optional groupings within a collection — use them when you need to break things down further into categories, budget tiers, or decision-making groups.
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

      <h2>Collapse and Expand</h2>
      <p>
        Slots can be collapsed to hide their products, giving you a compact overview of your collection structure. Click the slot header to toggle between collapsed and expanded views. This is especially helpful when you have many slots and want to focus on one at a time.
      </p>

      <h2>Reordering Slots</h2>
      <p>
        Drag and drop slots to rearrange their order within a collection. You can also drag products between slots to reorganize them.
      </p>

      <h2>Deleting a Slot</h2>
      <p>
        When you delete a slot, the products inside it aren't deleted — they move to the "Ungrouped" section at the bottom of the collection. This means you can safely remove a slot without losing any saved products.
      </p>

      <h2>Ungrouped Products</h2>
      <p>
        Products that aren't in any slot appear in an "Ungrouped" section at the bottom of the collection. You can leave them there or drag them into slots as you organize.
      </p>

      <h2>Related Guides</h2>
      <ul>
        <li><a href="/docs/collections">Collections</a> — the top-level folders that contain slots</li>
        <li><a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> — selection limits and budgets work per slot</li>
        <li><a href="/docs/adding-links">Adding Links</a> — save products directly into a specific slot</li>
      </ul>

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
