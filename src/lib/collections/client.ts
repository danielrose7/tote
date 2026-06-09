import type { CollectionPublicationStatus } from "./publicationRepository";
import type {
	CollectionDetail,
	CollectionSummary,
	CreateCollectionInput,
	CreateCollectionNodeInput,
	DeleteCollectionInput,
	DeleteCollectionNodeInput,
	ReorderCollectionNodesInput,
	UpdateCollectionInput,
	UpdateCollectionNodeInput,
} from "./repository";
import type {
	CollectionTeam,
	CreateCollectionInviteInput,
} from "./teamRepository";

export class CollectionRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "CollectionRequestError";
	}
}

async function fetchJson<T>(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(input, {
		credentials: "same-origin",
		...init,
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new CollectionRequestError(
			body?.error || `Collection request failed with status ${response.status}`,
			response.status,
		);
	}
	return response.json() as Promise<T>;
}

function hydrateCollectionSummary(
	collection: CollectionSummary,
): CollectionSummary {
	return {
		...collection,
		updatedAt: new Date(collection.updatedAt),
	};
}

export async function fetchCollectionSummaries(): Promise<CollectionSummary[]> {
	const response = await fetchJson<{ collections: CollectionSummary[] }>(
		"/api/v2/collections",
	);
	return response.collections.map(hydrateCollectionSummary);
}

export async function fetchCollectionDetail(
	collectionId: string,
): Promise<CollectionDetail> {
	const detail = await fetchJson<CollectionDetail>(
		`/api/v2/collections/${collectionId}`,
	);
	return {
		...detail,
		collection: {
			...detail.collection,
			createdAt: new Date(detail.collection.createdAt),
			updatedAt: new Date(detail.collection.updatedAt),
			deletedAt: detail.collection.deletedAt
				? new Date(detail.collection.deletedAt)
				: null,
		},
		nodes: detail.nodes.map((node) => ({
			...node,
			createdAt: new Date(node.createdAt),
			updatedAt: new Date(node.updatedAt),
			deletedAt: node.deletedAt ? new Date(node.deletedAt) : null,
		})),
	};
}

export type CreateCollectionMutation = Required<
	Pick<CreateCollectionInput, "id" | "mutationId">
> &
	Pick<CreateCollectionInput, "name" | "description" | "color" | "positionKey">;

export async function createCollectionMutation(
	input: CreateCollectionMutation,
): Promise<{ id: string; replayed: boolean }> {
	return fetchJson("/api/v2/collections", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(input),
	});
}

export type UpdateCollectionMutation = {
	collectionId: string;
	input: UpdateCollectionInput & { mutationId: string };
};

