"use client";

import { useParams } from "next/navigation";
import { PublicCollectionClient } from "../../s/[username]/[slug]/PublicCollectionClient";

/**
 * Public view page — renders a published collection by Jazz ID.
 * Delegates to the shared PublicCollectionClient component.
 */
export default function PublicViewPage() {
	const params = useParams();
	const collectionId = params.id as string;

	return <PublicCollectionClient collectionId={collectionId} />;
}
