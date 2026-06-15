import type { Metadata } from "next";
import { getPublishedCollectionByOwnerAndSlug } from "../../../../../lib/publishedCollectionsDb";
import { PublicCollectionView } from "./PublicCollectionView";

type Params = Promise<{ username: string; slug: string }>;

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
	const { username, slug } = await props.params;
	const clerkUserId = await resolveClerkUserId(username);
	if (!clerkUserId) return { title: "Not Found" };

	const collection = await getPublishedCollectionByOwnerAndSlug(
		clerkUserId,
		slug,
	);
	if (!collection) return { title: "Not Found" };

	const displayName = collection.name.replace(/\b\w/g, (c) => c.toUpperCase());
	const description =
		collection.description ||
		`View ${displayName}, a collection shared by ${username} on Tote.`;

	return {
		title: `${displayName} by ${username}`,
		description,
		openGraph: {
			title: `${displayName} by ${username}`,
			description,
			type: "website",
		},
	};
}

export default async function FriendlyUrlPage(props: { params: Params }) {
	const { username, slug } = await props.params;
	const clerkUserId = await resolveClerkUserId(username);

	if (!clerkUserId) {
		return <NotFound />;
	}

	const collection = await getPublishedCollectionByOwnerAndSlug(
		clerkUserId,
		slug,
	);

	if (!collection) {
		return <NotFound />;
	}

	return (
		<PublicCollectionView collection={collection} creatorUsername={username} />
	);
}

function NotFound() {
	return (
		<div
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				minHeight: "60vh",
				padding: "2rem",
			}}
		>
			<div style={{ textAlign: "center" }}>
				<h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
					Not Found
				</h1>
				<p style={{ color: "#666" }}>
					This collection doesn&apos;t exist or is no longer public.
				</p>
			</div>
		</div>
	);
}
