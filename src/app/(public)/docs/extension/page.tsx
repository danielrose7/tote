import type { Metadata } from "next";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Chrome Extension",
  description:
    "Install and use the Tote Chrome extension to save products with one click. Covers installation, one-click saving, right-click context menu, slot selection, and sign-in.",
  alternates: { canonical: "/docs/extension" },
  openGraph: {
    title: "Chrome Extension — Tote",
    description:
      "Install and use the Tote Chrome extension to save products with one click from any online store.",
  },
};

export default function ExtensionPage() {
  return (
    <article className={styles.article}>
      <h1>Chrome Extension</h1>
      <p className={styles.lead}>
        Tote is a free cross-store shopping organizer. The Chrome extension lets you save products from any online store with a single click or right-click.
      </p>

      <h2>Installing the Extension</h2>
      <ol>
        <li>Open the <strong>Chrome Web Store</strong> and search for "Tote"</li>
        <li>Click <strong>"Add to Chrome"</strong> and confirm the installation</li>
        <li>The Tote icon appears in your browser toolbar (you may need to click the puzzle-piece icon to pin it)</li>
      </ol>

      <h2>Signing In</h2>
      <p>
        After installing, click the Tote icon to open the popup. You'll be prompted to sign in with the same account you use on tote.tools. Once signed in, your collections sync automatically between the extension and the web app.
      </p>

      <h2>Saving a Product</h2>
      <p>
        There are two ways to save a product:
      </p>

      <h3>One-Click Save</h3>
      <ol>
        <li>Navigate to any product page</li>
        <li>Click the Tote extension icon in your toolbar</li>
        <li>Choose which collection to save to</li>
        <li>Optionally select a slot within the collection</li>
        <li>Click <strong>"Save"</strong></li>
      </ol>
      <p>
        The product image, title, price, and URL are captured automatically.
      </p>

      <h3>Right-Click Context Menu</h3>
      <p>
        Right-click anywhere on a product page and select <strong>"Save to Tote"</strong> from the context menu. The product is saved to your most recently used collection.
      </p>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          The right-click method is the fastest way to save — it skips the popup entirely and saves to your last-used collection.
        </p>
      </div>

      <h2>Choosing a Collection and Slot</h2>
      <p>
        When saving via the popup, you can pick any existing collection from the dropdown. If the collection has slots, a second dropdown appears so you can place the product directly into the right group.
      </p>
      <p>
        You can also create a new collection directly from the extension popup without leaving the page you're on.
      </p>

      <h2>What Gets Captured</h2>
      <p>
        The extension extracts metadata from the product page:
      </p>
      <ul>
        <li><strong>Product name</strong> — the title of the product</li>
        <li><strong>Image</strong> — the main product photo</li>
        <li><strong>Price</strong> — the current listed price</li>
        <li><strong>URL</strong> — a link back to the original page</li>
        <li><strong>Brand</strong> — detected from the page when available</li>
        <li><strong>Platform</strong> — the store or marketplace (e.g., Amazon, IKEA)</li>
      </ul>

      <h2>Supported Stores</h2>
      <p>
        Tote works on virtually any online store. It uses standard product metadata (Open Graph, JSON-LD, meta tags) to extract product details. Stores with richer metadata yield better results, but even a basic product page will capture the title, image, and URL.
      </p>

      <h2>Troubleshooting</h2>
      <h3>Extension not showing product details</h3>
      <p>
        Make sure you're on a specific product page, not a category or search results page. The extension works best when there's a single product in focus.
      </p>

      <h3>Not signed in</h3>
      <p>
        If your saved products aren't syncing, open the extension popup and check that you're signed in. Click "Sign in" if needed.
      </p>

      <h2>Related Guides</h2>
      <ul>
        <li><a href="/docs/adding-links">Adding Links</a> — other ways to save products, including manual URL entry</li>
        <li><a href="/docs/getting-started">Getting Started</a> — full setup walkthrough from account creation to first save</li>
        <li><a href="/docs/collections">Collections</a> — how to organize your saved products</li>
      </ul>

      <h2>Frequently Asked Questions</h2>

      <h3>Does Tote work on Firefox or Safari?</h3>
      <p>
        Tote currently supports Chrome (and Chromium-based browsers like Edge and Brave). A Safari extension is on the roadmap. In the meantime, you can use the web app on any browser to <a href="/docs/adding-links">add links manually</a>.
      </p>

      <h3>How do I pin the Tote extension to my toolbar?</h3>
      <p>
        Click the puzzle-piece icon in Chrome's toolbar, find Tote in the list, and click the pin icon next to it. The Tote icon will then stay visible in your toolbar for one-click access.
      </p>

      <h3>Can I save products without opening the popup?</h3>
      <p>
        Yes — right-click any product page and select "Save to Tote" from the context menu. The product is saved to your most recently used collection instantly.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "Does Tote work on Firefox or Safari?", "acceptedAnswer": { "@type": "Answer", "text": "Tote currently supports Chrome and Chromium-based browsers like Edge and Brave. A Safari extension is on the roadmap. You can use the web app on any browser to add links manually." } },
            { "@type": "Question", "name": "How do I pin the Tote extension to my toolbar?", "acceptedAnswer": { "@type": "Answer", "text": "Click the puzzle-piece icon in Chrome's toolbar, find Tote in the list, and click the pin icon next to it. The Tote icon will then stay visible in your toolbar." } },
            { "@type": "Question", "name": "Can I save products without opening the popup?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — right-click any product page and select \"Save to Tote\" from the context menu. The product is saved to your most recently used collection instantly." } },
          ],
        }) }}
      />
    </article>
  );
}
