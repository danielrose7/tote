import type { Metadata } from "next";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Selections & Budgets — Tote Help",
  description:
    "Learn how to use product selections and budgets in Tote. Mark favorites, set selection limits, track collection and slot budgets, and see over-budget indicators.",
  openGraph: {
    title: "Selections & Budgets — Tote Help",
    description:
      "Learn how to use product selections and budgets in Tote to pick favorites and track spending.",
    url: "https://tote.tools/docs/selections-and-budgets",
    siteName: "Tote",
  },
};

export default function SelectionsAndBudgetsPage() {
  return (
    <article className={styles.article}>
      <h1>Selections &amp; Budgets</h1>
      <p className={styles.lead}>
        Tote saves products from any online store in one place. Use selections to mark your favorite products and budgets to track spending — two features that help you narrow down choices and stay on target.
      </p>

      <h2>Product Selections</h2>
      <p>
        When you're comparing multiple options, selections let you mark which products you've decided on (or are leaning toward). Think of it as starring your favorites within a collection.
      </p>

      <h3>How to Select a Product</h3>
      <p>
        Click the select button on any product card to mark it as selected. Selected products get a visual indicator so they stand out from the rest.
      </p>

      <h3>Selection Counters</h3>
      <p>
        Slots display an <strong>X / Y</strong> counter showing how many products you've selected out of the selection limit. For example, "2 / 3" means you've selected 2 products out of a maximum of 3.
      </p>

      <h3>Selection Limits</h3>
      <p>
        You can set a maximum number of selections per slot. This is useful when you're making decisions:
      </p>
      <ul>
        <li>Choosing <strong>1 couch</strong> from 5 options — set the limit to 1</li>
        <li>Picking <strong>3 wall art pieces</strong> from a dozen — set the limit to 3</li>
        <li>No limit needed? Leave it unset and select as many as you like</li>
      </ul>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          When you hover over a product card, the selection badge animates toward the select button — a subtle hint that you can click to toggle the selection.
        </p>
      </div>

      <h2>Budgets</h2>
      <p>
        Budgets help you track the total cost of your selections against a spending target.
      </p>

      <h3>Collection Budgets</h3>
      <p>
        Set an overall budget for a collection to see at a glance whether your selected products fit within your spending plan. The collection header shows the total price of selected items compared to your budget.
      </p>

      <h3>Slot Budgets</h3>
      <p>
        Each slot can have its own budget, independent of the collection budget. This is useful when you have category-specific limits — like "$500 for seating" and "$200 for lighting" within a larger room renovation.
      </p>

      <h3>Over-Budget Indicators</h3>
      <p>
        When the total price of your selected products exceeds the budget, Tote shows a visual indicator so you know you need to make adjustments. This works at both the collection and slot level.
      </p>

      <h2>Selections + Budgets Together</h2>
      <p>
        Selections and budgets work hand in hand. Only <strong>selected</strong> products count toward the budget total. This means you can save many options, mark your favorites, and immediately see whether your picks fit your budget — without unselected options skewing the numbers.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Example:</span>
          You're furnishing a living room with a $2,000 budget. You save 8 couches, 5 coffee tables, and 10 lamps. As you select your top picks in each slot, the budget tracker updates in real time — helping you balance splurges in one category with savings in another.
        </p>
      </div>
    </article>
  );
}
