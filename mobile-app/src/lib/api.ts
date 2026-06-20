import * as Crypto from "expo-crypto";

const API_BASE = process.env.EXPO_PUBLIC_APP_URL ?? "https://tote.tools";

export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

export type Collection = {
	id: string;
	ownerUserId: string;
	name: string;
	description: string | null;
	color: string | null;
	itemCount: number;
	positionKey: string;
	role: "owner" | "admin" | "editor" | "viewer";
	updatedAt: string;
	previewImages: { url: string; title: string | null; nodeId: string }[];
};

export type NodeProperties = {
	url?: string;
	imageUrl?: string;
	price?: string;
	description?: string;
	notes?: string;
	body?: string;
	maxSelections?: number;
	budget?: number;
	selectedProductIds?: string[];
};

export type CollectionNode = {
	id: string;
	collectionId: string;
	parentId: string | null;
	type: "section" | "product" | "link" | "photo" | "note" | "text";
	title: string | null;
	properties: NodeProperties;
	positionKey: string;
	version: number;
	createdAt: string;
	updatedAt: string;
};

export type CollectionDetail = {
	collection: Collection & { version: number };
	role: string;
	nodes: CollectionNode[];
};

export type PublicationStatus = {
	publicationId: string;
	slug: string;
	shareUrl: string;
	allowCloning: boolean;
	layout: string;
} | null;

async function request<T>(
	path: string,
	token: string,
	options?: RequestInit,
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			...(options?.headers ?? {}),
		},
	});
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try {
			const body = await res.json();
			if (body?.error) msg = body.error;
			else if (body?.message) msg = body.message;
		} catch {}
		throw new ApiError(msg, res.status);
	}
	return res.json() as Promise<T>;
}

export type CaptureCollection = {
	id: string;
	name: string;
	color: string | null;
	role: "owner" | "admin" | "editor";
	sections: Array<{ id: string; name: string }>;
};

export async function fetchCaptureCollections(token: string): Promise<CaptureCollection[]> {
	const data = await request<{ collections: CaptureCollection[] }>("/api/v2/capture", token);
	return data.collections;
}

export async function fetchCollections(token: string): Promise<Collection[]> {
	const data = await request<{ collections: Collection[] }>(
		"/api/v2/collections",
		token,
	);
	return data.collections;
}

export async function createCollection(
	token: string,
	input: { name: string; color?: string; description?: string; positionKey?: string },
): Promise<{ id: string; replayed: boolean }> {
	return request("/api/v2/collections", token, {
		method: "POST",
		body: JSON.stringify({ id: Crypto.randomUUID(), ...input }),
	});
}

export async function fetchCollectionDetail(
	token: string,
	id: string,
): Promise<CollectionDetail> {
	return request<CollectionDetail>(`/api/v2/collections/${id}`, token);
}

export async function updateCollection(
	token: string,
	id: string,
	input: { expectedVersion: number; name?: string; color?: string; description?: string },
): Promise<Collection> {
	return request(`/api/v2/collections/${id}`, token, {
		method: "PATCH",
		body: JSON.stringify({ mutationId: Crypto.randomUUID(), ...input }),
	});
}

export async function deleteCollection(
	token: string,
	id: string,
	expectedVersion: number,
): Promise<void> {
	await request(`/api/v2/collections/${id}`, token, {
		method: "DELETE",
		body: JSON.stringify({ mutationId: Crypto.randomUUID(), expectedVersion }),
	});
}

export async function createNode(
	token: string,
	collectionId: string,
	input: {
		type: CollectionNode["type"];
		title?: string;
		properties?: NodeProperties;
		positionKey: string;
		parentId?: string | null;
	},
): Promise<{ id: string; replayed: boolean }> {
	return request(`/api/v2/collections/${collectionId}/nodes`, token, {
		method: "POST",
		body: JSON.stringify({ id: Crypto.randomUUID(), ...input }),
	});
}

export async function updateNode(
	token: string,
	collectionId: string,
	nodeId: string,
	input: { expectedVersion: number; title?: string | null; properties?: NodeProperties },
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/nodes/${nodeId}`,
		token,
		{
			method: "PATCH",
			body: JSON.stringify({ mutationId: Crypto.randomUUID(), ...input }),
		},
	);
}

export async function deleteNode(
	token: string,
	collectionId: string,
	nodeId: string,
	expectedVersion: number,
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/nodes/${nodeId}`,
		token,
		{
			method: "DELETE",
			body: JSON.stringify({ mutationId: Crypto.randomUUID(), expectedVersion }),
		},
	);
}

