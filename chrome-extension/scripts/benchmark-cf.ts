/**
 * Benchmark Cloudflare Browser Run extraction against the local corpus baselines.
 *
 * Prerequisites:
 *   1. Deploy workers/extractor: `cd workers/extractor && pnpm deploy`
 *   2. Sync corpus locally: `pnpm corpus:sync` (from chrome-extension/)
 *   3. Set env vars:
 *        EXTRACTOR_WORKER_URL=https://tote-extractor.<account>.workers.dev
 *        EXTRACTOR_SECRET=<your secret>
 *
 * Usage:
 *   EXTRACTOR_WORKER_URL=... EXTRACTOR_SECRET=... npx tsx scripts/benchmark-cf.ts
 *
 * Optional:
 *   CONCURRENCY=5   — parallel requests (default: 3, max ~10 per Browser Run limits)
 *   LIMIT=20        — only run against first N captures
 *   SAMPLE=1        — run against curated sample (fixtures/sample.json) instead of full corpus
 *   DEBUG=1         — request debug info (screenshot, title, finalUrl) and save JPEGs for errors
 */

import {
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "fs";
import { join } from "path";
import type { RawPageCapture } from "../src/lib/extractors/types";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/captures");
const SAMPLE_FILE = join(import.meta.dirname, "../fixtures/sample.json");
const WORKER_URL = process.env.EXTRACTOR_WORKER_URL?.replace(/\/$/, "");
const SECRET = process.env.EXTRACTOR_SECRET;
const CONCURRENCY = Math.min(parseInt(process.env.CONCURRENCY ?? "3", 10), 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
const USE_SAMPLE = Boolean(process.env.SAMPLE);
const DEBUG = Boolean(process.env.DEBUG);
const DEBUG_DIR = join(import.meta.dirname, "debug-screenshots");

const FIELDS = [
	"title",
	"description",
	"imageUrl",
	"price",
	"currency",
	"brand",
] as const;
type Field = (typeof FIELDS)[number];

// ── URL normalization ───────────────────────────────────────────────────────

const TRACKING_PARAMS = new Set([
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"campaign_source",
	"gclid",
	"gclsrc",
	"gbraid",
	"wbraid",
	"gad_source",
	"gad_campaignid",
	"srsltid",
	"fbclid",
	"msclkid",
]);

function normalizeUrl(url: string): string {
	try {
		const u = new URL(url);
		for (const key of [...u.searchParams.keys()]) {
			if (TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
		}
		u.searchParams.sort();
		return u.toString();
	} catch {
		return url;
	}
}

// ── Corpus loading ──────────────────────────────────────────────────────────

function walkJson(dir: string): string[] {
	const results: string[] = [];
	try {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) results.push(...walkJson(full));
			else if (entry.endsWith(".json") && entry !== "manifest.json")
				results.push(full);
		}
	} catch {}
	return results;
}

function loadCaptures(): RawPageCapture[] {
	if (USE_SAMPLE) {
		const sample: { tier: string; domain: string; url: string }[] = JSON.parse(
			readFileSync(SAMPLE_FILE, "utf-8"),
		);
		const sampleUrls = new Set(sample.map((s) => normalizeUrl(s.url)));
		const files = walkJson(FIXTURES_DIR);
		// Deduplicate by normalized URL — a product may have multiple timestamped capture files
		const seen = new Set<string>();
		const captures = files
			.map((p) => JSON.parse(readFileSync(p, "utf-8")) as RawPageCapture)
			.filter((c) => {
				const norm = normalizeUrl(c.url);
				if (!sampleUrls.has(norm) || seen.has(norm)) return false;
				seen.add(norm);
				return true;
			});
		// Preserve tier order from sample manifest
		const order = new Map(sample.map((s, i) => [normalizeUrl(s.url), i]));
		captures.sort(
			(a, b) =>
				(order.get(normalizeUrl(a.url)) ?? 999) -
				(order.get(normalizeUrl(b.url)) ?? 999),
		);
		const missing = sample.length - captures.length;
		console.log(
			`  (sample mode: ${captures.length}/${sample.length} URLs matched${missing > 0 ? `, ${missing} not in local corpus` : ""})\n`,
		);
		return captures;
	}
	const files = walkJson(FIXTURES_DIR);
	const captures = files.map(
		(p) => JSON.parse(readFileSync(p, "utf-8")) as RawPageCapture,
	);
	return LIMIT ? captures.slice(0, LIMIT) : captures;
}

// ── Worker call ─────────────────────────────────────────────────────────────

interface DebugInfo {
	navError: string | null;
	title: string | null;
	finalUrl: string;
	screenshot: string | null;
}

interface WorkerResult {
	ok: boolean;
	data?: Record<string, unknown>;
	error?: string;
	debug?: DebugInfo;
}

async function extractViaWorker(
	url: string,
	attempt = 1,
): Promise<WorkerResult> {
	const res = await fetch(WORKER_URL!, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Extractor-Secret": SECRET!,
		},
		body: JSON.stringify({ url, debug: DEBUG }),
	});
	const text = await res.text();
	try {
		return JSON.parse(text) as WorkerResult;
	} catch {
		if (attempt < 3) {
			await new Promise((r) => setTimeout(r, 1000 * attempt));
			return extractViaWorker(url, attempt + 1);
		}
		return {
			ok: false,
			error: `Non-JSON response (attempt ${attempt}): ${text.slice(0, 120)}`,
		};
	}
}

