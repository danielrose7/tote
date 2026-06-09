import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../db/schema";

const databaseUrl = process.env.NEON_DB_POSTGRES_URL;

if (!databaseUrl) {
	throw new Error("NEON_DB_POSTGRES_URL is required");
}

neonConfig.webSocketConstructor = ws;

export async function withTransactionalDb<T>(
	callback: (database: NeonDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
	const pool = new Pool({ connectionString: databaseUrl });
	const database = drizzle({ client: pool, schema });

	try {
		return await callback(database);
	} finally {
		await pool.end();
	}
}