export async function reorderNodes(
	token: string,
	collectionId: string,
	nodes: Array<{ id: string; positionKey: string; expectedVersion: number }>,
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/nodes/reorder`,
		token,
		{
			method: "POST",
			body: JSON.stringify({ mutationId: Crypto.randomUUID(), nodes }),
		},
	);
}

export async function captureUrl(
	token: string,
	input: {
		collectionId: string;
		sectionId?: string;
		url: string;
		title?: string;
		imageUrl?: string;
		price?: string;
		description?: string;
	},
): Promise<{ nodeId: string }> {
	return request("/api/v2/capture", token, {
		method: "POST",
		body: JSON.stringify({ id: Crypto.randomUUID(), mutationId: Crypto.randomUUID(), ...input }),
	});
}

export async function getPublicationStatus(
	token: string,
	collectionId: string,
): Promise<PublicationStatus> {
	try {
		return await request<PublicationStatus>(
			`/api/v2/collections/${collectionId}/publication`,
			token,
		);
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return null;
		throw e;
	}
}

export async function publishCollection(
	token: string,
	collectionId: string,
	input: { slug: string; layout: string; allowCloning: boolean },
): Promise<PublicationStatus> {
	return request(`/api/v2/collections/${collectionId}/publication`, token, {
		method: "POST",
		body: JSON.stringify({ mutationId: Crypto.randomUUID(), ...input }),
	});
}

export async function unpublishCollection(
	token: string,
	collectionId: string,
): Promise<void> {
	await request(`/api/v2/collections/${collectionId}/publication`, token, {
		method: "DELETE",
		body: JSON.stringify({ mutationId: Crypto.randomUUID() }),
	});
}

export async function createInvite(
	token: string,
	collectionId: string,
	role: "editor" | "viewer",
): Promise<{ id: string; token: string; role: string }> {
	return request(`/api/v2/collections/${collectionId}/team`, token, {
		method: "POST",
		body: JSON.stringify({ mutationId: Crypto.randomUUID(), role }),
	});
}

export async function acceptInvite(
	token: string,
	inviteToken: string,
): Promise<{ collectionId: string }> {
	return request("/api/v2/collection-invites/accept", token, {
		method: "POST",
		body: JSON.stringify({ mutationId: Crypto.randomUUID(), token: inviteToken }),
	});
}

export type CollectionMember = {
	userId: string;
	role: "owner" | "admin" | "editor" | "viewer";
	joinedAt: string;
};

export type CollectionInviteRecord = {
	id: string;
	role: "editor" | "viewer";
	recipientHint: string | null;
	useCount: number;
	expiresAt: string | null;
	revokedAt: string | null;
	createdAt: string;
};

export type CollectionTeamData = {
	members: CollectionMember[];
	invites: CollectionInviteRecord[];
};

export async function fetchCollectionTeam(
	token: string,
	collectionId: string,
): Promise<CollectionTeamData> {
	return request(`/api/v2/collections/${collectionId}/team`, token);
}

export async function revokeCollectionInvite(
	token: string,
	collectionId: string,
	inviteId: string,
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/team/invites/${inviteId}`,
		token,
		{ method: "DELETE" },
	);
}

export async function updateCollectionMember(
	token: string,
	collectionId: string,
	userId: string,
	role: "admin" | "editor" | "viewer",
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/team/members/${encodeURIComponent(userId)}`,
		token,
		{
			method: "PATCH",
			body: JSON.stringify({ role }),
		},
	);
}

export async function removeCollectionMember(
	token: string,
	collectionId: string,
	userId: string,
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/team/members/${encodeURIComponent(userId)}`,
		token,
		{ method: "DELETE" },
	);
}

export async function transferCollectionOwnership(
	token: string,
	collectionId: string,
	targetUserId: string,
): Promise<void> {
	await request(
		`/api/v2/collections/${collectionId}/team/transfer-ownership`,
		token,
		{
			method: "POST",
			body: JSON.stringify({ targetUserId }),
		},
	);
}
