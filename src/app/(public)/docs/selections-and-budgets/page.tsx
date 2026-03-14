import type { Metadata } from "next";
import { AnchorHeading } from "../AnchorHeading";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Selections & Budgets",
  description:
    "Learn how to use product selections and budgets in Tote. Mark favorites, set selection limits, track collection and slot budgets, and see over-budget indicators.",
  alternates: { canonical: "/docs/selections-and-budgets" },
  openGraph: {
    title: "Selections & Budgets — Tote",
    description:
      "Learn how to use product selections and budgets in Tote to pick favorites and track spending.",
  },
};

export default function SelectionsAndBudgetsPage() {
  return (
    <article className={styles.article}>
      <h1>Selections &amp; Budgets</h1>
      <p className={styles.lead}>
        Tote saves products from any online store in one place. Use selections to mark your favorite products and budgets to track spending — two features that help you narrow down choices and stay on target.
      </p>

      <AnchorHeading as="h2" id="product-selections">Product Selections</AnchorHeading>
      <p>
        When you're comparing multiple options, selections let you mark which products you've decided on (or are leaning toward). Think of it as starring your favorites within a collection.
      </p>

      <AnchorHeading as="h3" id="how-to-select-a-product">How to Select a Product</AnchorHeading>
      <p>
        Click the select button on any product card to mark it as selected. Selected products get a visual indicator so they stand out from the rest.
      </p>

      <AnchorHeading as="h3" id="selection-counters">Selection Counters</AnchorHeading>
      <p>
        Slots display an <strong>X / Y</strong> counter showing how many products you've selected out of the selection limit. For example, "2 / 3" means you've selected 2 products out of a maximum of 3.
      </p>

      <AnchorHeading as="h3" id="selection-limits">Selection Limits</AnchorHeading>
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

      <AnchorHeading as="h2" id="budgets">Budgets</AnchorHeading>
      <p>
        Budgets help you track the total cost of your selections against a spending target.
      </p>

      <AnchorHeading as="h3" id="collection-budgets">Collection Budgets</AnchorHeading>
      <p>
        Set an overall budget for a collection to see at a glance whether your selected products fit within your spending plan. The collection header shows the total price of selected items compared to your budget.
      </p>

      <AnchorHeading as="h3" id="slot-budgets">Slot Budgets</AnchorHeading>
      <p>
        Each slot can have its own budget, independent of the collection budget. This is useful when you have category-specific limits — like "$500 for seating" and "$200 for lighting" within a larger room renovation.
      </p>

      <AnchorHeading as="h3" id="over-budget-indicators">Over-Budget Indicators</AnchorHeading>
      <p>
        When the total price of your selected products exceeds the budget, Tote shows a visual indicator so you know you need to make adjustments. This works at both the collection and slot level.
      </p>

      <AnchorHeading as="h2" id="selections-budgets-together">Selections + Budgets Together</AnchorHeading>
      <p>
        Selections and budgets work hand in hand. Only <strong>selected</strong> products count toward the budget total. This means you can save many options, mark your favorites, and immediately see whether your picks fit your budget — without unselected options skewing the numbers.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Example:</span>
          You're furnishing a living room with a $2,000 budget. You save 8 couches, 5 coffee tables, and 10 lamps. As you select your top picks in each slot, the budget tracker updates in real time — helping you balance splurges in one category with savings in another.
        </p>
      </div>

      <AnchorHeading as="h2" id="related-guides">Related Guides</AnchorHeading>
      <ul>
        <li><a href="/docs/collections">Collections</a> — set budgets at the collection level</li>
        <li><a href="/docs/slots">Slots</a> — set per-slot budgets and selection limits</li>
        <li><a href="/docs/sharing">Sharing</a> — collaborators can select products in shared collections</li>
      </ul>

      <AnchorHeading as="h2" id="frequently-asked-questions">Frequently Asked Questions</AnchorHeading>

      <AnchorHeading as="h3" id="faq-unselected-count">Do unselected products count toward the budget?</AnchorHeading>
      <p>
        No. Only selected products are included in the budget total. This lets you save many options and compare freely without inflating the number.
      </p>

      <AnchorHeading as="h3" id="faq-budget-without-limits">Can I set a budget without using selection limits?</AnchorHeading>
      <p>
        Yes. Budgets and selection limits are independent features. You can set a budget on a collection or <a href="/docs/slots">slot</a> without restricting how many products can be selected — or use selection limits without a budget.
      </p>

      <AnchorHeading as="h3" id="faq-where-set-budget">Where do I set a budget?</AnchorHeading>
      <p>
        You can set a budget on a collection by editing the collection, or on individual slots by clicking the edit button on the slot header. See <a href="/docs/collections">Collections</a> and <a href="/docs/slots">Slots</a> for details.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "Do unselected products count toward the budget?", "acceptedAnswer": { "@type": "Answer", "text": "No. Only selected products are included in the budget total. This lets you save many options and compare freely without inflating the number." } },
            { "@type": "Question", "name": "Can I set a budget without using selection limits?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Budgets and selection limits are independent features. You can set a budget on a collection or slot without restricting how many products can be selected — or use selection limits without a budget." } },
            { "@type": "Question", "name": "Where do I set a budget?", "acceptedAnswer": { "@type": "Answer", "text": "You can set a budget on a collection by editing the collection, or on individual slots by clicking the edit button on the slot header." } },
          ],
        }) }}
      />
    </article>
  );
}
