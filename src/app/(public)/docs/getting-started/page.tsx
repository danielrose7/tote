import type { Metadata } from "next";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Getting Started — Tote Help",
  description:
    "Get started with Tote in minutes. Sign up, install the Chrome extension, save your first product, and organize your shopping across every store.",
  openGraph: {
    title: "Getting Started — Tote Help",
    description:
      "Get started with Tote in minutes. Sign up, install the Chrome extension, and save your first product.",
    url: "https://tote.tools/docs/getting-started",
    siteName: "Tote",
  },
};

export default function GettingStartedPage() {
  return (
    <article className={styles.article}>
      <h1>Getting Started</h1>
      <p className={styles.lead}>
        Set up Tote in a few minutes and start saving products from any online store.
      </p>

      <h2>1. Create Your Account</h2>
      <p>
        Head to <a href="https://tote.tools">tote.tools</a> and sign up with your email or Google account. Your account keeps your saved products synced across all your devices.
      </p>

      <h2>2. Install the Chrome Extension</h2>
      <p>
        The browser extension is the fastest way to save products. Install it from the Chrome Web Store, then sign in with the same account you just created.
      </p>
      <p>
        See the <a href="/docs/extension">Chrome Extension guide</a> for detailed setup instructions.
      </p>

      <h2>3. Save Your First Product</h2>
      <p>
        Navigate to any product page — a pair of shoes, a piece of furniture, a kitchen gadget — and click the Tote extension icon in your toolbar. Choose a collection (or use the default one) and the product is saved instantly.
      </p>
      <p>
        Tote automatically captures the product name, image, price, and link back to the original page.
      </p>

      <h2>4. Organize with Collections</h2>
      <p>
        Collections are folders for your saved products. You might create one for "Living Room Furniture", another for "Gift Ideas", and another for "Wardrobe". Create as many as you need.
      </p>
      <p>
        Learn more in the <a href="/docs/collections">Collections guide</a>.
      </p>

      <h2>5. Keep Shopping</h2>
      <p>
        As you browse different stores, keep saving products to Tote. Everything stays in one place regardless of which store it came from. Come back anytime to review, compare, or buy.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          You can also right-click any product page and select "Save to Tote" from the context menu — no need to open the extension popup.
        </p>
      </div>

      <h2>Next Steps</h2>
      <ul>
        <li><a href="/docs/collections">Collections</a> — organize products into groups</li>
        <li><a href="/docs/slots">Slots</a> — subdivide collections for more detail</li>
        <li><a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> — pick favorites and track spending</li>
        <li><a href="/docs/sharing">Sharing</a> — collaborate on wishlists with others</li>
      </ul>
    </article>
  );
}
