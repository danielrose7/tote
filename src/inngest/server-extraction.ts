import { z } from "zod";
import { MODELS } from "../lib/models";
import { parseJson } from "./lib/parseJson";
import type { ExtractedItem, UrlSection } from "./types";

export type ExtractionUsage = {
	inputTokens: number;
	outputTokens: number;
	webSearchRequests: number;
};

export type SectionExtractionResult = {
	slug: string;
	title: string;
	items: ExtractedItem[];
	usage: ExtractionUsage;
	cfCount: number;
	geminiCount: number;
	failedCount: number;
	durationMs: number;
};

// Convert protocol-relative URLs (//example.com/...) to https: before URL validation.
// Gemini sometimes returns the raw src attribute value rather than a resolved absolute URL.
const normalizeUrlField = z.preprocess(
	(val) =>
		typeof val === "string" && val.startsWith("//") ? `https:${val}` : val,
	z.string().url().nullish(),
);

const CollectionItemSchema = z.object({
	sourceUrl: z.string().url(),
	title: z.string().optional(),
	price: z.number().positive().optional(),
	currency: z.string().optional(),
	brand: z.string().optional(),
	description: z.string().optional(),
	imageUrl: normalizeUrlField,
});

const PageSchema = z.discriminatedUnion("pageType", [
	z.object({
		pageType: z.literal("product"),
		title: z.string(),
		price: z.number().positive(),
		currency: z.string(),
		brand: z.string(),
		description: z.string().optional(),
		imageUrl: normalizeUrlField,
		images: z.array(z.string().url()).optional(),
	}),
	z.object({
		pageType: z.literal("collection"),
		title: z.string(),
		collectionItems: z.array(CollectionItemSchema).min(1),
	}),
	z.object({
		pageType: z.literal("error"),
		reason: z.string(),
	}),
]);

type PageSchemaType = z.infer<typeof PageSchema>;

const PAGE_JSON_SCHEMA = z.toJSONSchema(PageSchema);

const SYSTEM_PROMPT = `<persona>
You are a product data extraction specialist. You research product pages and extract structured metadata.
</persona>

<task>
Given a URL, fetch the page and classify it as one of: product, collection, or error.
Return a single JSON object matching the output format exactly.
</task>

<output_format>
Return only a valid JSON object with this schema:
${JSON.stringify(PAGE_JSON_SCHEMA, null, 2)}

No markdown fences, no explanation — just the JSON object.
</output_format>

<page_types>
**product** — a single product detail page with a clear price and purchasable item.
  - title: full product name as shown
  - price: positive number, no symbols or commas
  - currency: 3-letter ISO code (USD, GBP, EUR, etc.)
  - brand: manufacturer or brand name
  - description: optional 1-2 sentence description
  - imageUrl: optional absolute URL (must start with https://) to main product image — prefer JSON-LD image field over img src attributes
  - images: optional array of additional product photo URLs (no logos/icons)

**collection** — a category, search results, or listing page showing multiple products.
  - title: page or category name
  - collectionItems: array of products found on the page, each with sourceUrl (required), plus title, price, currency, brand, description, imageUrl where available

**error** — use this when the page is inaccessible (404, access denied, login wall, CAPTCHA) or contains no extractable product data. Do NOT hallucinate product details.
  - reason: brief description of why extraction failed
</page_types>

<examples>
URL: https://www.patagonia.com/product/mens-down-sweater-hoody/84701.html
Output:
{"pageType":"product","title":"Men's Down Sweater Hoody","price":279,"currency":"USD","brand":"Patagonia","description":"A versatile hooded jacket filled with 800-fill-power recycled down.","imageUrl":"https://www.patagonia.com/dw/image/v2/BDJB_PRD/on/demandware.static/-/Sites-patagonia-master/default/dw7e6efb3c/images/hi-res/84701_BLK.jpg"}

URL: https://www.lululemon.com/en-us/c/womens-leggings
Output:
{"pageType":"collection","title":"Women's Leggings","collectionItems":[{"sourceUrl":"https://www.lululemon.com/en-us/p/align-pant-28/LW5CXIS.html","title":"Align Pant 28\"","price":98,"currency":"USD","brand":"lululemon"},{"sourceUrl":"https://www.lululemon.com/en-us/p/fast-and-free-tight/LW5ARXS.html","title":"Fast and Free Tight 25\"","price":128,"currency":"USD","brand":"lululemon"}]}

URL: https://www.example.com/login?redirect=/product/123
Output:
{"pageType":"error","reason":"Login wall — product page requires authentication"}
</examples>`;

