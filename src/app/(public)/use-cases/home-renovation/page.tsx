import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../docs/docs.module.css";
import { AnswerBlock } from "../AnswerBlock";

export const metadata: Metadata = {
	title: "Home Renovation Organizer for Furniture, Materials, and Budgets",
	description:
		"Organize a home renovation room by room. Track furniture, fixtures, and material prices across stores, set budgets, and share plans with your partner or contractor.",
	alternates: { canonical: "/use-cases/home-renovation" },
	openGraph: {
		title:
			"Home Renovation Organizer for Furniture, Materials, and Budgets — Tote",
		description:
			"Plan a renovation room by room, track prices across stores, and share boards with your partner or contractor.",
	},
};

export default function HomeRenovationPage() {
	return (
		<article className={styles.article}>
			<h1>Every room. Every store. One board.</h1>
			<p className={styles.lead}>
				Renovating means IKEA, Wayfair, a local shop, and forty browser tabs —
				with no clear picture of what goes where. Tote organizes everything room
				by room, with prices and budgets in one place.
			</p>

			<div className={styles.heroIllustration} aria-hidden="true">
				<svg viewBox="0 0 160 160">
					<path
						d="M80 20 L140 60 L140 140 L20 140 L20 60 Z"
						fill="var(--color-powder-blue)"
						opacity="0.5"
					/>
					<rect
						x="40"
						y="65"
						width="25"
						height="25"
						rx="2"
						fill="var(--color-powder-blue)"
						opacity="0.35"
					/>
					<rect
						x="95"
						y="65"
						width="25"
						height="25"
						rx="2"
						fill="var(--color-powder-blue)"
						opacity="0.35"
					/>
					<rect
						x="40"
						y="100"
						width="25"
						height="25"
						rx="2"
						fill="var(--color-powder-blue)"
						opacity="0.35"
					/>
					<rect
						x="60"
						y="100"
						width="40"
						height="40"
						rx="3"
						fill="var(--color-powder-blue)"
						opacity="0.6"
					/>
				</svg>
			</div>

			<p>
				<a href="https://tote.tools/collections">
					Get started — it&apos;s free &rarr;
				</a>
			</p>

			<AnswerBlock
				question="How do you keep renovation decisions usable across different stores?"
				answer="Save furniture, fixtures, and materials from different stores, come back later to compare them room by room, keep the budget visible, and share the shortlist with the people involved. Tote keeps the project usable after the moment you save it."
				accent="var(--color-powder-blue)"
				steps={[
					"Save furniture, fixtures, and materials from any store",
					"Compare options and keep the project moving room by room",
					"Share the board with your partner or contractor",
				]}
			/>

			<p>
				You&apos;re browsing IKEA for a sofa, Wayfair for a rug, a local shop
				for lighting, and Amazon for hardware. Each store has its own wishlist
				(or none at all). You&apos;re juggling browser tabs, screenshots, and a
				spreadsheet that&apos;s already out of date. Meanwhile, your budget is a
				moving target and your partner hasn&apos;t seen half the options.
			</p>

			<h2>From scattered tabs to room-by-room decisions</h2>

			<div className={styles.card}>
				<h3 className={styles.cardTitle}>Save from every store</h3>
				<p className={styles.cardDescription}>
					IKEA, Wayfair, Etsy, brand sites, local shops. Everything lands in one
					place instead of getting split across tabs, screenshots, and a
					spreadsheet.
				</p>
			</div>

			<div className={styles.card}>
				<h3 className={styles.cardTitle}>
					Keep the project moving room by room
				</h3>
				<p className={styles.cardDescription}>
					Group options by room, compare categories side by side, refresh prices
					when it matters, and keep the current shortlist visible without
					rebuilding it every time.
				</p>
			</div>

			<div className={styles.card}>
				<h3 className={styles.cardTitle}>Share the same plan</h3>
				<p className={styles.cardDescription}>
					Invite your partner to collaborate or send a link to your contractor
					or designer. Everyone sees the same options, prices, and priorities.
				</p>
			</div>

			<h2>Try this setup</h2>
			<p>A simple renovation board usually works best:</p>
			<ul>
				<li>
					Create one collection per room: &ldquo;Living Room&rdquo;,
					&ldquo;Kitchen&rdquo;, &ldquo;Primary Bedroom&rdquo;
				</li>
				<li>
					Add slots only where they help the decision: &ldquo;Seating&rdquo;,
					&ldquo;Lighting&rdquo;, &ldquo;Rugs&rdquo;, or &ldquo;Hardware&rdquo;
				</li>
				<li>
					Set a budget before you start comparing products, then use selections
					to mark the current front-runner
				</li>
			</ul>

			<h2>How it works</h2>
			<ol className={styles.stepList}>
				<li>
					<span>
						<strong>Save as you browse.</strong> Install the Chrome extension.
						When you find a piece of furniture or material you like, click to
						save it to the right room&apos;s collection. Tote captures the
						image, price, and link.
					</span>
				</li>
				<li>
					<span>
						<strong>Organize with slots and selections.</strong> Group items by
						category (seating, lighting, rugs). Use selections to mark your top
						picks and compare options side by side.
					</span>
				</li>
				<li>
					<span>
						<strong>Set budgets and share.</strong> Add a budget to each
						collection or slot. Invite your partner to collaborate or share a
						link with your contractor for review.
					</span>
				</li>
			</ol>

			<div className={styles.tip}>
				<p>
					<span className={styles.tipLabel}>Tip:</span>
					When a room gets crowded, trim the list back to a real shortlist. The
					goal is not to save everything. It is to keep the decision moving.
				</p>
			</div>

			<h2>Frequently Asked Questions</h2>

			<h3>Can I set a budget per room?</h3>
			<p>
				Each collection (room) can have its own budget. You can also set budgets
				on individual slots (categories) within a room for even more detail.
			</p>

			<h3>How do I share with my contractor?</h3>
			<p>
				Make the collection public and send them the link — they can view
				everything without creating an account. If you want them to add items
				too, send an invite link instead.
			</p>

			<h3>Does it work with IKEA and Wayfair?</h3>
			<p>
				Tote works with just about any online store — IKEA, Wayfair, Amazon,
				Etsy, CB2, West Elm, local shops, and more. If you can see a product
				page, Tote can save it.
			</p>

			<h3>Can my partner and I both add items?</h3>
			<p>
				Share the collection via invite link and you can both save products,
				organize them, and mark selections. Changes show up instantly for both
				of you.
			</p>

			<h2>Related use cases</h2>
			<ul>
				<li>
					<Link href="/use-cases/family-shopping">Shared Family Shopping</Link>{" "}
					— collaborate on any shopping project with your partner
				</li>
				<li>
					<Link href="/use-cases/professional-projects">
						Professional Projects
					</Link>{" "}
					— manage sourcing across multiple client projects
				</li>
				<li>
					<Link href="/use-cases/gift-shopping">
						Gift Lists &amp; Wishlists
					</Link>{" "}
					— organize and share gift ideas for any occasion
				</li>
			</ul>

			<p>
				<a href="https://tote.tools/collections">
					Try Tote — it&apos;s free &rarr;
				</a>
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
								name: "Can I set a budget per room?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Each collection (room) can have its own budget. You can also set budgets on individual slots (categories) within a room for even more detail.",
								},
							},
							{
								"@type": "Question",
								name: "How do I share with my contractor?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Make the collection public and send them the link — they can view everything without creating an account. If you want them to add items too, send an invite link instead.",
								},
							},
							{
								"@type": "Question",
								name: "Does it work with IKEA and Wayfair?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Tote works with just about any online store — IKEA, Wayfair, Amazon, Etsy, CB2, West Elm, local shops, and more. If you can see a product page, Tote can save it.",
								},
							},
							{
								"@type": "Question",
								name: "Can my partner and I both add items?",
								acceptedAnswer: {
									"@type": "Answer",
									text: "Share the collection via invite link and you can both save products, organize them, and mark selections. Changes show up instantly for both of you.",
								},
							},
						],
					}),
				}}
			/>
		</article>
	);
}
