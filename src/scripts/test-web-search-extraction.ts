/**
 * Demo: product metadata extraction via Anthropic built-in web search.
 *
 * Uses web_search_20250305 (no code execution bloat), Zod schema validation,
 * and a "repair tool call" retry loop for JSON parse failures.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx tsx src/scripts/test-web-search-extraction.ts [url...]
 *
 * Defaults to patagonia + toddsnyder + eileenfisher if no URLs provided.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_URLS = [
  'https://www.patagonia.com/product/mens-torrentshell-3-layer-rain-jacket/85241.html',
  'https://www.toddsnyder.com/products/made-in-usa-selvedge-rigid-slim-fitd-slim-fit-indigo',
  'https://www.eileenfisher.com/organic-linen-trouser-pant/S4RII-P4800.html',
];

// ── Schema ──────────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  title: z.string().describe('Exact product name'),
  price: z.number().positive().describe('Numeric price, e.g. 149.00'),
  currency: z.string().describe('ISO 4217 currency code, e.g. USD'),
  brand: z.string().describe('Brand or manufacturer name'),
  description: z
    .string()
    .optional()
    .describe('1-2 sentence product description'),
  imageUrl: z
    .string()
    .url()
    .optional()
    .describe('Direct URL to main product image'),
});

type Product = z.infer<typeof ProductSchema>;

const SCHEMA_JSON = JSON.stringify(z.toJSONSchema(ProductSchema), null, 2);

// ── Extraction prompt ───────────────────────────────────────────────────────

const SYSTEM = `<persona>
You are a product metadata extractor. You fetch product pages and return structured data.
</persona>

<task>
The user gives you a product page URL. Search for that exact URL to read the page, then extract and return structured product metadata as JSON.
</task>

<output_format>
Return ONLY a valid JSON object — no markdown fences, no prose, no explanation before or after.
The JSON must conform to this schema:
${SCHEMA_JSON}
</output_format>

<rules>
- price is a positive number (e.g. 149.00), never a string — this lets apps do math on prices
- currency is ISO 4217 (USD, EUR, GBP, JPY, etc.)
- omit optional fields when the page does not clearly state them
- use values from the page; do not infer or invent
- one search is usually enough — stop as soon as you have the data
</rules>

<example>
URL: https://example.com/products/wool-sweater
Output: {"title":"Merino Wool Crew Sweater","price":145.00,"currency":"USD","brand":"Example Co","description":"Classic crew-neck sweater in 100% merino wool.","imageUrl":"https://example.com/images/wool-sweater.jpg"}
</example>`;

// ── Core extraction with repair loop ───────────────────────────────────────

async function extractProduct(url: string): Promise<{
  data: Product | null;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
  durationMs: number;
  attempts: number;
  rawText: string;
}> {
  const start = Date.now();
  const hostname = new URL(url).hostname;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Extract product metadata from: ${url}` },
  ];

  const tools: Anthropic.Tool[] = [
    {
      // @ts-expect-error — web_search_20250305 not yet in SDK types
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 2,
      allowed_domains: [hostname],
    },
  ];

  let totalInput = 0;
  let totalOutput = 0;
  let totalSearches = 0;
  let rawText = '';
  let data: Product | null = null;
  let attempts = 0;

  while (attempts < 3) {
    attempts++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;
    totalSearches += response.usage.server_tool_use?.web_search_requests ?? 0;

    const textBlocks = response.content.filter((b) => b.type === 'text');
    rawText = textBlocks
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n')
      .trim();

    // Strip markdown fences if present
    const stripped = rawText
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    // Extract JSON even if there's prose before/after it
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (attempts >= 3) break;
      // Ask model to try again with only JSON
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: `Your response did not contain a JSON object. Return ONLY the JSON object with no prose or markdown.`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      if (attempts >= 3) break;
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: `JSON parse error: ${e}. Fix the JSON and return ONLY a valid JSON object.`,
      });
      continue;
    }

    const result = ProductSchema.safeParse(parsed);
    if (result.success) {
      data = result.data;
      break;
    }

    if (attempts >= 3) break;

    // Repair tool call: send validation errors back to model
    const errors = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: `Schema validation failed: ${errors}. Correct the JSON and return ONLY a valid JSON object.`,
    });
  }

  return {
    data,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    webSearchRequests: totalSearches,
    durationMs: Date.now() - start,
    attempts,
    rawText,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const urls =
    process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_URLS;

  console.log(
    `\n=== Web Search Product Extraction (${urls.length} URLs) ===\n`,
  );

  for (const url of urls) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`URL: ${url}`);
    console.log('Extracting...');

    try {
      const result = await extractProduct(url);
      console.log(
        `Done in ${result.durationMs}ms (${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`,
      );
      console.log(
        `Tokens: ${result.inputTokens} in / ${result.outputTokens} out | searches: ${result.webSearchRequests}`,
      );

      if (result.data) {
        console.log('Extracted:');
        for (const [k, v] of Object.entries(result.data)) {
          const display = String(v).slice(0, 120);
          console.log(`  ${k}: ${display}`);
        }
      } else {
        console.log('Extraction failed (no valid data after retries)');
        console.log(`Raw text (first 300): ${result.rawText.slice(0, 300)}`);
      }
    } catch (err) {
      console.log(`ERROR: ${err}`);
      if (err instanceof Error) console.log(err.stack);
    }

    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