// Titles that indicate the page blocked or errored rather than returning real content
const CF_FAILURE_TITLES = [
	"access denied",
	"403 forbidden",
	"404 not found",
	"page not found",
	"just a moment",
	"robot or human",
	"are you a robot",
	"enable javascript",
];

function isCfFailureTitle(title?: string): boolean {
	if (!title) return true;
	const lower = title.toLowerCase();
	return CF_FAILURE_TITLES.some((t) => lower.includes(t));
}

function normalizeCfCollectionItems(
	items: Partial<ExtractedItem>[] | undefined,
): ExtractedItem[] | undefined {
	if (!Array.isArray(items)) return undefined;

	return items
		.map((item) => {
			const sourceUrl =
				typeof item.sourceUrl === "string"
					? item.sourceUrl
					: typeof (item as { url?: unknown }).url === "string"
						? (item as { url: string }).url
						: undefined;
			if (!sourceUrl) return null;
			return {
				sourceUrl,
				title: item.title,
				description: item.description,
				price: item.price,
				currency: item.currency,
				brand: item.brand,
				availability: item.availability,
				imageUrl: item.imageUrl,
				images: item.images,
				pageType: "product" as const,
			};
		})
		.filter((item): item is ExtractedItem => item !== null);
}

/** Call the CF Browser Run worker for metadata extraction. */
export async function extractViaCf(url: string): Promise<ExtractedItem | null> {
	const workerUrl = process.env.EXTRACTOR_WORKER_URL;
	const secret = process.env.EXTRACTOR_SECRET;

	if (!workerUrl || !secret) {
		return null;
	}

	try {
		const res = await fetch(workerUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Extractor-Secret": secret,
			},
			body: JSON.stringify({ url }),
			signal: AbortSignal.timeout(30_000),
		});

		if (!res.ok) {
			console.warn("[server-extraction] cf:non-ok", {
				url,
				status: res.status,
			});
			return null;
		}

		const body = (await res.json()) as {
			ok: boolean;
			data?: Record<string, unknown>;
		};
		if (!body.ok || !body.data) return null;
		const d = body.data as Partial<ExtractedItem>;
		if (isCfFailureTitle(d.title)) {
			console.warn("[server-extraction] cf:failure-title", {
				url,
				title: d.title,
			});
			return null;
		}
		return {
			sourceUrl: url,
			title: d.title,
			description: d.description,
			price: d.price,
			currency: d.currency,
			brand: d.brand,
			availability: d.availability,
			imageUrl: d.imageUrl,
			pageType: d.pageType ?? "product",
			collectionItems: normalizeCfCollectionItems(d.collectionItems),
		};
	} catch (err) {
		console.warn("[server-extraction] cf:error", { url, error: String(err) });
		return null;
	}
}

type GeminiResponse = {
	candidates?: Array<{
		content?: { parts?: Array<{ text?: string }> };
	}>;
	usageMetadata?: {
		promptTokenCount?: number;
		candidatesTokenCount?: number;
	};
};

/** Use Gemini URL Context tool to extract product metadata without a pre-crawled HTML payload. */
export async function extractViaGemini(
	url: string,
): Promise<{ items: ExtractedItem[]; usage: ExtractionUsage }> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.warn("[server-extraction] gemini:no-api-key");
		return { items: [], usage: emptyUsage };
	}

	const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.geminiFlash}:generateContent`;

	const requestBody = {
		system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
		contents: [
			{
				role: "user",
				parts: [
					{
						text: `Classify and extract metadata for this URL: ${url}

