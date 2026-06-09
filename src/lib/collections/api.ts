import { z } from "zod";

export const collectionIdSchema = z.uuid();
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

export const createCollectionInputSchema = z.object({
	id: collectionIdSchema.optional(),
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2_000).optional(),
	color: z.string().trim().min(1).max(100).optional(),
	positionKey: z.string().trim().min(1).max(200),
});

export type CreateCollectionRequest = z.infer<
	typeof createCollectionInputSchema
>;

export const updateCollectionInputSchema = z
	.object({
		expectedVersion: collectionVersionSchema,
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
		(input) => Object.keys(input).some((key) => key !== "expectedVersion"),
		{ message: "At least one collection field is required" },
	);

export const deleteCollectionInputSchema = z.object({
	expectedVersion: collectionVersionSchema,
});

export const createCollectionNodeInputSchema = z
	.object({
		id: collectionIdSchema.optional(),
		parentId: collectionIdSchema.nullable().optional(),
		type: collectionNodeTypeSchema,
		title: z.string().trim().max(500).nullable().optional(),
		properties: collectionNodePropertiesSchema.optional(),
		positionKey: z.string().trim().min(1).max(200),
	})
	.refine((input) => input.type !== "section" || input.parentId == null, {
		message: "Sections must be top-level",
		path: ["parentId"],
	});

export const updateCollectionNodeInputSchema = z
	.object({
		expectedVersion: collectionVersionSchema,
		parentId: collectionIdSchema.nullable().optional(),
		type: collectionNodeTypeSchema.optional(),
		title: z.string().trim().max(500).nullable().optional(),
		properties: collectionNodePropertiesSchema.optional(),
		positionKey: z.string().trim().min(1).max(200).optional(),
	})
	.refine(
		(input) => Object.keys(input).some((key) => key !== "expectedVersion"),
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
