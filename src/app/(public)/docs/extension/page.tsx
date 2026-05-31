import type { Metadata } from "next";
import { CHROME_WEB_STORE_URL } from "../../../../lib/constants";
import { AnchorHeading } from "../AnchorHeading";
import styles from "../docs.module.css";

export const metadata: Metadata = {
	title: "Browser Extension",
	description:
		"Install and use the Tote browser extension on Chrome, Edge, Brave, or Arc to save products with one click. Covers installation, one-click saving, right-click context menu, slot selection, and sign-in.",
	alternates: { canonical: "/docs/extension" },
	openGraph: {
		title: "Browser Extension — Tote",
		description:
			"Install and use the Tote browser extension on Chrome, Edge, Brave, or Arc to save products with one click from any online store.",
	},
};

export default function ExtensionPage() {
	return (
		<article className={styles.article}>
			<h1>Browser Extension</h1>
			<p className={styles.lead}>
				Tote is a free cross-store shopping organizer. The browser extension
				lets you save products from any online store with a single click or
				right-click. It works on Chrome, Edge, Brave, Arc, and any
				Chromium-based browser.
			</p>
			<p>
				Looking for the short version? Visit the{" "}
				<a href="/chrome-extension">Tote Chrome extension landing page</a> for
				the install link, supported browsers, and a quick product overview.
			</p>

			<AnchorHeading as="h2" id="installing-the-extension">
				Installing the Extension
			</AnchorHeading>
			<ol>
				<li>
					Visit the{" "}
					<a
						href={CHROME_WEB_STORE_URL}
						target="_blank"
						rel="noopener noreferrer"
					>
						Tote page on the Chrome Web Store
					</a>{" "}
					(this works for Edge, Brave, and Arc too)
				</li>
				<li>
					Click <strong>"Add to Chrome"</strong> and confirm the installation
				</li>
				<li>
					The Tote icon appears in your browser toolbar (you may need to click
					the puzzle-piece icon to pin it)
				</li>
			</ol>

			<AnchorHeading as="h2" id="signing-in">
				Signing In
			</AnchorHeading>
			<p>
				After installing, click the Tote icon to open the popup. You'll be
				prompted to sign in with the same account you use on tote.tools. Once
				signed in, your collections sync automatically between the extension and
				the web app.
			</p>

			<AnchorHeading as="h2" id="saving-a-product">
				Saving a Product
			</AnchorHeading>
			<p>There are two ways to save a product:</p>

			<AnchorHeading as="h3" id="one-click-save">
				One-Click Save
			</AnchorHeading>
			<ol>
				<li>Navigate to any product page</li>
				<li>Click the Tote extension icon in your toolbar</li>
				<li>Choose which collection to save to</li>
				<li>Optionally select a slot within the collection</li>
				<li>
					Click <strong>"Save"</strong>
				</li>
			</ol>
			<p>
				The product image, title, price, and URL are captured automatically.
			</p>

			<AnchorHeading as="h3" id="right-click-context-menu">
				Right-Click Context Menu
			</AnchorHeading>
			<p>
				Right-click anywhere on a product page and select{" "}
				<strong>"Save to Tote"</strong> from the context menu. The product is
				saved to your most recently used collection.
			</p>

			<div className={styles.tip}>
				<p>
					<span className={styles.tipLabel}>Tip:</span>
					The right-click method is the fastest way to save — it skips the popup
					entirely and saves to your last-used collection.
				</p>
			</div>

			<AnchorHeading as="h2" id="choosing-a-collection-and-slot">
				Choosing a Collection and Slot
			</AnchorHeading>
			<p>
				When saving via the popup, you can pick any existing collection from the
				dropdown. If the collection has slots, a second dropdown appears so you
				can place the product directly into the right group.
			</p>
			<p>
				You can also create a new collection directly from the extension popup
				without leaving the page you're on.
			</p>

			<AnchorHeading as="h2" id="what-gets-captured">
				What Gets Captured
			</AnchorHeading>
			<p>The extension extracts metadata from the product page:</p>
			<ul>
				<li>
					<strong>Product name</strong> — the title of the product
				</li>
				<li>
					<strong>Image</strong> — the main product photo
				</li>
				<li>
					<strong>Price</strong> — the current listed price
				</li>
				<li>
					<strong>URL</strong> — a link back to the original page
				</li>
				<li>
					<strong>Brand</strong> — detected from the page when available
				</li>
				<li>
					<strong>Platform</strong> — the store or marketplace (e.g., Amazon,
					IKEA)
				</li>
			</ul>

			<AnchorHeading as="h2" id="permissions-and-privacy">
				Permissions and Privacy
			</AnchorHeading>
			<p>
				The extension asks for browser permissions so it can read the active
				product page, open the popup, store your extension session, and offer
				the right-click save action. Tote uses those permissions to save
				products to your account. Tote does not sell your shopping behavior or
				run an ad network.
			</p>
			<ul>
				<li>
					<strong>activeTab and tabs</strong> — identify the page you are trying
					to save
				</li>
				<li>
					<strong>storage</strong> — remember extension state, like the last
					collection you used
				</li>
				<li>
					<strong>cookies</strong> — keep your Tote sign-in connected through
					Clerk
				</li>
				<li>
					<strong>contextMenus</strong> — show the "Save to Tote" right-click
					action
				</li>
				<li>
					<strong>scripting and host access</strong> — read product metadata
					from the page you are saving
				</li>
			</ul>

			<AnchorHeading as="h2" id="supported-stores">
				Supported Stores
			</AnchorHeading>
			<p>
				Tote works on virtually any online store. It reads the page you're on to
				identify the product name, image, and price. Most stores provide enough
				information for a complete save, but even a basic product page will
				capture the title, image, and URL.
			</p>

			<AnchorHeading as="h2" id="updates">
				Updates
			</AnchorHeading>
			<p>
				Chrome and other Chromium browsers update extensions automatically from
				the Chrome Web Store. If you think you are not on the latest version,
				open your browser's Extensions page, enable developer mode, and click
				"Update". You can check the installed Tote version from the extension
				details page.
			</p>

			<AnchorHeading as="h2" id="troubleshooting">
				Troubleshooting
			</AnchorHeading>
			<AnchorHeading as="h3" id="extension-not-showing-product-details">
				Extension not showing product details
			</AnchorHeading>
			<p>
				Make sure you're on a specific product page, not a category or search
				results page. The extension works best when there's a single product in
				focus.
			</p>

			<AnchorHeading as="h3" id="missing-price-or-image">
				Missing price, image, or brand
			</AnchorHeading>
			<p>
				Some stores hide product data, render it after a delay, or use unusual
				page markup. Save the item anyway if the title, image, or URL is enough
				to recognize it later. You can edit the saved product in Tote, or try
				refreshing the product page and saving again.
			</p>

			<AnchorHeading as="h3" id="not-signed-in">
				Not signed in
			</AnchorHeading>
			<p>
				If your saved products aren't syncing, open the extension popup and
				check that you're signed in. Click "Sign in" if needed.
			</p>

			<AnchorHeading as="h3" id="right-click-save-wrong-collection">
				Right-click save used the wrong collection
			</AnchorHeading>
			<p>
				The right-click action saves to your most recently used collection. Open
				the popup, choose the collection you want, and save once from the popup.
				After that, right-click saves will use that collection.
			</p>

			<AnchorHeading as="h2" id="related-guides">
				Related Guides
			</AnchorHeading>
			<ul>
				<li>
					<a href="/docs/adding-links">Adding Links</a> — other ways to save
					products, including manual URL entry
				</li>
				<li>
					<a href="/docs/getting-started">Getting Started</a> — full setup
					walkthrough from account creation to first save
				</li>
				<li>
					<a href="/docs/collections">Collections</a> — how to organize your
					saved products
				</li>
			</ul>

			<AnchorHeading as="h2" id="frequently-asked-questions">
				Frequently Asked Questions
			</AnchorHeading>

			<AnchorHeading as="h3" id="faq-firefox-safari">
				Does Tote work on Firefox or Safari?
			</AnchorHeading>
			<p>
				Tote works on Chrome, Edge, Brave, Arc, and any Chromium-based browser.
				A Safari extension is on the roadmap. In the meantime, you can use the
				web app on any browser to{" "}
				<a href="/docs/adding-links">add links manually</a>.
			</p>

			<AnchorHeading as="h3" id="faq-pin-extension">
				How do I pin the Tote extension to my toolbar?
			</AnchorHeading>
			<p>
				Click the puzzle-piece icon in Chrome's toolbar, find Tote in the list,
				and click the pin icon next to it. The Tote icon will then stay visible
				in your toolbar for one-click access.
			</p>

			<AnchorHeading as="h3" id="faq-save-without-popup">
				Can I save products without opening the popup?
			</AnchorHeading>
			<p>
				Yes — right-click any product page and select "Save to Tote" from the
				context menu. The product is saved to your most recently used collection
				instantly.
			</p>

			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "FAQPage",
						mainEntity: [
							{
								"@type": "Question",
								name: "Does Tote work on Firefox or Safari?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Tote works on Chrome, Edge, Brave, Arc, and any Chromium-based browser. A Safari extension is on the roadmap. You can use the web app on any browser to add links manually.",
								},
							},
							{
								"@type": "Question",
								name: "How do I pin the Tote extension to my toolbar?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Click the puzzle-piece icon in Chrome's toolbar, find Tote in the list, and click the pin icon next to it. The Tote icon will then stay visible in your toolbar.",
								},
							},
							{
								"@type": "Question",
								name: "Can I save products without opening the popup?",
								acceptedAnswer: {
									"@type": "Answer",
									text: 'Yes — right-click any product page and select "Save to Tote" from the context menu. The product is saved to your most recently used collection instantly.',
								},
							},
						],
					}),
				}}
			/>
		</article>
	);
}
