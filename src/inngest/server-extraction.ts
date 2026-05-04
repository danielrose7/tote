import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ExtractedItem, UrlSection } from './types';

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
  webSearchCount: number;
  failedCount: number;
  durationMs: number;
};

const CollectionItemSchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().optional(),
  price: z.number().positive().optional(),
  currency: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const PageSchema = z.discriminatedUnion('pageType', [
  z.object({
    pageType: z.literal('product'),
    title: z.string(),
    price: z.number().positive(),
    currency: z.string(),
    brand: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    images: z.array(z.string().url()).optional(),
  }),
  z.object({
    pageType: z.literal('collection'),
    title: z.string(),
    collectionItems: z.array(CollectionItemSchema).min(1),
  }),
  z.object({
    pageType: z.literal('error'),
    reason: z.string(),
  }),
]);

type PageSchemaType = z.infer<typeof PageSchema>;

const PAGE_JSON_SCHEMA = z.toJSONSchema(PageSchema);

const SYSTEM_PROMPT = `<persona>
You are a product data extraction specialist. You research product pages and extract structured metadata.
</persona>

<task>
Given a URL, use web search to find the page and classify it as one of: product, collection, or error.
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
  - imageUrl: optional direct URL to main product image
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
  'access denied',
  '403 forbidden',
  '404 not found',
  'page not found',
  'just a moment',
  'robot or human',
  'are you a robot',
  'enable javascript',
];

function isCfFailureTitle(title?: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase();
  return CF_FAILURE_TITLES.some((t) => lower.includes(t));
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extractor-Secret': secret,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn('[server-extraction] cf:non-ok', {
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
      console.warn('[server-extraction] cf:failure-title', {
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
      pageType: d.pageType ?? 'product',
      collectionItems: d.collectionItems,
    };
  } catch (err) {
    console.warn('[server-extraction] cf:error', { url, error: String(err) });
    return null;
  }
}

/** Use Anthropic web_search_20250305 built-in tool to extract product metadata. */
export async function extractViaWebSearch(
  url: string,
): Promise<{ items: ExtractedItem[]; usage: ExtractionUsage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[server-extraction] web-search:no-api-key');
    return { items: [], usage: emptyUsage };
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 60_000 });

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Classify and extract metadata for this URL: ${url}

Search for the page and return a JSON object. Use pageType "error" if the page is inaccessible or has no extractable products — do not guess or hallucinate.`,
    },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalWebSearchRequests = 0;

  const MAX_ATTEMPTS = 3;
  let lastError = '';
  let lastText = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: 'web_search_20250305' as 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
            allowed_domains: [new URL(url).hostname],
          },
        ],
        messages,
      });

      if (response.usage) {
        const cacheWrite = response.usage.cache_creation_input_tokens ?? 0;
        const cacheRead = response.usage.cache_read_input_tokens ?? 0;
        totalInputTokens +=
          response.usage.input_tokens + cacheWrite + cacheRead;
        totalOutputTokens += response.usage.output_tokens;
        totalWebSearchRequests +=
          response.usage.server_tool_use?.web_search_requests ?? 0;
      }

      // Extract text blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      const text = textBlocks
        .map((b) => b.text)
        .join('\n')
        .trim();
      lastText = text;

      // Strip markdown fences if present
      const stripped = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

      // Try to parse the JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripped);
      } catch {
        // Try extracting JSON object from mixed content
        const match = stripped.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            // Fall through to repair loop
          }
        }
      }

      if (parsed === undefined) {
        lastError = `JSON parse failed on attempt ${attempt}. Raw output: ${text.slice(0, 300)}`;
        if (attempt < MAX_ATTEMPTS) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: `Your response was not valid JSON. Error: ${lastError}\n\nPlease return only a valid JSON object matching the schema. No markdown, no explanation.`,
          });
          continue;
        }
        break;
      }

      const validation = PageSchema.safeParse(parsed);
      if (!validation.success) {
        lastError = `Zod validation failed on attempt ${attempt}: ${JSON.stringify(validation.error.issues)}`;
        if (attempt < MAX_ATTEMPTS) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: `Your JSON did not match the required schema. Validation errors: ${lastError}\n\nPlease fix and return only the corrected JSON object.`,
          });
          continue;
        }
        break;
      }

      const currentUsage: ExtractionUsage = {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        webSearchRequests: totalWebSearchRequests,
      };

      const p: PageSchemaType = validation.data;

      if (p.pageType === 'error') {
        console.warn('[server-extraction] web-search:page-error', {
          url,
          reason: p.reason,
        });
        return { items: [], usage: currentUsage };
      }

      if (p.pageType === 'collection') {
        const collectionItem: ExtractedItem = {
          sourceUrl: url,
          title: p.title,
          pageType: 'collection',
          collectionItems: p.collectionItems.map((c) => ({
            sourceUrl: c.sourceUrl,
            title: c.title,
            price: c.price !== undefined ? String(c.price) : undefined,
            currency: c.currency,
            brand: c.brand,
            description: c.description,
            imageUrl: c.imageUrl,
            pageType: 'product' as const,
          })),
        };
        const { items, usage: expandUsage } =
          await expandCollection(collectionItem);
        return { items, usage: mergeUsage(currentUsage, expandUsage) };
      }

      // pageType === 'product'
      const item: ExtractedItem = {
        sourceUrl: url,
        title: p.title,
        price: String(p.price),
        currency: p.currency,
        brand: p.brand,
        description: p.description,
        imageUrl: p.imageUrl,
        images: p.images,
        pageType: 'product',
      };

      return { items: [item], usage: currentUsage };
    } catch (err) {
      console.warn('[server-extraction] web-search:api-error', {
        url,
        attempt,
        error: String(err),
      });
      lastError = String(err);
      if (attempt === MAX_ATTEMPTS) break;
    }
  }

  console.warn('[server-extraction] web-search:failed', {
    url,
    lastError,
    lastTextPreview: lastText.slice(0, 200),
  });

  return {
    items: [],
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      webSearchRequests: totalWebSearchRequests,
    },
  };
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
  tier: 'cf' | 'web-search' | 'failed' | 'collection-expanded';
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

/** Try CF first; fall back to web search if CF returns null or missing title. */
export async function extractUrl(url: string): Promise<UrlExtractionResult> {
  const startedAt = Date.now();

  // Tier 1: CF Browser Run
  const cfItem = await extractViaCf(url);
  if (cfItem && cfItem.title) {
    // Collection page: mine product URLs instead of returning the page itself
    if (cfItem.pageType === 'collection') {
      const { items, usage } = await expandCollection(cfItem);
      return {
        items,
        tier: 'collection-expanded',
        usage,
        durationMs: Date.now() - startedAt,
      };
    }
    return {
      items: [cfItem],
      tier: 'cf',
      usage: emptyUsage,
      durationMs: Date.now() - startedAt,
    };
  }

  // Tier 2: Anthropic web search
  const { items: wsItems, usage } = await extractViaWebSearch(url);
  if (wsItems.length > 0) {
    return {
      items: wsItems,
      tier: 'web-search',
      usage,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    items: [],
    tier: 'failed',
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
  let webSearchCount = 0;
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

    if (r.tier === 'cf' || r.tier === 'collection-expanded') cfCount++;
    else if (r.tier === 'web-search') webSearchCount++;
    else failedCount++;

    items.push(...r.items);
  }

  return {
    slug: section.slug,
    title: section.title,
    items,
    usage: aggregatedUsage,
    cfCount,
    webSearchCount,
    failedCount,
    durationMs: Date.now() - startedAt,
  };
}
