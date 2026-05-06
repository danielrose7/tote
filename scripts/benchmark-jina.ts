#!/usr/bin/env tsx
/**
 * Benchmark extraction approaches against a sample of URLs.
 *
 * Measures: success rate, field coverage, response size (cost proxy), latency.
 *
 * Modes:
 *   cf-json   — CF Browser Run /json with Claude Haiku (custom_ai)
 *   schema    — r.jina.ai + x-json-schema + ReaderLM-v2: single call, no Claude
 *   reader    — r.jina.ai fetches markdown → Claude Haiku extracts structured data
 *   search    — s.jina.ai searches for the URL → Claude Haiku extracts from results
 *   pipeline  — CF /json first, Jina Reader fallback
 *   gemini    — Gemini 2.5 Flash with URL Context tool (single call, no Jina)
 *
 * Prerequisites:
 *   JINA_API_KEY=xxx          — get a free key at https://jina.ai
 *   ANTHROPIC_API_KEY=xxx     — only needed for reader/search/pipeline modes
 *   CLOUDFLARE_BROWSER_RUN_EDIT=xxx  — only needed for cf-json/pipeline modes
 *   GEMINI_API_KEY=xxx        — only needed for gemini mode
 *
 * Usage:
 *   MODE=gemini GEMINI_API_KEY=xxx npx tsx scripts/benchmark-jina.ts
 *   MODE=pipeline npx tsx scripts/benchmark-jina.ts
 *
 * Optional:
 *   CONCURRENCY=3   — parallel requests (default: 3)
 *   LIMIT=5         — only run first N URLs
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { parseJson } from '../src/inngest/lib/parseJson';

// ── Sample corpus ─────────────────────────────────────────────────────────────
// Mix of: known CF-blocked sites, JS-heavy sites, easy sites, collection pages

const SAMPLE_URLS: { url: string; domain: string; note: string }[] = [
  // CF-blocked (tier-1 fails) — the primary target for Jina Reader
  {
    url: 'https://shop.lululemon.com/p/jackets-and-hoodies-jackets/W-Cross-Chill-Performance-Jacket/_/prod9750597',
    domain: 'lululemon.com',
    note: 'CF-blocked product',
  },
  {
    url: 'https://shop.lululemon.com/a/running-jacket-with-phone-pocket-2aaz00a',
    domain: 'lululemon.com',
    note: 'CF-blocked collection landing',
  },
  {
    url: 'https://www.patagonia.com/product/mens-down-sweater-hoody/84701.html',
    domain: 'patagonia.com',
    note: 'CF-blocked product',
  },
  {
    url: 'https://www.titlenine.com/womens-running-jackets',
    domain: 'titlenine.com',
    note: 'CF-blocked collection',
  },
  // Generally accessible — establishes a ceiling
  {
    url: 'https://www.rei.com/product/243049/patagonia-houdini-jacket-womens',
    domain: 'rei.com',
    note: 'Accessible product',
  },
  {
    url: 'https://www.allbirds.com/products/womens-tree-runners',
    domain: 'allbirds.com',
    note: 'Accessible product',
  },
  {
    url: 'https://www.outdoorgearlab.com/topics/clothing-womens/best-running-jacket-womens',
    domain: 'outdoorgearlab.com',
    note: 'Editorial / collection-like',
  },
  // Paywalled / unusual
  {
    url: 'https://www.net-a-porter.com/en-us/shop/product/lululemon/sport/jackets/define-jacket-nulu/1647597347075434',
    domain: 'net-a-porter.com',
    note: 'Luxury retailer',
  },
];

// ── Extraction schema (mirrors server-extraction.ts) ──────────────────────────

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
    imageUrl: z.string().url().nullish(),
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

type PageResult = z.infer<typeof PageSchema>;

const PAGE_JSON_SCHEMA = z.toJSONSchema(PageSchema);

const EXTRACTION_PROMPT = `You are a product data extraction specialist. Given the content of a web page, classify it and extract structured metadata.

Return ONLY a valid JSON object matching this schema (no markdown, no explanation):
${JSON.stringify(PAGE_JSON_SCHEMA, null, 2)}

Page types:
- product: single product with price. Extract title, price (number), currency (ISO), brand, description, imageUrl.
- collection: listing/category page with multiple products. Extract title and collectionItems array (max 5 items).
- error: inaccessible, login wall, CAPTCHA, or no extractable products. Never hallucinate data.`;

// ── Cloudflare Browser Run /json extraction ───────────────────────────────────

const CF_ACCOUNT_ID = '997749fb55cf6e51c8c6746a78573ceb';
const CF_JSON_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/json`;

const CF_EXTRACTION_PROMPT =
  'Extract product metadata from this page and return ONLY a JSON object, no markdown fences. ' +
  'Set pageType to "product" for a single purchasable item, "collection" for a listing/category page, ' +
  'or "error" if the page is blocked, requires login, or has no extractable products. ' +
  'For products: include title (string), price (number), currency (3-letter ISO code), brand (string), description (string), imageUrl (string). ' +
  'For collections: include title (string) and collectionItems (array of objects with sourceUrl, title, price, currency, brand). ' +
  'For errors: include reason (string). ' +
  'Return raw JSON only — no explanation, no markdown.';

// Flat schema — no discriminated union, Llama handles simple objects more reliably.
// We coerce to PageResult ourselves after receiving the response.
const CF_FLAT_SCHEMA = {
  type: 'object',
  properties: {
    pageType: { type: 'string', enum: ['product', 'collection', 'error'] },
    title: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
    brand: { type: 'string' },
    description: { type: 'string' },
    imageUrl: { type: 'string' },
    reason: { type: 'string' },
    collectionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceUrl: { type: 'string' },
          title: { type: 'string' },
          price: { type: 'number' },
          currency: { type: 'string' },
          brand: { type: 'string' },
        },
      },
    },
  },
  required: ['pageType'],
};

type CfJsonResult = {
  ok: boolean;
  data: PageResult | null;
  responseChars: number;
  durationMs: number;
  error?: string;
};

function coerceCfResult(raw: unknown): PageResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pt = r.pageType;
  if (pt === 'product') {
    if (!r.title || !r.price) return null;
    return {
      pageType: 'product',
      title: String(r.title),
      price: Number(r.price),
      currency: String(r.currency ?? 'USD'),
      brand: String(r.brand ?? ''),
      description: r.description ? String(r.description) : undefined,
      imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
    };
  }
  if (pt === 'collection') {
    if (!r.title) return null;
    const items = Array.isArray(r.collectionItems)
      ? r.collectionItems
          .map((c: unknown) => {
            const ci = c as Record<string, unknown>;
            return {
              sourceUrl: String(ci.sourceUrl ?? ''),
              title: ci.title ? String(ci.title) : undefined,
            };
          })
          .filter((c) => c.sourceUrl)
      : [];
    return {
      pageType: 'collection',
      title: String(r.title),
      collectionItems: items.length ? items : [{ sourceUrl: '' }],
    };
  }
  if (pt === 'error') {
    return { pageType: 'error', reason: String(r.reason ?? 'unknown') };
  }
  return null;
}

async function fetchViaCfJson(
  apiToken: string,
  url: string,
): Promise<CfJsonResult> {
  const start = Date.now();
  try {
    const res = await fetch(CF_JSON_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        prompt: CF_EXTRACTION_PROMPT,
        gotoOptions: { waitUntil: 'domcontentloaded' },
        custom_ai: [
          {
            model: 'anthropic/claude-haiku-4-5-20251001',
            authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const durationMs = Date.now() - start;
    const text = await res.text();
    const responseChars = text.length;

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    let body: { success?: boolean; result?: unknown; errors?: unknown[] };
    try {
      body = JSON.parse(text);
    } catch {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `Non-JSON response: ${text.slice(0, 100)}`,
      };
    }

    if (!body.success) {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `CF error: ${JSON.stringify(body.errors).slice(0, 200)}`,
      };
    }

    // Without response_format, result may be a string containing JSON
    let raw: unknown = body.result;
    if (typeof raw === 'string') {
      raw = parseJson(raw) ?? raw;
    }

    const data = coerceCfResult(raw);
    if (!data) {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `Unrecognised result: ${JSON.stringify(raw).slice(0, 150)}`,
      };
    }

    return { ok: true, data, responseChars, durationMs };
  } catch (err) {
    return {
      ok: false,
      data: null,
      responseChars: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Jina schema extraction (ReaderLM-v2, no Claude) ───────────────────────────

type JinaSchemaResult = {
  ok: boolean;
  data: PageResult | null;
  responseChars: number;
  durationMs: number;
  error?: string;
};

async function fetchViaJinaSchema(
  apiKey: string,
  url: string,
): Promise<JinaSchemaResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'X-Respond-With': 'readerlm-v2',
        'X-Json-Schema': JSON.stringify(PAGE_JSON_SCHEMA),
      },
      signal: AbortSignal.timeout(60_000),
    });
    const durationMs = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        responseChars: 0,
        durationMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const text = await res.text();
    const responseChars = text.length;

    // Jina returns {code, status, data: {url, title, content, ...}}
    // With x-json-schema, content should be our JSON
    let jinaBody: { data?: { content?: string } } | null = null;
    try {
      jinaBody = JSON.parse(text);
    } catch {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `Jina response not JSON: ${text.slice(0, 100)}`,
      };
    }

    const content = jinaBody?.data?.content ?? text;
    const parsed = parseJson(content);

    if (!parsed) {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `JSON parse failed: ${content.slice(0, 120)}`,
      };
    }

    const validation = PageSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        ok: false,
        data: null,
        responseChars,
        durationMs,
        error: `Schema mismatch: ${JSON.stringify(validation.error.issues).slice(0, 120)}`,
      };
    }

    return { ok: true, data: validation.data, responseChars, durationMs };
  } catch (err) {
    return {
      ok: false,
      data: null,
      responseChars: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Jina Reader ───────────────────────────────────────────────────────────────

type JinaReaderResult = {
  ok: boolean;
  markdown: string;
  responseChars: number;
  durationMs: number;
  error?: string;
};

async function fetchViaJinaReader(
  apiKey: string,
  url: string,
): Promise<JinaReaderResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/plain',
        'X-Return-Format': 'markdown',
        // Focus on main content, strip boilerplate — cuts response size ~80%
        'X-Target-Selector':
          'main, article, [role="main"], #content, .product, .product-detail, [data-testid*="product"]',
        'X-Remove-Selector':
          'nav, header, footer, .nav, .header, .footer, .cookie, .banner, .popup',
        'X-No-Images': 'true',
      },
      signal: AbortSignal.timeout(30_000),
    });
    const durationMs = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        markdown: '',
        responseChars: 0,
        durationMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const markdown = await res.text();
    return { ok: true, markdown, responseChars: markdown.length, durationMs };
  } catch (err) {
    return {
      ok: false,
      markdown: '',
      responseChars: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Jina Search ───────────────────────────────────────────────────────────────

async function fetchViaJinaSearch(
  apiKey: string,
  url: string,
): Promise<JinaReaderResult> {
  // Search for the URL itself to get its content surfaced via Jina's search index
  const query = encodeURIComponent(url);
  const start = Date.now();
  try {
    const res = await fetch(`https://s.jina.ai/${query}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(30_000),
    });
    const durationMs = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        markdown: '',
        responseChars: 0,
        durationMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const markdown = await res.text();
    return { ok: true, markdown, responseChars: markdown.length, durationMs };
  } catch (err) {
    return {
      ok: false,
      markdown: '',
      responseChars: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Claude extraction from markdown ──────────────────────────────────────────

type ClaudeExtractionResult = {
  ok: boolean;
  data: PageResult | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  error?: string;
};

async function extractViaClause(
  client: Anthropic,
  url: string,
  markdown: string,
): Promise<ClaudeExtractionResult> {
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `URL: ${url}\n\nPage content:\n\n${markdown}`,
        },
      ],
    });

    const durationMs = Date.now() - start;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const parsed = parseJson(text);

    if (!parsed) {
      return {
        ok: false,
        data: null,
        inputTokens,
        outputTokens,
        durationMs,
        error: `JSON parse failed: ${text.slice(0, 100)}`,
      };
    }

    const validation = PageSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        ok: false,
        data: null,
        inputTokens,
        outputTokens,
        durationMs,
        error: `Schema validation failed: ${JSON.stringify(validation.error.issues).slice(0, 120)}`,
      };
    }

    return {
      ok: true,
      data: validation.data,
      inputTokens,
      outputTokens,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── CF Puppeteer worker ───────────────────────────────────────────────────────

type CfWorkerResult = {
  ok: boolean;
  data: Record<string, unknown> | null;
  durationMs: number;
  error?: string;
};

async function fetchViaCfWorker(
  workerUrl: string,
  secret: string,
  url: string,
): Promise<CfWorkerResult> {
  const start = Date.now();
  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extractor-Secret': secret,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(60_000),
    });

    const durationMs = Date.now() - start;
    const text = await res.text();
    const json = parseJson<{ ok: boolean; data?: unknown; error?: string }>(
      text,
    );

    if (!json) {
      return {
        ok: false,
        data: null,
        durationMs,
        error: `Non-JSON response: ${text.slice(0, 120)}`,
      };
    }
    if (!json.ok) {
      return {
        ok: false,
        data: null,
        durationMs,
        error: json.error ?? 'Worker returned ok=false',
      };
    }

    const raw = json.data as Record<string, unknown> | undefined;
    if (!raw) {
      return {
        ok: false,
        data: null,
        durationMs,
        error: 'No data in response',
      };
    }

    return { ok: true, data: raw, durationMs };
  } catch (err) {
    return {
      ok: false,
      data: null,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Gemini URL Context ────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_INPUT_PER_M = 0.3; // $0.30/M input tokens (Gemini 2.5 Flash)
const GEMINI_OUTPUT_PER_M = 2.5; // $2.50/M output tokens

const GEMINI_EXTRACTION_PROMPT =
  'You are a product data extraction specialist. Fetch the URL provided and classify the page, then extract structured metadata. ' +
  'Return ONLY a valid JSON object — no markdown fences, no explanation. ' +
  'Set pageType to "product" for a single purchasable item, "collection" for a listing/category page with multiple products, ' +
  'or "error" if the page is inaccessible, requires login, has a CAPTCHA, or has no extractable products. ' +
  'For products: include title (string), price (number), currency (3-letter ISO code), brand (string), description (string), imageUrl (string). ' +
  'For collections: include title (string) and collectionItems array (max 5 items, each with sourceUrl, title, price, currency, brand). ' +
  'For errors: include reason (string). Never hallucinate data.';

type GeminiResult = {
  ok: boolean;
  data: PageResult | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  error?: string;
};

async function fetchViaGemini(
  apiKey: string,
  url: string,
): Promise<GeminiResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: GEMINI_EXTRACTION_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Extract product metadata from this URL: ${url}` }],
          },
        ],
        tools: [{ url_context: {} }],
      }),
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        data: null,
        inputTokens: 0,
        outputTokens: 0,
        durationMs,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const json = await res.json();
    const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
    const text: string =
      json.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string }) => p.text)
        ?.map((p: { text: string }) => p.text)
        ?.join('') ?? '';

    const parsed = parseJson(text);

    if (!parsed) {
      return {
        ok: false,
        data: null,
        inputTokens,
        outputTokens,
        durationMs,
        error: `JSON parse failed: ${text.slice(0, 100)}`,
      };
    }

    const validation = PageSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        ok: false,
        data: null,
        inputTokens,
        outputTokens,
        durationMs,
        error: `Schema mismatch: ${JSON.stringify(validation.error.issues).slice(0, 120)}`,
      };
    }

    return {
      ok: true,
      data: validation.data,
      inputTokens,
      outputTokens,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}

// ── Concurrency helper ────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const jinaKey = process.env.JINA_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const cfToken = process.env.CLOUDFLARE_BROWSER_RUN_EDIT;
  const geminiKey = process.env.GEMINI_API_KEY;
  const cfWorkerUrl = process.env.EXTRACTOR_WORKER_URL?.replace(/\/$/, '');
  const cfWorkerSecret = process.env.EXTRACTOR_SECRET;
  const mode = (process.env.MODE ?? 'cf-json') as
    | 'cf-json'
    | 'schema'
    | 'reader'
    | 'search'
    | 'pipeline'
    | 'gemini'
    | 'cf-worker';

  if (mode === 'cf-json' || mode === 'pipeline') {
    if (!cfToken) {
      console.error('CLOUDFLARE_BROWSER_RUN_EDIT is not set');
      process.exit(1);
    }
  }
  if (mode === 'reader' || mode === 'search' || mode === 'pipeline') {
    if (!jinaKey) {
      console.error('JINA_API_KEY is not set');
      process.exit(1);
    }
  }
  if (mode !== 'cf-json' && mode !== 'schema' && mode !== 'gemini') {
    if (!anthropicKey) {
      console.error(`ANTHROPIC_API_KEY is required for MODE=${mode}`);
      process.exit(1);
    }
  }
  if (mode === 'gemini' && !geminiKey) {
    console.error('GEMINI_API_KEY is not set');
    process.exit(1);
  }
  if (mode === 'cf-worker' && (!cfWorkerUrl || !cfWorkerSecret)) {
    console.error(
      'EXTRACTOR_WORKER_URL and EXTRACTOR_SECRET are required for MODE=cf-worker',
    );
    process.exit(1);
  }

  const concurrency = parseInt(process.env.CONCURRENCY ?? '3', 10);
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
  const urls = limit ? SAMPLE_URLS.slice(0, limit) : SAMPLE_URLS;
  const client = anthropicKey
    ? new Anthropic({ apiKey: anthropicKey, maxRetries: 0 })
    : null;

  const modeDesc =
    mode === 'cf-json'
      ? 'CF Browser Run /json (Llama 3.3 70B, no Claude)'
      : mode === 'schema'
        ? 'Jina ReaderLM-v2 schema (no Claude)'
        : mode === 'reader'
          ? 'Jina markdown → Claude Haiku'
          : mode === 'pipeline'
            ? 'Pipeline: CF /json → Jina Reader fallback'
            : mode === 'gemini'
              ? `Gemini URL Context (${GEMINI_MODEL})`
              : mode === 'cf-worker'
                ? 'CF Puppeteer worker (DOM extractor, no LLM)'
                : 'Jina search → Claude Haiku';
  console.log(
    `\n=== Benchmark: ${modeDesc} (${urls.length} URLs, concurrency=${concurrency}) ===\n`,
  );

  type Outcome = {
    url: string;
    domain: string;
    note: string;
    jinaOk: boolean;
    jinaMs: number;
    jinaChars: number;
    extractOk: boolean;
    extractMs: number;
    pageType: string | null;
    hasTitle: boolean;
    hasPrice: boolean;
    hasBrand: boolean;
    hasDescription: boolean;
    hasImageUrl: boolean;
    inputTokens: number;
    outputTokens: number;
    error: string | null;
    tier?: 'cf' | 'jina' | 'failed';
  };

  const outcomes = await runWithConcurrency(
    urls,
    concurrency,
    async ({ url, domain, note }, i): Promise<Outcome> => {
      const pad = String(i + 1).padStart(String(urls.length).length);
      process.stdout.write(`[${pad}/${urls.length}] ${domain} (${note}) ... `);

      // ── cf-json mode: CF Browser Run renders + Llama extracts JSON ──────────
      if (mode === 'cf-json') {
        const result = await fetchViaCfJson(cfToken!, url);
        const d = result.data;
        const pageType = d?.pageType ?? null;
        const hasTitle = Boolean(
          d?.pageType === 'product' || d?.pageType === 'collection'
            ? d.title
            : null,
        );
        const hasPrice = d?.pageType === 'product' ? Boolean(d.price) : false;
        const hasBrand = d?.pageType === 'product' ? Boolean(d.brand) : false;
        const hasDescription =
          d?.pageType === 'product' ? Boolean(d.description) : false;
        const hasImageUrl =
          d?.pageType === 'product' ? Boolean(d.imageUrl) : false;

        if (!result.ok) {
          console.log(
            `ERROR: ${result.error?.slice(0, 80)} (${result.durationMs}ms)`,
          );
        } else {
          console.log(`${pageType} | ${result.durationMs}ms`);
        }

        return {
          url,
          domain,
          note,
          jinaOk: result.ok,
          jinaMs: result.durationMs,
          jinaChars: result.responseChars,
          extractOk: result.ok,
          extractMs: 0,
          pageType,
          hasTitle,
          hasPrice,
          hasBrand,
          hasDescription,
          hasImageUrl,
          inputTokens: 0,
          outputTokens: 0,
          error: result.ok ? null : (result.error ?? null),
        };
      }

      // ── pipeline mode: CF /json first, Jina Reader fallback ─────────────────
      if (mode === 'pipeline') {
        const cfResult = await fetchViaCfJson(cfToken!, url);
        const cfFailed =
          !cfResult.ok || cfResult.data?.pageType === 'error' || !cfResult.data;

        if (!cfFailed) {
          const d = cfResult.data!;
          const pageType = d.pageType ?? null;
          const hasTitle = Boolean(
            d.pageType === 'product' || d.pageType === 'collection'
              ? d.title
              : null,
          );
          const hasPrice = d.pageType === 'product' ? Boolean(d.price) : false;
          const hasBrand = d.pageType === 'product' ? Boolean(d.brand) : false;
          const hasDescription =
            d.pageType === 'product' ? Boolean(d.description) : false;
          const hasImageUrl =
            d.pageType === 'product' ? Boolean(d.imageUrl) : false;
          console.log(`[CF] ${pageType} | ${cfResult.durationMs}ms`);
          return {
            url,
            domain,
            note,
            jinaOk: true,
            jinaMs: cfResult.durationMs,
            jinaChars: cfResult.responseChars,
            extractOk: true,
            extractMs: 0,
            pageType,
            hasTitle,
            hasPrice,
            hasBrand,
            hasDescription,
            hasImageUrl,
            inputTokens: 0,
            outputTokens: 0,
            error: null,
            tier: 'cf',
          };
        }

        // CF failed or returned error — fall back to Jina Reader
        process.stdout.write(`[CF failed, trying Jina] `);
        const jinaResult = await fetchViaJinaReader(jinaKey!, url);
        if (!jinaResult.ok) {
          console.log(
            `JINA ERROR: ${jinaResult.error} (${jinaResult.durationMs}ms)`,
          );
          return {
            url,
            domain,
            note,
            jinaOk: false,
            jinaMs: cfResult.durationMs + jinaResult.durationMs,
            jinaChars: 0,
            extractOk: false,
            extractMs: 0,
            pageType: null,
            hasTitle: false,
            hasPrice: false,
            hasBrand: false,
            hasDescription: false,
            hasImageUrl: false,
            inputTokens: 0,
            outputTokens: 0,
            error: jinaResult.error ?? null,
            tier: 'failed',
          };
        }

        const extract = await extractViaClause(
          client!,
          url,
          jinaResult.markdown,
        );
        const d = extract.data;
        const pageType = d?.pageType ?? null;
        const hasTitle = Boolean(
          d?.pageType === 'product' || d?.pageType === 'collection'
            ? d.title
            : null,
        );
        const hasPrice = d?.pageType === 'product' ? Boolean(d.price) : false;
        const hasBrand = d?.pageType === 'product' ? Boolean(d.brand) : false;
        const hasDescription =
          d?.pageType === 'product' ? Boolean(d.description) : false;
        const hasImageUrl =
          d?.pageType === 'product' ? Boolean(d.imageUrl) : false;

        const status = extract.ok
          ? `[Jina] ${pageType} | ${jinaResult.responseChars.toLocaleString()}chars | jina:${jinaResult.durationMs}ms claude:${extract.durationMs}ms`
          : `[Jina] EXTRACT ERROR: ${extract.error}`;
        console.log(status);

        return {
          url,
          domain,
          note,
          jinaOk: true,
          jinaMs: cfResult.durationMs + jinaResult.durationMs,
          jinaChars: jinaResult.responseChars,
          extractOk: extract.ok,
          extractMs: extract.durationMs,
          pageType,
          hasTitle,
          hasPrice,
          hasBrand,
          hasDescription,
          hasImageUrl,
          inputTokens: extract.inputTokens,
          outputTokens: extract.outputTokens,
          error: extract.ok ? null : (extract.error ?? null),
          tier: 'jina',
        };
      }

      // ── schema mode: single Jina call, ReaderLM-v2 returns JSON directly ──
      if (mode === 'schema') {
        const result = await fetchViaJinaSchema(jinaKey, url);
        const d = result.data;
        const pageType = d?.pageType ?? null;
        const hasTitle = Boolean(
          d?.pageType === 'product' || d?.pageType === 'collection'
            ? d.title
            : null,
        );
        const hasPrice = d?.pageType === 'product' ? Boolean(d.price) : false;
        const hasBrand = d?.pageType === 'product' ? Boolean(d.brand) : false;
        const hasDescription =
          d?.pageType === 'product' ? Boolean(d.description) : false;
        const hasImageUrl =
          d?.pageType === 'product' ? Boolean(d.imageUrl) : false;

        if (!result.ok) {
          console.log(`ERROR: ${result.error} (${result.durationMs}ms)`);
        } else {
          console.log(
            `${pageType} | ${result.responseChars.toLocaleString()}chars | ${result.durationMs}ms`,
          );
        }

        return {
          url,
          domain,
          note,
          jinaOk: result.ok,
          jinaMs: result.durationMs,
          jinaChars: result.responseChars,
          extractOk: result.ok,
          extractMs: 0,
          pageType,
          hasTitle,
          hasPrice,
          hasBrand,
          hasDescription,
          hasImageUrl,
          inputTokens: 0,
          outputTokens: 0,
          error: result.ok ? null : (result.error ?? null),
        };
      }

      // ── gemini mode: URL Context tool fetches + extracts in one call ─────────
      if (mode === 'gemini') {
        const result = await fetchViaGemini(geminiKey!, url);
        const d = result.data;
        const pageType = d?.pageType ?? null;
        const hasTitle = Boolean(
          d?.pageType === 'product' || d?.pageType === 'collection'
            ? d.title
            : null,
        );
        const hasPrice = d?.pageType === 'product' ? Boolean(d.price) : false;
        const hasBrand = d?.pageType === 'product' ? Boolean(d.brand) : false;
        const hasDescription =
          d?.pageType === 'product' ? Boolean(d.description) : false;
        const hasImageUrl =
          d?.pageType === 'product' ? Boolean(d.imageUrl) : false;

        if (!result.ok) {
          console.log(
            `ERROR: ${result.error?.slice(0, 80)} (${result.durationMs}ms)`,
          );
        } else {
          console.log(
            `${pageType} | in:${result.inputTokens} out:${result.outputTokens} | ${result.durationMs}ms`,
          );
        }

        return {
          url,
          domain,
          note,
          jinaOk: result.ok,
          jinaMs: result.durationMs,
          jinaChars: 0,
          extractOk: result.ok,
          extractMs: 0,
          pageType,
          hasTitle,
          hasPrice,
          hasBrand,
          hasDescription,
          hasImageUrl,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          error: result.ok ? null : (result.error ?? null),
        };
      }

      // ── cf-worker mode: deployed Puppeteer worker, DOM extractor, no LLM ───
      if (mode === 'cf-worker') {
        const result = await fetchViaCfWorker(
          cfWorkerUrl!,
          cfWorkerSecret!,
          url,
        );
        const d = result.data;
        // Worker returns loose types — check field presence directly
        const pageType = (d?.pageType as string) ?? null;
        const isProduct = pageType === 'product';
        const hasTitle = Boolean(d?.title);
        const hasPrice = isProduct ? Boolean(d?.price) : false;
        const hasBrand = isProduct ? Boolean(d?.brand) : false;
        const hasDescription = isProduct ? Boolean(d?.description) : false;
        const hasImageUrl = isProduct ? Boolean(d?.imageUrl) : false;

        if (!result.ok) {
          console.log(
            `ERROR: ${result.error?.slice(0, 80)} (${result.durationMs}ms)`,
          );
        } else {
          console.log(`${pageType} | ${result.durationMs}ms`);
        }

        return {
          url,
          domain,
          note,
          jinaOk: result.ok,
          jinaMs: result.durationMs,
          jinaChars: 0,
          extractOk: result.ok,
          extractMs: 0,
          pageType,
          hasTitle,
          hasPrice,
          hasBrand,
          hasDescription,
          hasImageUrl,
          inputTokens: 0,
          outputTokens: 0,
          error: result.ok ? null : (result.error ?? null),
        };
      }

      // ── reader / search modes: fetch markdown, then Claude extraction ──────
      const jinaResult =
        mode === 'reader'
          ? await fetchViaJinaReader(jinaKey, url)
          : await fetchViaJinaSearch(jinaKey, url);

      if (!jinaResult.ok) {
        console.log(
          `JINA ERROR: ${jinaResult.error} (${jinaResult.durationMs}ms)`,
        );
        return {
          url,
          domain,
          note,
          jinaOk: false,
          jinaMs: jinaResult.durationMs,
          jinaChars: 0,
          extractOk: false,
          extractMs: 0,
          pageType: null,
          hasTitle: false,
          hasPrice: false,
          hasBrand: false,
          hasDescription: false,
          hasImageUrl: false,
          inputTokens: 0,
          outputTokens: 0,
          error: jinaResult.error ?? null,
        };
      }

      const extract = await extractViaClause(client!, url, jinaResult.markdown);
      const d = extract.data;
      const pageType = d?.pageType ?? null;
      const hasTitle = Boolean(
        d?.pageType === 'product' || d?.pageType === 'collection'
          ? d.title
          : null,
      );
      const hasPrice = d?.pageType === 'product' ? Boolean(d.price) : false;
      const hasBrand = d?.pageType === 'product' ? Boolean(d.brand) : false;
      const hasDescription =
        d?.pageType === 'product' ? Boolean(d.description) : false;
      const hasImageUrl =
        d?.pageType === 'product' ? Boolean(d.imageUrl) : false;

      const status = extract.ok
        ? `${pageType} | ${jinaResult.responseChars.toLocaleString()}chars | jina:${jinaResult.durationMs}ms claude:${extract.durationMs}ms`
        : `EXTRACT ERROR: ${extract.error}`;
      console.log(status);

      return {
        url,
        domain,
        note,
        jinaOk: true,
        jinaMs: jinaResult.durationMs,
        jinaChars: jinaResult.responseChars,
        extractOk: extract.ok,
        extractMs: extract.durationMs,
        pageType,
        hasTitle,
        hasPrice,
        hasBrand,
        hasDescription,
        hasImageUrl,
        inputTokens: extract.inputTokens,
        outputTokens: extract.outputTokens,
        error: extract.ok ? null : (extract.error ?? null),
      };
    },
  );

  // ── Summary tables ──────────────────────────────────────────────────────────

  const total = outcomes.length;
  const jinaOk = outcomes.filter((o) => o.jinaOk).length;
  const extractOk = outcomes.filter((o) => o.extractOk).length;
  const products = outcomes.filter((o) => o.pageType === 'product');
  const errors = outcomes.filter((o) => o.pageType === 'error');

  const successMs = outcomes.filter((o) => o.jinaOk);
  const avgJinaMs =
    successMs.length > 0
      ? Math.round(
          successMs.reduce((s, o) => s + o.jinaMs, 0) / successMs.length,
        )
      : 0;
  const avgChars =
    successMs.length > 0
      ? Math.round(
          successMs.reduce((s, o) => s + o.jinaChars, 0) / successMs.length,
        )
      : 0;
  const totalInputTokens = outcomes.reduce((s, o) => s + o.inputTokens, 0);
  const totalOutputTokens = outcomes.reduce((s, o) => s + o.outputTokens, 0);

  // Haiku 4.5 pricing: $0.80/M input, $4.00/M output
  const HAIKU_INPUT_PER_M = 0.8;
  const HAIKU_OUTPUT_PER_M = 4.0;

  console.log('\n--- Per-URL Results ---');
  if (mode === 'pipeline') {
    console.log(
      `${'Domain'.padEnd(24)} ${'Tier'.padEnd(6)} ${'Type'.padEnd(12)} ${'Title'.padStart(6)} ${'Price'.padStart(6)} ${'Brand'.padStart(6)} ${'Img'.padStart(5)} ${'Chars'.padStart(8)} ${'TotalMs'.padStart(9)}`,
    );
    console.log('-'.repeat(97));
    for (const o of outcomes) {
      const t = o.pageType ?? (o.jinaOk ? 'parse-err' : 'jina-err');
      const chk = (v: boolean) => (v ? '✓' : '·');
      const totalMs = o.jinaMs + o.extractMs;
      const tier = (o.tier ?? '?').padEnd(6);
      console.log(
        `${o.domain.padEnd(24)} ${tier} ${t.padEnd(12)} ${chk(o.hasTitle).padStart(6)} ${chk(o.hasPrice).padStart(6)} ${chk(o.hasBrand).padStart(6)} ${chk(o.hasImageUrl).padStart(5)} ${o.jinaChars.toLocaleString().padStart(8)} ${String(totalMs).padStart(9)}`,
      );
    }
  } else {
    console.log(
      `${'Domain'.padEnd(24)} ${'Type'.padEnd(12)} ${'Title'.padStart(6)} ${'Price'.padStart(6)} ${'Brand'.padStart(6)} ${'Img'.padStart(5)} ${'Chars'.padStart(8)} ${'TotalMs'.padStart(9)}`,
    );
    console.log('-'.repeat(90));
    for (const o of outcomes) {
      const t = o.pageType ?? (o.jinaOk ? 'parse-err' : 'jina-err');
      const chk = (v: boolean) => (v ? '✓' : '·');
      const totalMs = o.jinaMs + o.extractMs;
      console.log(
        `${o.domain.padEnd(24)} ${t.padEnd(12)} ${chk(o.hasTitle).padStart(6)} ${chk(o.hasPrice).padStart(6)} ${chk(o.hasBrand).padStart(6)} ${chk(o.hasImageUrl).padStart(5)} ${o.jinaChars.toLocaleString().padStart(8)} ${String(totalMs).padStart(9)}`,
      );
    }
  }

  console.log('\n--- Summary ---');
  console.log(
    `Total: ${total}  Fetched ok: ${jinaOk}  Extracted ok: ${extractOk}`,
  );
  console.log(`  product: ${products.length}  error/blocked: ${errors.length}`);
  if (mode === 'pipeline') {
    const cfTier = outcomes.filter((o) => o.tier === 'cf').length;
    const jinaTier = outcomes.filter((o) => o.tier === 'jina').length;
    const failedTier = outcomes.filter((o) => o.tier === 'failed').length;
    console.log(
      `  tier breakdown: CF=${cfTier}  Jina fallback=${jinaTier}  failed=${failedTier}`,
    );
  }
  console.log(
    `Avg latency: ${avgJinaMs}ms | Avg response: ${avgChars.toLocaleString()} chars`,
  );

  if (mode === 'cf-json') {
    // custom_ai bills directly to Anthropic — CF doesn't return token counts.
    // Estimate: typical product page HTML ≈ 10k–30k input tokens + ~300 output tokens.
    const estInputPerUrl = 20_000;
    const estOutputPerUrl = 300;
    const estInputCost = (estInputPerUrl / 1_000_000) * HAIKU_INPUT_PER_M;
    const estOutputCost = (estOutputPerUrl / 1_000_000) * HAIKU_OUTPUT_PER_M;
    const estTotalPerUrl = estInputCost + estOutputCost;
    console.log(`Claude Haiku cost (via custom_ai, billed to Anthropic):`);
    console.log(
      `  Token counts not returned by CF — estimated from typical page size`,
    );
    console.log(
      `  Input:  ~${estInputPerUrl.toLocaleString()} tokens/URL × $${HAIKU_INPUT_PER_M}/M = $${estInputCost.toFixed(5)}/URL`,
    );
    console.log(
      `  Output: ~${estOutputPerUrl} tokens/URL × $${HAIKU_OUTPUT_PER_M}/M  = $${estOutputCost.toFixed(5)}/URL`,
    );
    console.log(
      `  Est. total: $${estTotalPerUrl.toFixed(5)}/URL  ($${(estTotalPerUrl * 1000).toFixed(3)} per 1,000 URLs)`,
    );
  } else if (mode === 'pipeline') {
    const cfTier = outcomes.filter((o) => o.tier === 'cf').length;
    const jinaTier = outcomes.filter((o) => o.tier === 'jina').length;
    const inputCost = (totalInputTokens / 1_000_000) * HAIKU_INPUT_PER_M;
    const outputCost = (totalOutputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M;
    const jinaCost = inputCost + outputCost;
    const estCfInputCost = ((cfTier * 20_000) / 1_000_000) * HAIKU_INPUT_PER_M;
    const estCfOutputCost = ((cfTier * 300) / 1_000_000) * HAIKU_OUTPUT_PER_M;
    const estCfCost = estCfInputCost + estCfOutputCost;
    const estTotal = jinaCost + estCfCost;
    console.log(`Claude Haiku cost (pipeline):`);
    console.log(
      `  CF tier (${cfTier} URLs, estimated): ~$${estCfCost.toFixed(5)}  ($${(estCfCost / Math.max(cfTier, 1)).toFixed(5)}/URL)`,
    );
    if (jinaTier > 0) {
      console.log(
        `  Jina tier (${jinaTier} URLs, tracked): $${jinaCost.toFixed(5)}  ($${(jinaCost / jinaTier).toFixed(5)}/URL)`,
      );
    }
    console.log(
      `  Est. total: $${estTotal.toFixed(5)} for ${total} URLs = $${(estTotal / total).toFixed(5)}/URL  ($${((estTotal / total) * 1000).toFixed(3)} per 1,000 URLs)`,
    );
  } else if (mode === 'gemini') {
    const inputCost = (totalInputTokens / 1_000_000) * GEMINI_INPUT_PER_M;
    const outputCost = (totalOutputTokens / 1_000_000) * GEMINI_OUTPUT_PER_M;
    const totalCost = inputCost + outputCost;
    console.log(`Gemini 2.5 Flash usage (tracked):`);
    console.log(
      `  Input:  ${totalInputTokens.toLocaleString()} tokens × $${GEMINI_INPUT_PER_M}/M = $${inputCost.toFixed(5)}`,
    );
    console.log(
      `  Output: ${totalOutputTokens.toLocaleString()} tokens × $${GEMINI_OUTPUT_PER_M}/M  = $${outputCost.toFixed(5)}`,
    );
    console.log(
      `  Total: $${totalCost.toFixed(5)} for ${total} URLs = $${(totalCost / total).toFixed(5)}/URL  ($${((totalCost / total) * 1000).toFixed(3)} per 1,000 URLs)`,
    );
  } else if (mode !== 'schema') {
    const inputCost = (totalInputTokens / 1_000_000) * HAIKU_INPUT_PER_M;
    const outputCost = (totalOutputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M;
    const totalCost = inputCost + outputCost;
    console.log(`Claude Haiku usage (tracked):`);
    console.log(
      `  Input:  ${totalInputTokens.toLocaleString()} tokens × $${HAIKU_INPUT_PER_M}/M = $${inputCost.toFixed(5)}`,
    );
    console.log(
      `  Output: ${totalOutputTokens.toLocaleString()} tokens × $${HAIKU_OUTPUT_PER_M}/M  = $${outputCost.toFixed(5)}`,
    );
    console.log(
      `  Total: $${totalCost.toFixed(5)} for ${total} URLs = $${(totalCost / total).toFixed(5)}/URL  ($${((totalCost / total) * 1000).toFixed(3)} per 1,000 URLs)`,
    );
  } else {
    console.log(
      `No Claude calls — cost is Jina tokens only (see jina.ai/pricing)`,
    );
  }

  if (products.length > 0) {
    console.log(
      `\n--- Field Coverage (product pages, n=${products.length}) ---`,
    );
    const fields = [
      'hasTitle',
      'hasPrice',
      'hasBrand',
      'hasDescription',
      'hasImageUrl',
    ] as const;
    for (const f of fields) {
      const pct = Math.round(
        (products.filter((o) => o[f]).length / products.length) * 100,
      );
      const bar =
        '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      console.log(`  ${f.replace('has', '').padEnd(14)} ${bar} ${pct}%`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n--- Blocked/Error pages ---`);
    for (const o of errors) {
      console.log(`  ${o.domain}: ${o.note}`);
    }
  }

  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
