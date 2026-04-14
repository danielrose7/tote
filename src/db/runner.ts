/**
 * Migration runner.
 *
 * Reads numbered .sql files from src/db/migrations/, runs each one that
 * hasn't been recorded in schema_migrations, then records it.
 * Safe to run multiple times — already-applied migrations are skipped.
 *
 * Run manually:  pnpm db:migrate
 * Runs automatically before every build via the build script.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

// Prefer the unpooled URL for migrations — pooled connections can swallow DDL errors
const url =
	process.env.NEON_DB_POSTGRES_URL_NON_POOLING ??
	process.env.NEON_DB_POSTGRES_URL!;
const sql = neon(url);

async function run() {
	// Ensure the migrations tracking table exists
	await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

	// Find applied migrations
	const applied = await sql`SELECT filename FROM schema_migrations`;
	const appliedSet = new Set(applied.map((r) => r.filename as string));

	// Read migration files, sorted by name (001_, 002_, …)
	const migrationsDir = join(process.cwd(), "src/db/migrations");
	const files = (await readdir(migrationsDir))
		.filter((f) => f.endsWith(".sql"))
		.sort();

	let ran = 0;
	for (const file of files) {
		if (appliedSet.has(file)) continue;

		const query = await readFile(join(migrationsDir, file), "utf-8");
		console.log(`[db:migrate] applying ${file}`);
		await sql.unsafe(query);
		// Only record as applied after the SQL succeeds
		await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
		console.log(`[db:migrate] applied ${file}`);
		ran++;
	}

	if (ran === 0) {
		console.log("[db:migrate] nothing to apply");
	} else {
		console.log(`[db:migrate] applied ${ran} migration(s)`);
	}
}

run().catch((err) => {
	console.error("[db:migrate] failed:", err);
	process.exit(1);
});
