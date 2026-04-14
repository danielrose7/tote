import type { Metadata } from "next";
import { AnchorHeading } from "../AnchorHeading";
import styles from "../docs.module.css";

export const metadata: Metadata = {
	title: "Adding Links",
	description:
		"Learn how to save products to Tote using the Chrome extension or by adding links manually. Covers one-click saving, right-click context menu, and product notes.",
	alternates: { canonical: "/docs/adding-links" },
	openGraph: {
		title: "Adding Links — Tote",
		description:
			"Learn how to save products to Tote using the Chrome extension or by adding links manually.",
	},
};

export default function AddingLinksPage() {
	return (
		<article className={styles.article}>
			<h1>Adding Links</h1>
			<p className={styles.lead}>
				Tote is a free cross-store shopping organizer. Save products using the
				Chrome extension for one-click saving, or add links manually from any
				device.
			</p>

			<AnchorHeading as="h2" id="using-the-browser-extension">
				Using the Browser Extension
			</AnchorHeading>
			<p>
				The fastest way to save products is with the Tote browser extension for
				Chrome. Once installed, you can save any product page with a single
				click.
			</p>

			<AnchorHeading as="h3" id="installing-the-extension">
				Installing the Extension
			</AnchorHeading>
			<ol>
				<li>Visit the Chrome Web Store and search for "Tote"</li>
				<li>Click "Add to Chrome" to install</li>
				<li>Sign in with your Tote account to sync your saved products</li>
			</ol>

			<AnchorHeading as="h3" id="saving-a-product">
				Saving a Product
			</AnchorHeading>
			<ol>
				<li>Navigate to any product page you want to save</li>
				<li>Click the Tote extension icon in your browser toolbar</li>
				<li>Choose which collection to save to (or create a new one)</li>
				<li>
					The product image, title, price, and link are automatically captured
				</li>
			</ol>

			<div className={styles.tip}>
				<p>
					<span className={styles.tipLabel}>Tip:</span>
					The extension works best on product detail pages. If you're on a
					category or search results page, click through to the specific product
					first.
				</p>
			</div>

			<AnchorHeading as="h2" id="adding-links-manually">
				Adding Links Manually
			</AnchorHeading>
			<p>
				You can also add products directly from the Tote web app. This is useful
				when you're on a device without the extension or want to add a link
				someone shared with you.
			</p>

			<AnchorHeading as="h3" id="to-add-a-link-manually">
				To Add a Link Manually
			</AnchorHeading>
			<ol>
				<li>Open the collection where you want to add the product</li>
				<li>Click "Add Link" in the header</li>
				<li>Paste the product URL</li>
				<li>Tote will automatically fetch the product details</li>
			</ol>

			<AnchorHeading as="h2" id="what-gets-saved">
				What Gets Saved
			</AnchorHeading>
			<p>When you save a product, Tote captures:</p>
			<ul>
				<li>
					<strong>Product name</strong> — the title from the product page
				</li>
				<li>
					<strong>Image</strong> — the main product photo
				</li>
				<li>
					<strong>Price</strong> — the current listed price
				</li>
				<li>
					<strong>URL</strong> — so you can always get back to the original page
				</li>
				<li>
					<strong>Description</strong> — a summary when available
				</li>
			</ul>

			<AnchorHeading as="h2" id="right-click-save-to-tote">
				Right-Click "Save to Tote"
			</AnchorHeading>
			<p>
				With the Chrome extension installed, you can right-click any product
				page and select <strong>"Save to Tote"</strong> from the context menu.
				This saves the product to your most recently used collection without
				opening the extension popup.
			</p>

			<AnchorHeading as="h2" id="product-notes">
				Product Notes
			</AnchorHeading>
			<p>
				After saving a product, you can add personal notes — size preferences,
				color choices, gift recipient, or anything else you want to remember.
				Click on a saved product to open its details and type in the notes
				field.
			</p>

			<AnchorHeading as="h2" id="editing-saved-products">
				Editing Saved Products
			</AnchorHeading>
			<p>
				You can edit the title, price, or notes of any saved product. Click on
				the product to open its details, make your changes, and they're saved
				automatically.
			</p>

			<AnchorHeading as="h2" id="platform-and-brand-detection">
				Platform and Brand Detection
			</AnchorHeading>
			<p>
				Tote automatically detects the store or marketplace (Amazon, IKEA, Etsy,
				etc.) and the product brand when this information is available on the
				page. This helps you filter and identify products at a glance.
			</p>

			<AnchorHeading as="h2" id="refreshing-product-data">
				Refreshing Product Data
			</AnchorHeading>
			<p>
				Product details can change over time—prices drop, items sell out,
				listings get updated. Use the refresh button on any product to fetch the
				latest information from the original page.
			</p>

			<AnchorHeading as="h2" id="related-guides">
				Related Guides
			</AnchorHeading>
			<ul>
				<li>
					<a href="/docs/extension">Chrome Extension</a> — detailed extension
					setup, pinning, and troubleshooting
				</li>
				<li>
					<a href="/docs/collections">Collections</a> — organize your saved
					products into groups
				</li>
				<li>
					<a href="/docs/selections-and-budgets">Selections &amp; Budgets</a> —
					mark favorites and track spending on saved products
				</li>
			</ul>
		</article>
	);
}