// ── Debug screenshot helper ─────────────────────────────────────────────────

function saveScreenshot(url: string, base64: string): void {
	mkdirSync(DEBUG_DIR, { recursive: true });
	const hostname = (() => {
		try {
			return new URL(url).hostname.replace(/^www\./, "");
		} catch {
			return "unknown";
		}
	})();
	const filename = `${hostname}-${Date.now()}.jpg`;
	const outPath = join(DEBUG_DIR, filename);
	writeFileSync(outPath, Buffer.from(base64, "base64"));
	console.log(`  screenshot → ${outPath}`);
}

// ── Concurrency helper ──────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let idx = 0;
	async function worker() {
		while (idx < items.length) {
			const i = idx++;
			results[i] = await fn(items[i], i);
		}
	}
	await Promise.all(Array.from({ length: limit }, worker));
	return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	if (!WORKER_URL || !SECRET) {
		console.error(
			"Error: set EXTRACTOR_WORKER_URL and EXTRACTOR_SECRET env vars.",
		);
		process.exit(1);
	}

	const captures = loadCaptures();
	if (captures.length === 0) {
		console.error("No corpus captures found. Run `pnpm corpus:sync` first.");
		process.exit(1);
	}

	// Build url→tier map for sample mode labels
	const tierMap = USE_SAMPLE
		? new Map<string, string>(
				(
					JSON.parse(readFileSync(SAMPLE_FILE, "utf-8")) as {
						tier: string;
						url: string;
					}[]
				).map((s) => [normalizeUrl(s.url), s.tier]),
			)
		: new Map<string, string>();

	const modeLabel = USE_SAMPLE ? "sample" : "full corpus";
	console.log(
		`\n=== CF Browser Run Benchmark (${captures.length} URLs, ${modeLabel}, concurrency=${CONCURRENCY}) ===\n`,
	);

	type FieldCounts = { baselineHas: number; cfHas: number };
	const counts: Record<Field, FieldCounts> = {
		title: { baselineHas: 0, cfHas: 0 },
		description: { baselineHas: 0, cfHas: 0 },
		imageUrl: { baselineHas: 0, cfHas: 0 },
		price: { baselineHas: 0, cfHas: 0 },
		currency: { baselineHas: 0, cfHas: 0 },
		brand: { baselineHas: 0, cfHas: 0 },
	};

	let cfErrors = 0;
	let totalMs = 0;
	const regressions: { url: string; field: Field }[] = [];
	const gains: { url: string; field: Field }[] = [];

	const outcomes = await runWithConcurrency(
		captures,
		CONCURRENCY,
		async (capture, i) => {
			const host = (() => {
				try {
					return new URL(capture.url).hostname.replace(/^www\./, "");
				} catch {
					return capture.url.slice(0, 40);
				}
			})();
			const tier = tierMap.get(normalizeUrl(capture.url));
			const label = tier ? `[${tier}] ${host}` : host;

			const pad = String(i + 1).padStart(String(captures.length).length);
			process.stdout.write(`[${pad}/${captures.length}] ${label} ... `);

			const start = Date.now();
			let result: WorkerResult | null = null;

			try {
				result = await extractViaWorker(capture.url);
			} catch (err) {
				console.log(`FETCH ERROR: ${err}`);
				return { capture, cfData: null, error: true, ms: Date.now() - start };
			}

			const ms = Date.now() - start;
			const dbg = result.debug;

			if (!result.ok) {
				let errLine = `WORKER ERROR: ${result.error ?? dbg?.navError ?? "unknown"} (${ms}ms)`;
				if (dbg?.finalUrl && dbg.finalUrl !== capture.url)
					errLine += ` → ${dbg.finalUrl}`;
				console.log(errLine);
				if (DEBUG && dbg?.screenshot)
					saveScreenshot(capture.url, dbg.screenshot);
				return { capture, cfData: null, error: true, ms };
			}

			let okLine = `ok (${ms}ms)`;
			if (DEBUG && dbg) {
				if (dbg.navError) okLine += ` [nav:${dbg.navError.slice(0, 60)}]`;
				if (dbg.finalUrl && dbg.finalUrl !== capture.url)
					okLine += ` → ${dbg.finalUrl}`;
			}
			console.log(okLine);
			return { capture, cfData: result.data ?? null, error: false, ms };
		},
	);

	for (const { capture, cfData, error, ms } of outcomes) {
		if (error) {
			cfErrors++;
			continue;
		}
		totalMs += ms;

		const baseline = capture.extraction;
		for (const field of FIELDS) {
			const hasBaseline = Boolean(baseline[field as keyof typeof baseline]);
			const hasCf = Boolean(cfData?.[field]);

			if (hasBaseline) counts[field].baselineHas++;
			if (hasCf) counts[field].cfHas++;

			if (hasBaseline && !hasCf) regressions.push({ url: capture.url, field });
			if (!hasBaseline && hasCf) gains.push({ url: capture.url, field });
		}
	}

	const succeeded = captures.length - cfErrors;

	// ── Coverage table ──────────────────────────────────────────────────────

	console.log("\n--- Field coverage ---");
	console.log(
		`${"Field".padEnd(14)} ${"Baseline".padStart(10)} ${"CF Live".padStart(10)} ${"Delta".padStart(8)}`,
	);
	console.log("-".repeat(46));
	for (const f of FIELDS) {
		const c = counts[f];
		const bPct =
			succeeded > 0 ? Math.round((c.baselineHas / succeeded) * 100) : 0;
		const cfPct = succeeded > 0 ? Math.round((c.cfHas / succeeded) * 100) : 0;
		const delta = cfPct - bPct;
		const sign = delta > 0 ? "+" : "";
		const deltaStr = `${sign}${delta}%`;
		console.log(
			`${f.padEnd(14)} ${`${bPct}%`.padStart(10)} ${`${cfPct}%`.padStart(10)} ${deltaStr.padStart(8)}`,
		);
	}

	// ── Summary ─────────────────────────────────────────────────────────────

	console.log(`\n--- Summary ---`);
	console.log(
		`Total: ${captures.length}  Succeeded: ${succeeded}  Errors: ${cfErrors}`,
	);
	if (succeeded > 0) {
		console.log(`Avg latency: ${Math.round(totalMs / succeeded)}ms/page`);
	}

	// ── Regressions ─────────────────────────────────────────────────────────

	if (regressions.length > 0) {
		console.log(`\n--- Regressions (baseline had field, CF missed) ---`);
		const byField = new Map<Field, string[]>();
		for (const { url, field } of regressions) {
			const host = (() => {
				try {
					return new URL(url).hostname.replace(/^www\./, "");
				} catch {
					return url;
				}
			})();
			const list = byField.get(field) ?? [];
			list.push(host);
			byField.set(field, list);
		}
		for (const [field, hosts] of byField) {
			console.log(`  ${field}: ${hosts.join(", ")}`);
		}
	}

	// ── Gains ───────────────────────────────────────────────────────────────

	if (gains.length > 0) {
		console.log(`\n--- Gains (CF found field, baseline missed) ---`);
		const byField = new Map<Field, string[]>();
		for (const { url, field } of gains) {
			const host = (() => {
				try {
					return new URL(url).hostname.replace(/^www\./, "");
				} catch {
					return url;
				}
			})();
			const list = byField.get(field) ?? [];
			list.push(host);
			byField.set(field, list);
		}
		for (const [field, hosts] of byField) {
			console.log(`  ${field}: ${hosts.join(", ")}`);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
