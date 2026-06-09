import { z } from "zod";

export const collectionIdSchema = z.uuid();

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
