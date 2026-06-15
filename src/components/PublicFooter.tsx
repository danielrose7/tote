import Link from "next/link";
import { CHROME_WEB_STORE_URL } from "../lib/constants";
import styles from "./PublicFooter.module.css";

const footerGroups = [
	{
		title: "Use cases",
		links: [
			{ href: "/use-cases/gift-shopping", label: "Gift lists & wishlists" },
			{ href: "/use-cases/home-renovation", label: "Home renovation" },
			{ href: "/use-cases/personal-style", label: "Wardrobe & style" },
			{ href: "/use-cases/family-shopping", label: "Family shopping" },
			{ href: "/use-cases/professional-projects", label: "Client sourcing" },
		],
	},
	{
		title: "Why Tote",
		links: [
			{ href: "/#comparison", label: "Tote vs bookmarks" },
			{ href: "/#comparison", label: "Tote vs store wishlists" },
			{ href: "/#comparison", label: "Tote vs spreadsheets" },
			{ href: "/#privacy", label: "Private by design" },
		],
	},
	{
		title: "Product",
		links: [
			{ href: "/templates", label: "Templates" },
			{ href: "/chrome-extension", label: "Chrome extension" },
			{ href: "/docs", label: "Help docs" },
			{ href: "/docs/getting-started", label: "Getting started" },
			{ href: "/privacy", label: "Privacy" },
			{ href: CHROME_WEB_STORE_URL, label: "Chrome Web Store", external: true },
		],
	},
];

export function PublicFooter() {
	return (
		<footer className={styles.footer}>
			<div className={styles.inner}>
				<div className={styles.footerTop}>
					<div className={styles.footerBrand}>
						<Link href="/" className={styles.wordmark}>
							tote
						</Link>
						<p>
							Save from any store. Organize in one place. Built for people who
							save now and decide later.
						</p>
					</div>

					<div className={styles.footerGroups}>
						{footerGroups.map((group) => (
							<div key={group.title} className={styles.footerGroup}>
								<h3>{group.title}</h3>
								<ul>
									{group.links.map((link) => (
										<li key={link.label}>
											{"external" in link && link.external ? (
												<a
													href={link.href}
													target="_blank"
													rel="noopener noreferrer"
												>
													{link.label}
												</a>
											) : (
												<Link href={link.href}>{link.label}</Link>
											)}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				<div className={styles.footerBottom}>
					<span>&copy; {new Date().getFullYear()} Tote</span>
					<a
						href="https://gobloom.io"
						target="_blank"
						rel="noopener noreferrer"
						className={styles.mountainLink}
					>
						Made in Silverton, CO
					</a>
				</div>
			</div>
		</footer>
	);
}
