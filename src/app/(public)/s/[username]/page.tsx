import type { Metadata } from "next";
import Link from "next/link";
import { PreFooterCta } from "../../../../components/PreFooterCta";
import { PublicFooter } from "../../../../components/PublicFooter";
import { StickyCtaBar } from "../../../../components/StickyCtaBar";
import type { PublishedCollectionSummary } from "../../../../lib/publishedCollectionsDb";
import { getPublishedCollectionsByOwner } from "../../../../lib/publishedCollectionsDb";
import styles from "./page.module.css";

type Params = Promise<{ username: string }>;

async function resolveClerkUserId(username: string): Promise<string | null> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) return null;
	const res = await fetch(
		`https://api.clerk.com/v1/users?username=${encodeURIComponent(username)}&limit=1`,
		{
			headers: { Authorization: `Bearer ${secretKey}` },
			next: { revalidate: 60 },
		},
	);
	if (!res.ok) return null;
	const users = await res.json();
	return users[0]?.id ?? null;
}

export async function generateMetadata(props: {
	params: Params;
}): Promise<Metadata> {
	const { username } = await props.params;
	return {
		title: `${username}'s collections on Tote`,
		description: `Browse public collections curated by ${username}.`,
	};
}

export default async function UserCollectionsPage(props: { params: Params }) {
	const { username } = await props.params;
	const clerkUserId = await resolveClerkUserId(username);

	if (!clerkUserId) {
		return <NotFound username={username} />;
	}

	const collections = await getPublishedCollectionsByOwner(clerkUserId);

	if (collections.length === 0) {
		return <NotFound username={username} />;
	}

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div className={styles.headerInner}>
					<h1 className={styles.heading}>{username}</h1>
					<p className={styles.subheading}>
						{collections.length}{" "}
						{collections.length === 1 ? "collection" : "collections"}
					</p>
				</div>
			</header>
			<main className={styles.grid}>
				{collections.map((c) => (
					<CollectionCard key={c.id} collection={c} username={username} />
				))}
			</main>
			<PreFooterCta />
			<StickyCtaBar />

			<PublicFooter />
		</div>
	);
}

function CollectionCard({
	collection,
	username,
}: {
	collection: PublishedCollectionSummary;
	username: string;
}) {
	const { coverImages, color, name, description, itemCount, slug } = collection;
	const hex = color ?? "#6366f1";

	return (
		<Link href={`/s/${username}/${slug}`} className={styles.card}>
			<CollectionCover images={coverImages} color={hex} />
			<div className={styles.cardBody}>
				<h2 className={styles.cardTitle}>{name}</h2>
				{description && <p className={styles.cardDescription}>{description}</p>}
				<p className={styles.cardMeta}>
					{itemCount} {itemCount === 1 ? "item" : "items"}
				</p>
			</div>
		</Link>
	);
}

function CollectionCover({
	images,
	color,
}: {
	images: string[];
	color: string;
}) {
	if (images.length === 0) {
		return (
			<div
				className={styles.coverFallback}
				style={{
					background: `radial-gradient(circle at 20% 80%, ${color}99 0%, transparent 55%),
                     radial-gradient(circle at 80% 15%, ${color}66 0%, transparent 45%),
                     radial-gradient(circle at 55% 50%, ${color}44 0%, transparent 60%),
                     ${color}22`,
				}}
			/>
		);
	}

	if (images.length === 1) {
		return (
			<div className={styles.coverSingle}>
				<img src={images[0]} alt="" className={styles.coverImg} />
			</div>
		);
	}

	if (images.length === 2) {
		return (
			<div className={styles.coverTwo}>
				<img src={images[0]} alt="" className={styles.coverImg} />
				<img src={images[1]} alt="" className={styles.coverImg} />
			</div>
		);
	}

	return (
		<div className={styles.coverThree}>
			<img
				src={images[0]}
				alt=""
				className={`${styles.coverImg} ${styles.coverImgMain}`}
			/>
			<div className={styles.coverStack}>
				<img src={images[1]} alt="" className={styles.coverImg} />
				<img src={images[2]} alt="" className={styles.coverImg} />
			</div>
		</div>
	);
}

function NotFound({ username }: { username: string }) {
	return (
		<div className={styles.notFound}>
			<h1 className={styles.notFoundTitle}>No collections found</h1>
			<p className={styles.notFoundText}>
				{username} hasn&apos;t published any collections yet.
			</p>
		</div>
	);
}
