import { APP_URL } from "../config";
import type { ExtractedMetadata } from "./extractors/types";
import { normalizeUrl } from "./normalizeUrl";

export type NeonCaptureCollection = {
	id: string;
	name: string;
	color: string | null;
	role: "owner" | "admin" | "editor";
	sections: Array<{ id: string; name: string }>;
};

// One save attempt's identity. Reusing the same pair on retry lets the
// server replay the original response instead of inserting a duplicate.
export type CaptureIds = {
	nodeId: string;
	mutationId: string;
};

export function createCaptureIds(): CaptureIds {
	return { nodeId: crypto.randomUUID(), mutationId: crypto.randomUUID() };
}

export class NeonCaptureRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "NeonCaptureRequestError";
	}
}

async function request<T>(
	path: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(`${APP_URL}${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			...init?.headers,
		},
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new NeonCaptureRequestError(
			body?.error || `Tote request failed with status ${response.status}`,
			response.status,
		);
	}
	return response.json() as Promise<T>;
}

export async function fetchNeonCaptureCollections(token: string) {
	const response = await request<{ collections: NeonCaptureCollection[] }>(
		"/api/v2/capture",
		token,
	);
	return response.collections;
}

function validUrlOrUndefined(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		new URL(value);
		return value;
	} catch {
		return undefined;
	}
}

export function buildCapturePayload({
	ids,
	collectionId,
	sectionId,
	metadata,
}: {
	ids: CaptureIds;
	collectionId: string;
	sectionId: string | null;
	metadata: ExtractedMetadata;
}) {
	const images = metadata.images
		?.filter((image) => validUrlOrUndefined(image))
		.slice(0, 50);
	return {
		id: ids.nodeId,
		mutationId: ids.mutationId,
		collectionId,
		sectionId,
		title: metadata.title?.trim() || "Untitled",
		url: normalizeUrl(metadata.url),
		imageUrl: validUrlOrUndefined(metadata.imageUrl),
		images: images?.length ? images : undefined,
		price: metadata.price?.trim() || undefined,
		description: metadata.description?.trim() || undefined,
	};
}

export async function saveNeonCapture({
	token,
	ids,
	collectionId,
	sectionId,
	metadata,
}: {
	token: string;
	ids: CaptureIds;
	collectionId: string;
	sectionId: string | null;
	metadata: ExtractedMetadata;
}) {
	return request<{ id: string; replayed: boolean }>("/api/v2/capture", token, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(
			buildCapturePayload({ ids, collectionId, sectionId, metadata }),
		),
	});
}
