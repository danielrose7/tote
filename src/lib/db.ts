import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

const databaseUrl = process.env.NEON_DB_POSTGRES_URL;

if (!databaseUrl) {
	throw new Error("NEON_DB_POSTGRES_URL is required");
}

// Single shared SQL client — safe to call at module level in serverless
export const sql = neon(databaseUrl);

// Typed query client for the new collection schema. Existing raw SQL modules can
// migrate incrementally instead of changing as part of the collection refactor.
export const db = drizzle({ client: sql, schema });
