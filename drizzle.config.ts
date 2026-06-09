import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const databaseUrl =
	process.env.NEON_DB_POSTGRES_URL_NON_POOLING ??
	process.env.NEON_DB_POSTGRES_URL;

if (!databaseUrl) {
	throw new Error(
		"NEON_DB_POSTGRES_URL_NON_POOLING or NEON_DB_POSTGRES_URL is required",
	);
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema/index.ts",
	out: "./src/db/drizzle",
	dbCredentials: {
		url: databaseUrl,
	},
	strict: true,
	verbose: true,
});
