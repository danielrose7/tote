import { z } from "zod";

export const collectionIdSchema = z.uuid();
export const mutationIdSchema = z.uuid();
export const collectionVersionSchema = z.number().int().positive();
export const collectionNodeTypeSchema = z.enum([
	"section",
	"product",
	"link",
	"photo",
	"note",
	"text",
]);
export const collectionNodePropertiesSchema = z.record(z.string(), z.unknown());

export const createCollectionInputSchema = z
	.object({
		id: collectionIdSchema.optional(),
		mutationId: mutationIdSchema.optional(),
		name: z.string().trim().min(1).max(200),
		description: z.string().trim().max(2_000).optional(),
		color: z.string().trim().min(1).max(100).optional(),
		positionKey: z.string().trim().min(1).max(200),
	})
	.refine((input) => !input.mutationId || Boolean(input.id), {
		message: "Idempotent creates require a client-generated collection id",
		path: ["id"],
	});

export type CreateCollectionRequest = z.infer<
	typeof createCollectionInputSchema
>;

export const updateCollectionInputSchema = z
	.object({
		expectedVersion: collectionVersionSchema,
		mutationId: mutationIdSchema.optional(),
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().trim().max(2_000).nullable().optional(),
		color: z.string().trim().min(1).max(100).nullable().optional(),
		budgetCents: z.number().int().nonnegative().nullable().optional(),
		defaultViewMode: z.enum(["grid", "table"]).nullable().optional(),
		publicLayout: z.enum(["minimal", "feature"]).optional(),
		copyPolicy: z.enum(["disabled", "members", "public"]).optional(),
		positionKey: z.string().trim().min(1).max(200).optional(),
	})
	.refine(
		(input) =>
			Object.keys(input).some(
				(key) => key !== "expectedVersion" && key !== "mutationId",
			),
		{ message: "At least one collection field is required" },
	);

export const deleteCollectionInputSchema = z.object({
	expectedVersion: collectionVersionSchema,
	mutationId: mutationIdSchema.optional(),
});

export const copyCollectionInputSchema = z.object({
	mutationId: mutationIdSchema,
	name: z.string().trim().min(1).max(200).optional(),
});

export const createCollectionNodeInputSchema = z
	.object({
		id: collectionIdSchema.optional(),
		mutationId: mutationIdSchema.optional(),
		parentId: collectionIdSchema.nullable().optional(),
		type: collectionNodeTypeSchema,
		title: z.string().trim().max(500).nullable().optional(),
		properties: collectionNodePropertiesSchema.optional(),
		positionKey: z.string().trim().min(1).max(200),
	})
	.refine((input) => input.type !== "section" || input.parentId == null, {
		message: "Sections must be top-level",
		path: ["parentId"],
	})
	.refine((input) => !input.mutationId || Boolean(input.id), {
		message: "Idempotent creates require a client-generated node id",
		path: ["id"],
	});

export const updateCollectionNodeInputSchema = z
	.object({
		expectedVersion: collectionVersionSchema,
		mutationId: mutationIdSchema.optional(),
		parentId: collectionIdSchema.nullable().optional(),
		type: collectionNodeTypeSchema.optional(),
		title: z.string().trim().max(500).nullable().optional(),
		properties: collectionNodePropertiesSchema.optional(),
		positionKey: z.string().trim().min(1).max(200).optional(),
	})
	.refine(
		(input) =>
			Object.keys(input).some(
				(key) => key !== "expectedVersion" && key !== "mutationId",
			),
		{
			message: "At least one node field is required",
		},
	)
	.refine(
		(input) =>
			input.type !== "section" ||
			input.parentId === undefined ||
			input.parentId === null,
		{
			message: "Sections must be top-level",
			path: ["parentId"],
		},
	);

export async function parseJsonRequest(
	request: Request,
): Promise<{ success: true; data: unknown } | { success: false }> {
	try {
		return { success: true, data: await request.json() };
	} catch {
		return { success: false };
	}
}

export const deleteCollectionNodeInputSchema = z.object({
	expectedVersion: collectionVersionSchema,
	mutationId: mutationIdSchema.optional(),
});

