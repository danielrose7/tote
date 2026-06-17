import type { Collection } from "./api";

const BASE_URL = "https://tote.tools";

export function parameterize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\-_.~\s]/g, "")
		.replace(/[\s]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Get the public share URL for a published collection.
 * Uses the slug from the publication status.
 */
export function getShareUrl(
	slug: string,
	username: string | null | undefined,
): string {
	if (username && slug) {
		return `${BASE_URL}/s/${username}/${slug}`;
	}
	return `${BASE_URL}/view/${slug}`;
}
