import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema";

export type TestDatabase = NodePgDatabase<typeof schema>;

let activeTestDatabase: TestDatabase | undefined;

export function getTestDatabase(): TestDatabase {
	if (!activeTestDatabase) {
		throw new Error(
			"No test database is active. Use dbTest or pass { transient: { db } } to the factory.",
		);
	}
	return activeTestDatabase;
}

export async function withTestDatabase<T>(
	database: TestDatabase,
	callback: () => Promise<T>,
): Promise<T> {
	const previousDatabase = activeTestDatabase;
	activeTestDatabase = database;

	try {
		return await callback();
	} finally {
		activeTestDatabase = previousDatabase;
	}
}
