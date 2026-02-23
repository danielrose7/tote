import styles from "../docs.module.css";

export default function AddingLinksPage() {
  return (
    <article className={styles.article}>
      <h1>Adding Links</h1>
      <p className={styles.lead}>
        Save products to Tote using the browser extension for one-click saving, or add links manually from any device.
      </p>

      <h2>Using the Browser Extension</h2>
      <p>
        The fastest way to save products is with the Tote browser extension for Chrome. Once installed, you can save any product page with a single click.
      </p>

      <h3>Installing the Extension</h3>
      <ol>
        <li>Visit the Chrome Web Store and search for "Tote"</li>
        <li>Click "Add to Chrome" to install</li>
        <li>Sign in with your Tote account to sync your saved products</li>
      </ol>

      <h3>Saving a Product</h3>
      <ol>
        <li>Navigate to any product page you want to save</li>
        <li>Click the Tote extension icon in your browser toolbar</li>
        <li>Choose which collection to save to (or create a new one)</li>
        <li>The product image, title, price, and link are automatically captured</li>
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>Tip:</span>
          The extension works best on product detail pages. If you're on a category or search results page, click through to the specific product first.
        </p>
      </div>

      <h2>Adding Links Manually</h2>
      <p>
        You can also add products directly from the Tote web app. This is useful when you're on a device without the extension or want to add a link someone shared with you.
      </p>

      <h3>To Add a Link Manually</h3>
      <ol>
        <li>Open the collection where you want to add the product</li>
        <li>Click "Add Link" in the header</li>
        <li>Paste the product URL</li>
        <li>Tote will automatically fetch the product details</li>
      </ol>

      <h2>What Gets Saved</h2>
      <p>
        When you save a product, Tote captures:
      </p>
      <ul>
        <li><strong>Product name</strong> — the title from the product page</li>
        <li><strong>Image</strong> — the main product photo</li>
        <li><strong>Price</strong> — the current listed price</li>
        <li><strong>URL</strong> — so you can always get back to the original page</li>
        <li><strong>Description</strong> — a summary when available</li>
      </ul>

      <h2>Refreshing Product Data</h2>
      <p>
        Product details can change over time—prices drop, items sell out, listings get updated. Use the refresh button on any product to fetch the latest information from the original page.
      </p>
    </article>
  );
}
