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
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { type Pool, Pool as PostgresPool } from "pg";

// Prefer the unpooled URL for migrations — pooled connections can swallow DDL errors
const url =
	process.env.NEON_DB_POSTGRES_URL_NON_POOLING ??
	process.env.NEON_DB_POSTGRES_URL;
if (!url) {
	throw new Error(
		"NEON_DB_POSTGRES_URL_NON_POOLING or NEON_DB_POSTGRES_URL is required",
	);
}

const firstPostDrizzleLegacyMigration = "014_neon_collection_publications.sql";

async function runLegacyMigrations(
	pool: Pool,
	phase: "before_drizzle" | "after_drizzle",
) {
	const client = await pool.connect();
	try {
		// Ensure the migrations tracking table exists
		await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

		// Find applied migrations
		const applied = await client.query<{ filename: string }>(
			"SELECT filename FROM schema_migrations",
		);
		const appliedSet = new Set(applied.rows.map((row) => row.filename));

		// Read migration files, sorted by name (001_, 002_, …)
		const migrationsDir = join(process.cwd(), "src/db/migrations");
		const files = (await readdir(migrationsDir))
			.filter((file) => file.endsWith(".sql"))
			.filter((file) =>
				phase === "before_drizzle"
					? file < firstPostDrizzleLegacyMigration
					: file >= firstPostDrizzleLegacyMigration,
			)
			.sort();

		let ran = 0;
		for (const file of files) {
			if (appliedSet.has(file)) continue;

			const query = await readFile(join(migrationsDir, file), "utf-8");
			console.log(`[db:migrate] applying ${file}`);
			await client.query("BEGIN");
			try {
				await client.query(query);
				await client.query(
					"INSERT INTO schema_migrations (filename) VALUES ($1)",
					[file],
				);
				await client.query("COMMIT");
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			}
			console.log(`[db:migrate] applied ${file}`);
			ran++;
		}

		if (ran === 0) {
			console.log(`[db:migrate] no ${phase} legacy migrations to apply`);
		} else {
			console.log(`[db:migrate] applied ${ran} ${phase} legacy migration(s)`);
		}
	} finally {
		client.release();
	}
}

async function runDrizzleMigrations(pool: Pool) {
	console.log("[db:migrate] checking Drizzle migrations");
	await migrate(drizzle(pool), {
		migrationsFolder: join(process.cwd(), "src/db/drizzle"),
	});
	console.log("[db:migrate] Drizzle migrations are current");
}

async function run() {
	const pool = new PostgresPool({
		connectionString: url,
		max: 1,
	});

	try {
		await runLegacyMigrations(pool, "before_drizzle");
		await runDrizzleMigrations(pool);
		await runLegacyMigrations(pool, "after_drizzle");
	} finally {
		await pool.end();
	}
}

run().catch((err) => {
	console.error("[db:migrate] failed:", err);
	process.exit(1);
});
