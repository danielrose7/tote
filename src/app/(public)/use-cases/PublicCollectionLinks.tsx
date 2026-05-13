import Link from "next/link";
import styles from "../docs/docs.module.css";

type PublicCollectionLink = {
	title: string;
	href: string;
	description: string;
};

interface PublicCollectionLinksProps {
	title?: string;
	intro?: string;
	collections: PublicCollectionLink[];
}

export function PublicCollectionLinks({
	title = "Public collections to browse",
	intro,
	collections,
}: PublicCollectionLinksProps) {
	return (
		<section>
			<h2>{title}</h2>
			{intro && <p>{intro}</p>}
			{collections.map((collection) => (
				<div className={styles.card} key={collection.href}>
					<h3 className={styles.cardTitle}>
						<Link href={collection.href}>{collection.title}</Link>
					</h3>
					<p className={styles.cardDescription}>{collection.description}</p>
				</div>
			))}
		</section>
	);
}
