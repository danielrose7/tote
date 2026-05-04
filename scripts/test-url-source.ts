#!/usr/bin/env tsx
/**
 * Test Anthropic document URL source extraction against real product/collection URLs.
 * Usage: npx tsx scripts/test-url-source.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const URLS = [
  'https://shop.lululemon.com/a/running-jacket-with-phone-pocket-2aaz00a',
  'https://www.patagonia.com/shop/womens/jackets-vests/lightweight/slim',
  'https://www.titlenine.com/womens-shorts',
];

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

const PAGE_JSON_SCHEMA = z.toJSONSchema(PageSchema);

const SYSTEM_PROMPT = `You are a product data extraction specialist.

Given a web page provided as a document, classify it and extract structured metadata.

Return only a valid JSON object matching this schema:
${JSON.stringify(PAGE_JSON_SCHEMA, null, 2)}

No markdown fences, no explanation — just the JSON object.

Page types:
- product: single purchasable item with a clear price
- collection: category/listing page with multiple products
- error: inaccessible, 404, login wall, or no extractable product data — do NOT hallucinate`;

async function testUrl(client: Anthropic, url: string): Promise<void> {
  const start = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`URL: ${url}`);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'url',
                url,
              },
            } as Anthropic.DocumentBlockParam,
            {
              type: 'text',
              text: 'Extract and classify this page. Return pageType "error" if the page is inaccessible or has no extractable products.',
            },
          ],
        },
      ],
    });

    const ms = Date.now() - start;
    const inputTokens =
      response.usage.input_tokens +
      (response.usage.cache_creation_input_tokens ?? 0) +
      (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    const text = textBlocks
      .map((b) => b.text)
      .join('\n')
      .trim();

    const stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* fall through */
        }
      }
    }

    if (parsed === undefined) {
      console.log(`RESULT: JSON parse failed`);
      console.log(`RAW: ${text.slice(0, 300)}`);
      console.log(
        `Time: ${ms}ms | tokens: ${inputTokens} in / ${outputTokens} out`,
      );
      return;
    }

    const validation = PageSchema.safeParse(parsed);
    if (!validation.success) {
      console.log(`RESULT: Schema validation failed`);
      console.log(
        `Issues: ${JSON.stringify(validation.error.issues, null, 2)}`,
      );
      console.log(`Parsed: ${JSON.stringify(parsed, null, 2)}`);
      console.log(
        `Time: ${ms}ms | tokens: ${inputTokens} in / ${outputTokens} out`,
      );
      return;
    }

    const p = validation.data;
    console.log(`RESULT: pageType=${p.pageType}`);
    if (p.pageType === 'product') {
      console.log(`  title: ${p.title}`);
      console.log(`  price: ${p.price} ${p.currency}`);
      console.log(`  brand: ${p.brand}`);
      if (p.description) console.log(`  description: ${p.description}`);
      if (p.imageUrl) console.log(`  imageUrl: ${p.imageUrl}`);
    } else if (p.pageType === 'collection') {
      console.log(`  title: ${p.title}`);
      console.log(`  items: ${p.collectionItems.length}`);
      for (const item of p.collectionItems.slice(0, 3)) {
        console.log(
          `    - ${item.title ?? '(no title)'} ${item.price ? `$${item.price}` : ''} ${item.sourceUrl}`,
        );
      }
      if (p.collectionItems.length > 3) {
        console.log(`    ... and ${p.collectionItems.length - 3} more`);
      }
    } else {
      console.log(`  reason: ${p.reason}`);
    }
    console.log(
      `Time: ${ms}ms | tokens: ${inputTokens} in / ${outputTokens} out`,
    );
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`ERROR: ${String(err)}`);
    console.log(`Time: ${ms}ms`);
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 60_000 });

  console.log('Testing Anthropic document URL source extraction');
  console.log(`Model: claude-sonnet-4-6`);

  for (const url of URLS) {
    await testUrl(client, url);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log('Done.');
}

main().catch(console.error);
