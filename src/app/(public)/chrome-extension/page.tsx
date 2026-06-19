import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LandingAuthButtons } from "@/components/LandingAuthButtons";
import { PublicFooter } from "@/components/PublicFooter";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import extensionImage from "@/product-images-01.png";
import styles from "./chrome-extension.module.css";

export const metadata: Metadata = {
	title: "Chrome Extension — Tote",
	description:
		"Install the Tote Chrome extension to save products from any online store into organized collections with one click.",
	alternates: { canonical: "/chrome-extension" },
	openGraph: {
		title: "Tote Chrome Extension",
		description:
			"Save products from any online store into Tote collections without copying links between tabs.",
	},
};

const captureDetails = [
	"Product name, image, price, store, and source URL",
	"Collection and slot selection before saving",
	"Right-click saving for fast repeat captures",
	"Sync with your Tote account across the web app and extension",
];

const workflows = [
	{
		title: "Research without tab pileup",
		description:
			"Save options as you browse, then close the tab knowing the link, image, and price are waiting in Tote.",
	},
	{
		title: "Organize while the context is fresh",
		description:
			"Choose the right collection and slot from the popup so every find lands where the decision is happening.",
	},
	{
		title: "Come back ready to compare",
		description:
			"Use Tote later to refresh prices, shortlist favorites, share a board, and move from maybe to decided.",
	},
];

const browserSupport = ["Chrome", "Edge", "Brave", "Arc"];

export default function ChromeExtensionPage() {
	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<nav className={styles.nav} aria-label="Chrome extension page">
					<Link href="/" className={styles.wordmark}>
						tote
					</Link>
					<div className={styles.navLinks}>
						<Link href="/docs/extension">Docs</Link>
						<a
							href={CHROME_WEB_STORE_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							Chrome Web Store
						</a>
					</div>
				</nav>
			</header>

			<main>
				<section className={styles.hero}>
					<div className={styles.heroCopy}>
						<p className={styles.eyebrow}>Tote for Chrome</p>
						<h1>Save from any store without breaking your flow.</h1>
						<p className={styles.lead}>
							The Tote browser extension captures product details while you
							shop, then sends each find to the collection where you are making
							the decision.
						</p>
						<div className={styles.actions}>
							<a
								href={CHROME_WEB_STORE_URL}
								target="_blank"
								rel="noopener noreferrer"
								className={styles.primaryButton}
							>
								Add to Chrome
							</a>
							<Link href="/docs/extension" className={styles.secondaryButton}>
								Read setup guide
							</Link>
						</div>
						<ul className={styles.browserList} aria-label="Supported browsers">
							{browserSupport.map((browser) => (
								<li key={browser}>{browser}</li>
							))}
						</ul>
					</div>

					<div className={styles.heroVisual}>
						<Image
							src={extensionImage}
							alt="Tote browser extension saving a product from an online store"
							priority
							className={styles.heroImage}
						/>
					</div>
				</section>

				<section className={styles.captureSection}>
					<div>
						<p className={styles.eyebrow}>What it captures</p>
						<h2>Enough detail to compare later.</h2>
						<p>
							Tote reads the product page you are viewing and fills in the
							useful parts automatically. You can still edit the saved product
							in Tote when a store page is unusually sparse.
						</p>
					</div>
					<ul className={styles.captureList}>
						{captureDetails.map((detail) => (
							<li key={detail}>{detail}</li>
						))}
					</ul>
				</section>

				<section className={styles.workflowSection}>
					<div className={styles.sectionHeader}>
						<p className={styles.eyebrow}>How people use it</p>
						<h2>Built for the moment you find something worth saving.</h2>
					</div>
					<div className={styles.workflowGrid}>
						{workflows.map((workflow) => (
							<article key={workflow.title} className={styles.workflowCard}>
								<h3>{workflow.title}</h3>
								<p>{workflow.description}</p>
							</article>
						))}
					</div>
				</section>

				<section className={styles.docsCta}>
					<div>
						<p className={styles.eyebrow}>Need the details?</p>
						<h2>Install, sign in, save, and troubleshoot.</h2>
						<p>
							The extension guide covers permissions, pinning the toolbar icon,
							one-click saves, right-click saves, collection slots, and what to
							do when a store page does not expose complete product data.
						</p>
					</div>
					<Link href="/docs/extension" className={styles.secondaryButton}>
						Open extension docs
					</Link>
				</section>

				<section className={styles.finalCta}>
					<p className={styles.eyebrow}>Start saving</p>
					<h2>Give your next comparison a real home.</h2>
					<div className={styles.actions}>
						<LandingAuthButtons
							showSignIn={false}
							signUpLabel="Create a Tote account"
							signedInLabel="Open Tote"
						/>
						<a
							href={CHROME_WEB_STORE_URL}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.secondaryButton}
						>
							Add to Chrome
						</a>
					</div>
				</section>
			</main>

			<PublicFooter />
		</div>
	);
}
