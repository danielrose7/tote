import { neon } from "@neondatabase/serverless";

// Single shared SQL client — safe to call at module level in serverless
export const sql = neon(process.env.NEON_DB_POSTGRES_URL!);
