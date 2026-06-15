/**
 * Debug specific URLs against the CF extractor worker.
 * Captures screenshot, final URL, page title, nav errors, and extraction result.
 *
 * Usage:
 *   EXTRACTOR_WORKER_URL=... EXTRACTOR_SECRET=... npx tsx scripts/debug-cf.ts <url> [url2] ...
 *
 * Saves screenshots to scripts/debug-screenshots/<hostname>-<timestamp>.jpg
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const WORKER_URL = process.env.EXTRACTOR_WORKER_URL?.replace(/\/$/, "");
const SECRET = process.env.EXTRACTOR_SECRET;
const OUT_DIR = join(import.meta.dirname, "debug-screenshots");

const urls = process.argv.slice(2);

if (!WORKER_URL || !SECRET) {
	console.error(
		"Error: set EXTRACTOR_WORKER_URL and EXTRACTOR_SECRET env vars.",
	);
	process.exit(1);
}
if (urls.length === 0) {
	console.error("Usage: npx tsx scripts/debug-cf.ts <url> [url2] ...");
	process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const url of urls) {
	console.log(`\n${"─".repeat(60)}`);
	console.log(`URL: ${url}`);
	console.log("Fetching...");

	const start = Date.now();
	let json: {
		ok: boolean;
		data?: Record<string, unknown> | null;
		error?: string;
		debug?: {
			navError: string | null;
			title: string | null;
			finalUrl: string;
			screenshot: string | null;
		};
	};

	try {
		const res = await fetch(WORKER_URL!, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Extractor-Secret": SECRET!,
			},
			body: JSON.stringify({ url, debug: true }),
		});
		json = await res.json();
	} catch (err) {
		console.error(`FETCH ERROR: ${err}`);
		continue;
	}

	const ms = Date.now() - start;
	console.log(`Done in ${ms}ms`);

	const { debug, data } = json;

	if (debug?.navError) {
		console.log(`Nav error: ${debug.navError}`);
	}
	if (debug?.finalUrl && debug.finalUrl !== url) {
		console.log(`Redirected to: ${debug.finalUrl}`);
	}
	console.log(`Page title: ${debug?.title ?? "(none)"}`);

	if (data) {
		const fields = [
			"title",
			"price",
			"currency",
			"brand",
			"imageUrl",
			"description",
		] as const;
		console.log("Extraction:");
		for (const f of fields) {
			const v = data[f];
			if (v) console.log(`  ${f}: ${String(v).slice(0, 80)}`);
		}
	} else {
		console.log("Extraction: null");
	}

	if (debug?.screenshot) {
		const hostname = (() => {
			try {
				return new URL(url).hostname.replace(/^www\./, "");
			} catch {
				return "unknown";
			}
		})();
		const filename = `${hostname}-${Date.now()}.jpg`;
		const outPath = join(OUT_DIR, filename);
		writeFileSync(outPath, Buffer.from(debug.screenshot, "base64"));
		console.log(`Screenshot: ${outPath}`);
	} else {
		console.log("Screenshot: (none)");
	}
}
