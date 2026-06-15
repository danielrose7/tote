const PALETTE = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#f59e0b",
	"#10b981",
	"#3b82f6",
	"#ef4444",
	"#14b8a6",
];

function pickColor(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return PALETTE[hash % PALETTE.length];
}

async function main() {
	const { neon } = await import("@neondatabase/serverless");
	const url =
		process.env.NEON_DB_POSTGRES_URL_NON_POOLING ??
		process.env.NEON_DB_POSTGRES_URL;
	if (!url) throw new Error("No DB URL");
	const sql = neon(url);

	const rows =
		await sql`SELECT id, slug FROM published_collections WHERE color IS NULL`;
	console.log(`Backfilling ${rows.length} collection(s)...`);

	for (const row of rows) {
		const color = pickColor(row.slug as string);
		await sql`UPDATE published_collections SET color = ${color} WHERE id = ${row.id as string}`;
		console.log(`  ${row.slug} → ${color}`);
	}

	console.log("Done.");
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