export async function updateCollectionMutation({
	collectionId,
	input,
}: UpdateCollectionMutation): Promise<{ version: number; replayed: boolean }> {
	return fetchJson(`/api/v2/collections/${collectionId}`, {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type DeleteCollectionMutation = {
	collectionId: string;
	input: DeleteCollectionInput & { mutationId: string };
};

export async function deleteCollectionMutation({
	collectionId,
	input,
}: DeleteCollectionMutation): Promise<{ version: number; replayed: boolean }> {
	return fetchJson(`/api/v2/collections/${collectionId}`, {
		method: "DELETE",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type CreateCollectionNodeMutation = {
	collectionId: string;
	input: CreateCollectionNodeInput & {
		id: string;
		mutationId: string;
	};
};

export async function createCollectionNodeMutation({
	collectionId,
	input,
}: CreateCollectionNodeMutation): Promise<{
	id: string;
	version: number;
	collectionVersion: number;
	itemCount: number;
	replayed: boolean;
}> {
	return fetchJson(`/api/v2/collections/${collectionId}/nodes`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type UpdateCollectionNodeMutation = {
	collectionId: string;
	nodeId: string;
	input: UpdateCollectionNodeInput & { mutationId: string };
};

export async function updateCollectionNodeMutation({
	collectionId,
	nodeId,
	input,
}: UpdateCollectionNodeMutation): Promise<{
	version: number;
	collectionVersion: number;
	itemCount: number;
	replayed: boolean;
}> {
	return fetchJson(`/api/v2/collections/${collectionId}/nodes/${nodeId}`, {
		method: "PATCH",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type DeleteCollectionNodeMutation = {
	collectionId: string;
	nodeId: string;
	input: DeleteCollectionNodeInput & { mutationId: string };
};

export async function deleteCollectionNodeMutation({
	collectionId,
	nodeId,
	input,
}: DeleteCollectionNodeMutation): Promise<{
	deletedNodeCount: number;
	collectionVersion: number;
	itemCount: number;
	replayed: boolean;
}> {
	return fetchJson(`/api/v2/collections/${collectionId}/nodes/${nodeId}`, {
		method: "DELETE",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type ReorderCollectionNodesMutation = {
	collectionId: string;
	input: ReorderCollectionNodesInput;
};

export async function reorderCollectionNodesMutation({
	collectionId,
	input,
}: ReorderCollectionNodesMutation): Promise<{
	nodeCount: number;
	collectionVersion: number;
	itemCount: number;
	replayed: boolean;
}> {
	return fetchJson(`/api/v2/collections/${collectionId}/nodes/reorder`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

function hydrateCollectionTeam(team: CollectionTeam): CollectionTeam {
	return {
		members: team.members.map((member) => ({
			...member,
			joinedAt: new Date(member.joinedAt),
		})),
		invites: team.invites.map((invite) => ({
			...invite,
			expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : null,
			revokedAt: invite.revokedAt ? new Date(invite.revokedAt) : null,
			createdAt: new Date(invite.createdAt),
		})),
		events: team.events.map((event) => ({
			...event,
			createdAt: new Date(event.createdAt),
		})),
	};
}

export async function fetchCollectionTeam(
	collectionId: string,
): Promise<CollectionTeam> {
	const team = await fetchJson<CollectionTeam>(
		`/api/v2/collections/${collectionId}/team`,
	);
	return hydrateCollectionTeam(team);
}

export type CreateCollectionInviteMutation = {
	collectionId: string;
	input: Omit<CreateCollectionInviteInput, "expiresAt"> & {
		expiresAt?: string;
	};
};

export async function createCollectionInviteMutation({
	collectionId,
	input,
}: CreateCollectionInviteMutation): Promise<{
	id: string;
	token: string;
	role: "editor" | "viewer";
	expiresAt: string | null;
	maxUses: number | null;
}> {
	return fetchJson(`/api/v2/collections/${collectionId}/team`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
}

export type RevokeCollectionInviteMutation = {
	collectionId: string;
	inviteId: string;
};

export async function revokeCollectionInviteMutation({
	collectionId,
	inviteId,
}: RevokeCollectionInviteMutation): Promise<{ revokedAt: string }> {
	return fetchJson(
		`/api/v2/collections/${collectionId}/team/invites/${inviteId}`,
		{ method: "DELETE" },
	);
}

export type UpdateCollectionMemberMutation = {
	collectionId: string;
	userId: string;
	role: "admin" | "editor" | "viewer";
};

export async function updateCollectionMemberMutation({
	collectionId,
	userId,
	role,
}: UpdateCollectionMemberMutation): Promise<{ role: string }> {
	return fetchJson(
		`/api/v2/collections/${collectionId}/team/members/${encodeURIComponent(userId)}`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ role }),
		},
	);
}

export type RemoveCollectionMemberMutation = {
	collectionId: string;
	userId: string;
};

export async function removeCollectionMemberMutation({
	collectionId,
	userId,
}: RemoveCollectionMemberMutation): Promise<{ revokedAt: string }> {
	return fetchJson(
		`/api/v2/collections/${collectionId}/team/members/${encodeURIComponent(userId)}`,
		{ method: "DELETE" },
	);
}

export type TransferCollectionOwnershipMutation = {
	collectionId: string;
	targetUserId: string;
};

export async function transferCollectionOwnershipMutation({
	collectionId,
	targetUserId,
}: TransferCollectionOwnershipMutation): Promise<{ version: number }> {
	return fetchJson(
		`/api/v2/collections/${collectionId}/team/transfer-ownership`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ targetUserId }),
		},
	);
}

function hydratePublicationStatus(
	status: CollectionPublicationStatus | null,
): CollectionPublicationStatus | null {
	return status
		? {
				...status,
				publishedAt: new Date(status.publishedAt),
				updatedAt: new Date(status.updatedAt),
			}
		: null;
}

export async function fetchCollectionPublication(
	collectionId: string,
): Promise<CollectionPublicationStatus | null> {
	const status = await fetchJson<CollectionPublicationStatus | null>(
		`/api/v2/collections/${collectionId}/publication`,
	);
	return hydratePublicationStatus(status);
}

export type PublishCollectionMutation = {
	collectionId: string;
	input: {
		slug: string;
		layout: "minimal" | "feature";
		allowCloning: boolean;
	};
};

export async function publishCollectionMutation({
	collectionId,
	input,
}: PublishCollectionMutation): Promise<CollectionPublicationStatus> {
	const status = await fetchJson<CollectionPublicationStatus>(
		`/api/v2/collections/${collectionId}/publication`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	return hydratePublicationStatus(status) as CollectionPublicationStatus;
}

export type UnpublishCollectionMutation = {
	collectionId: string;
};

export async function unpublishCollectionMutation({
	collectionId,
}: UnpublishCollectionMutation): Promise<{ unpublished: true }> {
	return fetchJson(`/api/v2/collections/${collectionId}/publication`, {
		method: "DELETE",
	});
}
