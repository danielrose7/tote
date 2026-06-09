import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test as baseTest, beforeAll, expect } from "vitest";
import * as schema from "../schema";
import { type TestDatabase, withTestDatabase } from "./context";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"TEST_DATABASE_URL is required for database integration tests",
	);
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname)) {
	throw new Error(
		"Database integration tests only allow local PostgreSQL hosts",
	);
}

const pool = new Pool({
	connectionString: databaseUrl,
	max: 10,
});

beforeAll(async () => {
	await pool.query("SELECT 1");
});

afterAll(async () => {
	await pool.end();
});

export const dbTest = baseTest.extend<{ db: TestDatabase }>({
	db: [
		// biome-ignore lint/correctness/noEmptyPattern: Vitest requires fixture context destructuring.
		async ({}, use) => {
			const client = await pool.connect();
			await client.query("BEGIN");
			const database = drizzle(client, { schema });

			try {
				await withTestDatabase(database, () => use(database));
			} finally {
				await client.query("ROLLBACK");
				client.release();
			}
		},
		{ auto: true },
	],
});

export { expect };
