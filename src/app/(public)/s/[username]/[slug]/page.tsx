import type { Metadata } from "next";
import { PublicCollectionClient } from "./PublicCollectionClient";

type Params = Promise<{ username: string; slug: string }>;

async function resolveCollection(
	username: string,
	slug: string,
): Promise<{
	collectionId: string;
	collectionName?: string;
	collectionDescription?: string;
} | null> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) return null;

	// Look up Clerk user by username
	const usersResponse = await fetch(
		`https://api.clerk.com/v1/users?username=${encodeURIComponent(username)}&limit=1`,
		{
			headers: { Authorization: `Bearer ${secretKey}` },
			next: { revalidate: 60 }, // Cache for 60 seconds
		},
	);

	if (!usersResponse.ok) return null;

	const users = await usersResponse.json();
	if (!users.length) return null;

	const user = users[0];
	const publishedCollections = user.public_metadata?.publishedCollections as
		| Record<
				string,
				string | { id: string; name?: string; description?: string }
		  >
		| undefined;

	const entry = publishedCollections?.[slug];
	if (!entry) return null;

	// Support both legacy string format and new object format
	if (typeof entry === "string") {
		return {
			collectionId: entry,
			collectionName: slug.replace(/-/g, " "),
		};
	}

	return {
		collectionId: entry.id,
		collectionName: entry.name || slug.replace(/-/g, " "),
		collectionDescription: entry.description,
	};
}

export async function generateMetadata(props: {
	params: Params;
}): Promise<Metadata> {
	const { username, slug } = await props.params;
	const result = await resolveCollection(username, slug);

	if (!result) {
		return { title: "Not Found" };
	}

	const displayName = result.collectionName
		? result.collectionName.replace(/\b\w/g, (c) => c.toUpperCase())
		: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

	const description =
		result.collectionDescription ||
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
	const result = await resolveCollection(username, slug);

	if (!result) {
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

	return (
		<PublicCollectionClient
			collectionId={result.collectionId}
			creatorUsername={username}
		/>
	);
}