Use the url_context tool to fetch the page and return a JSON object. Use pageType "error" if the page is inaccessible or has no extractable products — do not guess or hallucinate.

Return JSON only — no markdown fences, no explanation. Max 5 items for collection pages.`,
					},
				],
			},
		],
		tools: [{ url_context: {} }],
		// Note: responseMimeType is intentionally omitted — incompatible with url_context tool
	};

	try {
		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-goog-api-key": apiKey,
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(60_000),
		});

		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			console.warn("[server-extraction] gemini:non-ok", {
				url,
				status: res.status,
				errText: errText.slice(0, 200),
			});
			return { items: [], usage: emptyUsage };
		}

		const body = (await res.json()) as GeminiResponse;
		const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
		const outputTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
		const usage: ExtractionUsage = {
			inputTokens,
			outputTokens,
			webSearchRequests: 0,
		};

		const text =
			body.candidates?.[0]?.content?.parts
				?.filter((p): p is { text: string } => typeof p.text === "string")
				?.map((p) => p.text)
				?.join("\n")
				?.trim() ?? "";

		const parsed = parseJson<unknown>(text);
		if (!parsed) {
			console.warn("[server-extraction] gemini:parse-failed", {
				url,
				textPreview: text.slice(0, 200),
			});
			return { items: [], usage };
		}

		const validation = PageSchema.safeParse(parsed);
		if (!validation.success) {
			console.warn("[server-extraction] gemini:validation-failed", {
				url,
				issues: validation.error.issues,
			});
			return { items: [], usage };
		}

		const p = validation.data;

		if (p.pageType === "error") {
			console.warn("[server-extraction] gemini:page-error", {
				url,
				reason: p.reason,
			});
			return { items: [], usage };
		}

		if (p.pageType === "collection") {
			const collectionItem: ExtractedItem = {
				sourceUrl: url,
				title: p.title,
				pageType: "collection",
				collectionItems: p.collectionItems.map((c) => ({
					sourceUrl: c.sourceUrl,
					title: c.title,
					price: c.price !== undefined ? String(c.price) : undefined,
					currency: c.currency,
					brand: c.brand,
					description: c.description,
					imageUrl: c.imageUrl ?? undefined,
					pageType: "product" as const,
				})),
			};
			const { items, usage: expandUsage } =
				await expandCollection(collectionItem);
			return { items, usage: mergeUsage(usage, expandUsage) };
		}

		const item: ExtractedItem = {
			sourceUrl: url,
			title: p.title,
			price: String(p.price),
			currency: p.currency,
			brand: p.brand,
			description: p.description,
			imageUrl: p.imageUrl ?? undefined,
			images: p.images,
			pageType: "product",
		};
		return { items: [item], usage };
	} catch (err) {
		console.warn("[server-extraction] gemini:error", {
			url,
			error: String(err),
		});
		return { items: [], usage: emptyUsage };
	}
}

const MAX_COLLECTION_ITEMS = 5;

const emptyUsage: ExtractionUsage = {
	inputTokens: 0,
	outputTokens: 0,
	webSearchRequests: 0,
};

function mergeUsage(a: ExtractionUsage, b: ExtractionUsage): ExtractionUsage {
	return {
		inputTokens: a.inputTokens + b.inputTokens,
		outputTokens: a.outputTokens + b.outputTokens,
		webSearchRequests: a.webSearchRequests + b.webSearchRequests,
	};
}

type UrlExtractionResult = {
	items: ExtractedItem[];
	tier: "cf" | "gemini" | "failed" | "collection-expanded";
	usage: ExtractionUsage;
	durationMs: number;
};

/**
 * Mine product URLs from a collection page result and extract each one.
 * Uses collectionItems[].sourceUrl from CF; skips items that already have
 * title+price to avoid redundant extraction.
 */
async function expandCollection(
	collectionItem: ExtractedItem,
): Promise<{ items: ExtractedItem[]; usage: ExtractionUsage }> {
	const candidates = (collectionItem.collectionItems ?? [])
		.filter((c) => c.sourceUrl)
		.slice(0, MAX_COLLECTION_ITEMS);

	if (candidates.length === 0) return { items: [], usage: emptyUsage };

	const results = await Promise.all(
		candidates.map(async (candidate) => {
			// Already fully extracted by CF — use directly
			if (candidate.title && candidate.price) {
				return { item: candidate, usage: emptyUsage };
			}
			const r = await extractUrl(candidate.sourceUrl!);
			const item = r.items[0] ?? null;
			return { item, usage: r.usage };
		}),
	);

	return {
		items: results.flatMap((r) => (r.item ? [r.item] : [])),
		usage: results.reduce((acc, r) => mergeUsage(acc, r.usage), emptyUsage),
	};
}

/** Try CF first; fall back to Gemini URL Context if CF returns null or missing title. */
export async function extractUrl(url: string): Promise<UrlExtractionResult> {
	const startedAt = Date.now();

	// Tier 1: CF Browser Run
	const cfItem = await extractViaCf(url);
	if (cfItem && cfItem.title) {
		// Collection page: mine product URLs instead of returning the page itself
		if (cfItem.pageType === "collection") {
			const { items, usage } = await expandCollection(cfItem);
			return {
				items,
				tier: "collection-expanded",
				usage,
				durationMs: Date.now() - startedAt,
			};
		}
		return {
			items: [cfItem],
			tier: "cf",
			usage: emptyUsage,
			durationMs: Date.now() - startedAt,
		};
	}

	// Tier 2: Gemini URL Context
	const { items: geminiItems, usage } = await extractViaGemini(url);
	if (geminiItems.length > 0) {
		return {
			items: geminiItems,
			tier: "gemini",
			usage,
			durationMs: Date.now() - startedAt,
		};
	}

	return {
		items: [],
		tier: "failed",
		usage,
		durationMs: Date.now() - startedAt,
	};
}

/** Run extractUrl per URL with concurrency=3 using a worker pool. */
export async function extractSection(
	section: UrlSection,
	options?: { concurrency?: number },
): Promise<SectionExtractionResult> {
	const startedAt = Date.now();
	const concurrency = options?.concurrency ?? 3;

	const items: ExtractedItem[] = [];
	const aggregatedUsage: ExtractionUsage = {
		inputTokens: 0,
		outputTokens: 0,
		webSearchRequests: 0,
	};
	let cfCount = 0;
	let geminiCount = 0;
	let failedCount = 0;

	const urls = [...section.urls];
	const results: UrlExtractionResult[] = new Array(urls.length);

	// Worker pool: process URLs with bounded concurrency
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (true) {
			const idx = nextIndex++;
			if (idx >= urls.length) break;
			const url = urls[idx];
			results[idx] = await extractUrl(url);
		}
	}

	const workers = Array.from(
		{ length: Math.min(concurrency, urls.length) },
		() => worker(),
	);
	await Promise.all(workers);

	for (const r of results) {
		if (!r) continue;

		aggregatedUsage.inputTokens += r.usage.inputTokens;
		aggregatedUsage.outputTokens += r.usage.outputTokens;
		aggregatedUsage.webSearchRequests += r.usage.webSearchRequests;

		if (r.tier === "cf" || r.tier === "collection-expanded") cfCount++;
		else if (r.tier === "gemini") geminiCount++;
		else failedCount++;

		items.push(...r.items);
	}

	return {
		slug: section.slug,
		title: section.title,
		items,
		usage: aggregatedUsage,
		cfCount,
		geminiCount,
		failedCount,
		durationMs: Date.now() - startedAt,
	};
}