export const reorderCollectionNodesInputSchema = z
	.object({
		mutationId: mutationIdSchema,
		nodes: z
			.array(
				z.object({
					id: collectionIdSchema,
					expectedVersion: collectionVersionSchema,
					positionKey: z.string().trim().min(1).max(200),
				}),
			)
			.min(2)
			.max(500),
	})
	.refine(
		(input) =>
			new Set(input.nodes.map((node) => node.id)).size === input.nodes.length,
		{
			message: "Reorder node ids must be unique",
			path: ["nodes"],
		},
	);

export const createCollectionInviteInputSchema = z.object({
	role: z.enum(["editor", "viewer"]),
	recipientHint: z.string().trim().min(1).max(320).optional(),
	expiresAt: z
		.string()
		.datetime({ offset: true })
		.transform((value) => new Date(value))
		.optional(),
	maxUses: z.number().int().positive().optional(),
});

export const updateCollectionMemberInputSchema = z.object({
	role: z.enum(["admin", "editor", "viewer"]),
});

export const collectionMemberUserIdSchema = z.string().trim().min(1).max(200);

export const acceptCollectionInviteInputSchema = z.object({
	token: z.string().trim().min(20).max(500),
});

export const transferCollectionOwnershipInputSchema = z.object({
	targetUserId: collectionMemberUserIdSchema,
});

export const publishCollectionInputSchema = z.object({
	slug: z
		.string()
		.trim()
		.min(1)
		.max(120)
		.regex(/^[a-z0-9](?:[a-z0-9._~-]{0,118}[a-z0-9])?$/),
	layout: z.enum(["minimal", "feature"]).default("minimal"),
	allowCloning: z.boolean().default(true),
});

const migrationNodeSchema = z.object({
	legacyJazzId: z.string().trim().min(1).max(500),
	parentLegacyJazzId: z.string().trim().min(1).max(500).nullable(),
	type: collectionNodeTypeSchema,
	title: z.string().max(500).nullable(),
	properties: collectionNodePropertiesSchema,
	positionKey: z.string().trim().min(1).max(200),
});

const migrationMemberSchema = z.object({
	userId: collectionMemberUserIdSchema,
	role: z.enum(["admin", "editor", "viewer"]),
});

export const classicMigrationCollectionSchema = z.object({
	legacyJazzId: z.string().trim().min(1).max(500),
	name: z.string().trim().min(1).max(200),
	description: z.string().max(2_000).nullable(),
	color: z.string().trim().min(1).max(100).nullable(),
	budgetCents: z.number().int().nonnegative().nullable(),
	defaultViewMode: z.enum(["grid", "table"]).nullable(),
	publicLayout: z.enum(["minimal", "feature"]),
	copyPolicy: z.enum(["disabled", "members", "public"]),
	positionKey: z.string().trim().min(1).max(200),
	members: z.array(migrationMemberSchema).max(1_000).optional(),
	nodes: z.array(migrationNodeSchema).max(10_000),
});

export const importClassicCollectionsInputSchema = z.object({
	migrationVersion: z.literal(1),
	sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	collections: z.array(classicMigrationCollectionSchema).max(1_000),
});

export const copyClassicSharedCollectionInputSchema = z.object({
	mutationId: mutationIdSchema,
	sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	collection: classicMigrationCollectionSchema,
});

export const saveCaptureInputSchema = z.object({
	id: collectionIdSchema,
	mutationId: mutationIdSchema,
	collectionId: collectionIdSchema,
	sectionId: collectionIdSchema.nullable().optional(),
	title: z.string().trim().min(1).max(500),
	url: z.url().max(4_000),
	imageUrl: z.url().max(4_000).optional(),
	images: z.array(z.url().max(4_000)).max(50).optional(),
	price: z.string().trim().max(200).optional(),
	description: z.string().trim().max(10_000).optional(),
});

export function neonCollectionsApiEnabled(): boolean {
	return process.env.NEON_COLLECTIONS_API_ENABLED === "true";
}

export function canUseNeonCollections(
	dataSource:
		| "classic_jazz"
		| "migrating"
		| "neon_verifying"
		| "neon"
		| "migration_failed",
): boolean {
	return dataSource === "neon_verifying" || dataSource === "neon";
}

export function canStartCollectionMigration(
	dataSource:
		| "classic_jazz"
		| "migrating"
		| "neon_verifying"
		| "neon"
		| "migration_failed",
	accountEnabled: boolean,
) {
	return dataSource !== "classic_jazz" || accountEnabled;
}
